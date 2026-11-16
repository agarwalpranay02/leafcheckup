// LeafCheckup inference worker. Runs ONNX Runtime Web off the main thread.
// Loaded from /ort/<version>/worker.mjs?ep=wasm|webgpu; the runtimes sit next to it.
const EP = new URL(self.location.href).searchParams.get("ep") === "webgpu" ? "webgpu" : "wasm";
const ortP = EP === "webgpu" ? import("./ort.webgpu.min.mjs") : import("./ort.wasm.min.mjs");

let session = null;
let loading = null;

async function init(modelUrl) {
  if (session) return;
  if (!loading) {
    loading = (async () => {
      const ort = await ortP;
      ort.env.wasm.wasmPaths = new URL("./", import.meta.url).href;
      // Multi-threaded WASM when the page is cross-origin isolated (COOP + COEP)
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      ort.env.logLevel = "error";
      const res = await fetch(modelUrl, { cache: "force-cache" });
      if (!res.ok) throw new Error(`model ${res.status}`);
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        if (total) self.postMessage({ type: "progress", loaded: got, total });
      }
      const buf = new Uint8Array(got);
      let o = 0;
      for (const c of chunks) { buf.set(c, o); o += c.length; }
      session = await ort.InferenceSession.create(buf, {
        executionProviders: EP === "webgpu" ? ["webgpu"] : ["wasm"],
        graphOptimizationLevel: "all",
      });
      self.postMessage({ type: "backend", ep: EP, threads: EP === "wasm" ? ort.env.wasm.numThreads : 0 });
    })();
  }
  await loading;
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    if (type === "init") {
      await init(e.data.modelUrl);
      self.postMessage({ id, type: "ready" });
    } else if (type === "run") {
      await init(e.data.modelUrl);
      const ort = await ortP;
      const { data, n, size } = e.data;
      const t0 = performance.now();
      const out = await session.run({ image: new ort.Tensor("float32", data, [n, 3, size, size]) });
      const f = out.features;
      const result = f.location === "gpu-buffer" ? await f.getData() : f.data;
      self.postMessage({ id, type: "result", data: result, dims: f.dims, ms: performance.now() - t0 }, [result.buffer]);
    }
  } catch (err) {
    self.postMessage({ id, type: "error", message: String((err && err.message) || err) });
  }
};
