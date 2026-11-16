"use client";
/**
 * On-device diagnosis engine.
 *
 * Pipeline: photo -> orientation-corrected bitmap -> square crop -> 224px tensor
 * -> worker (EfficientNet-B0 features, original + mirrored) -> classifier head
 * here -> calibrated probabilities, class activation map, out-of-distribution
 * score, photo-quality checks.
 */
import { ORT_VERSION } from "./ort-version";
import { MODEL_VERSION } from "./model-version";

export type Head = {
  version: string;
  input: { size: number; mean: number[]; std: number[] };
  output: { channels: number; grid: number };
  classes: string[];
  temperature: number;
  weights: number[][];
  bias: number[];
  ood: { method: string; dim: number; classes: number; file: string; threshold: number };
  files: Record<string, { bytes: number; sha256: string }>;
  evaluation: Record<string, unknown>;
};

export type Quality = {
  blur: number; // variance of Laplacian on 224px luma; low = blurry
  brightness: number; // 0..255 mean luma
  plantCover: number; // share of pixels that look like plant tissue
  issues: ("blurry" | "dark" | "bright" | "no_leaf")[];
};

export type Diagnosis = {
  classId: string;
  confidence: number;
  probs: { id: string; p: number }[];
  supported: boolean; // false = photo does not look like a supported leaf
  similarity: number; // OOD score; higher = more leaf-like
  cam: Float32Array; // grid*grid, 0..1, for the top class
  grid: number;
  quality: Quality;
  ms: number;
  modelVersion: string;
  backend: Backend;
};

export const MODEL_BASE = `/models/${MODEL_VERSION}`;
export type Backend = "wasm" | "webgpu";
const workerUrl = (ep: Backend) => `/ort/${ORT_VERSION}/worker.mjs?ep=${ep}`;

const workers: Partial<Record<Backend, Worker>> = {};
export const backendInfo: Partial<Record<Backend, { threads: number }>> = {};
let headP: Promise<Head> | null = null;
let oodP: Promise<Float32Array> | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const progressListeners = new Set<(loaded: number, total: number) => void>();

function modelUrl(head?: Head) {
  const file = head?.files["model.int8.onnx"] ? "model.int8.onnx" : "model.onnx";
  return `${MODEL_BASE}/${file}`;
}

export function onModelProgress(fn: (loaded: number, total: number) => void) {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

function getWorker(ep: Backend = "wasm") {
  const existing = workers[ep];
  if (existing) return existing;
  const worker = new Worker(workerUrl(ep), { type: "module", name: `leafcheckup-${ep}` });
  workers[ep] = worker;
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === "progress") {
      progressListeners.forEach((fn) => fn(m.loaded, m.total));
      return;
    }
    if (m.type === "backend") {
      backendInfo[m.ep as Backend] = { threads: m.threads };
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === "error") p.reject(new Error(m.message));
    else p.resolve(m);
  };
  worker.onerror = (e) => {
    pending.forEach((p) => p.reject(new Error(e.message || "worker failed")));
    pending.clear();
    delete workers[ep];
  };
  return worker;
}

function call<T>(msg: Record<string, unknown>, transfer: Transferable[] = [], ep: Backend = "wasm"): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker(ep).postMessage({ id, ...msg }, transfer);
  });
}

/** True when a WebGPU adapter is available (desktop Chrome/Edge, recent Android Chrome). */
export async function webgpuAvailable(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return Boolean(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

export function loadHead(): Promise<Head> {
  headP ??= fetch(`${MODEL_BASE}/head.json`, { cache: "force-cache" }).then((r) => {
    if (!r.ok) throw new Error(`head ${r.status}`);
    return r.json();
  });
  return headP;
}

function loadOod(head: Head): Promise<Float32Array> {
  oodP ??= fetch(`${MODEL_BASE}/${head.ood.file}`, { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`ood ${r.status}`);
      return r.arrayBuffer();
    })
    .then((b) => new Float32Array(b));
  return oodP;
}

/**
 * Out-of-distribution score: negative minimum Mahalanobis distance to any class,
 * computed as -min_k ||A f - o_k||^2 with A (dim x C) and o (classes x dim) from ood.bin.
 */
function oodScore(head: Head, buf: Float32Array, f: Float32Array): number {
  const { dim, classes } = head.ood;
  const C = f.length;
  const af = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    let s = 0;
    const row = i * C;
    for (let c = 0; c < C; c++) s += buf[row + c] * f[c];
    af[i] = s;
  }
  const oBase = dim * C;
  let best = Infinity;
  for (let k = 0; k < classes; k++) {
    let d = 0;
    for (let i = 0; i < dim; i++) {
      const v = af[i] - buf[oBase + k * dim + i];
      d += v * v;
    }
    best = Math.min(best, d);
  }
  return -best;
}

/** Download + compile the model ahead of time (e.g. when the tool scrolls into view). */
export async function warmUp(ep: Backend = "wasm") {
  const head = await loadHead();
  await Promise.all([call({ type: "init", modelUrl: modelUrl(head) }, [], ep), loadOod(head)]);
}

export type Crop = { x: number; y: number; size: number }; // in source pixels

export async function decode(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/** Largest centred square, used when the user does not adjust the frame. */
export function centerCrop(w: number, h: number): Crop {
  const size = Math.min(w, h);
  return { x: (w - size) / 2, y: (h - size) / 2, size };
}

function toCanvas(src: CanvasImageSource, crop: Crop, size: number) {
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

export function assessQuality(img: ImageData): Quality {
  const { data, width: w, height: h } = img;
  const luma = new Float32Array(w * h);
  let sum = 0;
  let plant = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[p] = y;
    sum += y;
    // Excess-green index, plus yellow/brown tissue (diseased leaves are not always green)
    const exg = 2 * g - r - b;
    const yellow = r > 90 && g > 80 && b < 0.75 * g && Math.abs(r - g) < 70;
    if (exg > 18 || yellow) plant++;
  }
  let lap = 0, lapSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w];
      lap += v;
      lapSq += v * v;
      n++;
    }
  }
  const blur = lapSq / n - (lap / n) ** 2;
  const brightness = sum / (w * h);
  const plantCover = plant / (w * h);
  const issues: Quality["issues"] = [];
  if (blur < 60) issues.push("blurry");
  if (brightness < 45) issues.push("dark");
  if (brightness > 225) issues.push("bright");
  if (plantCover < 0.12) issues.push("no_leaf");
  return { blur, brightness, plantCover, issues };
}

function toTensor(img: ImageData, head: Head, flip: boolean, out: Float32Array, offset: number) {
  const { size, mean, std } = head.input;
  const { data } = img;
  const plane = size * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = flip ? size - 1 - x : x;
      const i = (y * size + sx) * 4;
      const o = offset + y * size + x;
      out[o] = (data[i] / 255 - mean[0]) / std[0];
      out[o + plane] = (data[i + 1] / 255 - mean[1]) / std[1];
      out[o + 2 * plane] = (data[i + 2] / 255 - mean[2]) / std[2];
    }
  }
}

export async function diagnose(bitmap: ImageBitmap, crop?: Crop, ep: Backend = "wasm"): Promise<Diagnosis> {
  const head = await loadHead();
  const size = head.input.size;
  const c = crop ?? centerCrop(bitmap.width, bitmap.height);
  const img = toCanvas(bitmap, c, size);
  const quality = assessQuality(img);

  // Test-time augmentation: original + horizontal mirror in one batch
  const plane = 3 * size * size;
  const tensor = new Float32Array(2 * plane);
  toTensor(img, head, false, tensor, 0);
  toTensor(img, head, true, tensor, plane);

  const res = await call<{ data: Float32Array; dims: number[]; ms: number }>(
    { type: "run", modelUrl: modelUrl(head), data: tensor, n: 2, size },
    [tensor.buffer],
    ep,
  );
  const [, C, G] = res.dims;
  const cells = G * G;
  const fm = res.data;

  // Average the two views (mirror the second view's spatial map back)
  const avg = new Float32Array(C * cells);
  for (let ch = 0; ch < C; ch++) {
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const a = fm[ch * cells + y * G + x];
        const b = fm[C * cells + ch * cells + y * G + (G - 1 - x)];
        avg[ch * cells + y * G + x] = (a + b) / 2;
      }
    }
  }
  const pooled = new Float32Array(C);
  for (let ch = 0; ch < C; ch++) {
    let s = 0;
    for (let k = 0; k < cells; k++) s += avg[ch * cells + k];
    pooled[ch] = s / cells;
  }

  const K = head.classes.length;
  const logits = head.bias.slice();
  for (let k = 0; k < K; k++) {
    const w = head.weights[k];
    let s = 0;
    for (let ch = 0; ch < C; ch++) s += w[ch] * pooled[ch];
    logits[k] += s;
  }
  const maxL = Math.max(...logits);
  const exps = logits.map((l) => Math.exp((l - maxL) / head.temperature));
  const Z = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e, k) => ({ id: head.classes[k], p: e / Z })).sort((a, b) => b.p - a.p);
  const top = head.classes.indexOf(probs[0].id);

  // Out-of-distribution: Mahalanobis distance in the model's feature space
  const similarity = oodScore(head, await loadOod(head), pooled);

  // Class activation map for the top class: sum_c w_kc * F_c, ReLU, normalise
  const cam = new Float32Array(cells);
  const w = head.weights[top];
  for (let ch = 0; ch < C; ch++) {
    const wc = w[ch];
    if (wc === 0) continue;
    for (let k = 0; k < cells; k++) cam[k] += wc * avg[ch * cells + k];
  }
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < cells; k++) {
    cam[k] = Math.max(0, cam[k]);
    lo = Math.min(lo, cam[k]);
    hi = Math.max(hi, cam[k]);
  }
  for (let k = 0; k < cells; k++) cam[k] = hi > lo ? (cam[k] - lo) / (hi - lo) : 0;

  const supported = similarity >= head.ood.threshold && !quality.issues.includes("no_leaf");
  return {
    classId: probs[0].id,
    confidence: probs[0].p,
    probs,
    supported,
    similarity,
    cam,
    grid: G,
    quality,
    ms: res.ms,
    modelVersion: head.version,
    backend: ep,
  };
}

/** Render the CAM as a translucent heatmap the size of the crop preview. */
export function renderHeatmap(d: Diagnosis, size: number): HTMLCanvasElement {
  const small = document.createElement("canvas");
  small.width = small.height = d.grid;
  const sctx = small.getContext("2d")!;
  const im = sctx.createImageData(d.grid, d.grid);
  for (let k = 0; k < d.cam.length; k++) {
    const v = d.cam[k];
    // Only the strongest ~40% of activation is tinted; bloom yellow shading to blight red at the peak
    const a = Math.max(0, (v - 0.55) / 0.45);
    im.data[k * 4] = 243 + (176 - 243) * a;
    im.data[k * 4 + 1] = 193 + (68 - 193) * a;
    im.data[k * 4 + 2] = 27 + (42 - 27) * a;
    im.data[k * 4 + 3] = Math.round(Math.min(1, a * 1.2) * 150);
  }
  sctx.putImageData(im, 0, 0);
  const out = document.createElement("canvas");
  out.width = out.height = size;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, size, size);
  return out;
}

/** Small JPEG thumbnail (data URL) for on-device history. */
export async function thumbnail(bitmap: ImageBitmap, crop: Crop, size = 256): Promise<string> {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.8);
}
