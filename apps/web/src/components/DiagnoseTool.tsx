"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { byId, CONDITIONS, COVERAGE, CROPS, t as tr } from "@/lib/diseases";
import {
  backendInfo, centerCrop, decode, diagnose, onModelProgress, renderHeatmap, thumbnail, warmUp,
  type Crop, type Diagnosis,
} from "@/lib/model/engine";
import { saveScan, uid, type Scan } from "@/lib/store";
import { SITE } from "@/lib/site";
import { toast } from "@/lib/toast";
import SAMPLE_RESULTS from "@/lib/sample-results.json";

type Phase = "idle" | "live" | "loading" | "analysing" | "result" | "error";


/** Haptic tick, only after the person has interacted with the page (browsers block it otherwise). */
const buzz = (p: number | number[]) => {
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(p);
};

export type ToolResult = { diagnosis: Diagnosis; scan: Scan };

export function DiagnoseTool({
  variant = "full",
  onResult,
  surveyId,
  autoSave = true,
}: {
  variant?: "hero" | "full" | "compact";
  onResult?: (r: ToolResult) => void;
  surveyId?: string;
  autoSave?: boolean;
}) {
  const t = useTranslations("tool");
  const ts = useTranslations("severity");
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [heat, setHeat] = useState<string | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveRef = useRef(false);
  const [live, setLive] = useState<{ id: string; p: number; supported: boolean } | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);

  // Warm the model when the tool scrolls into view (or immediately on the tool page)
  useEffect(() => {
    const off = onModelProgress((l, total) => setProgress(Math.round((l / total) * 100)));
    const el = rootRef.current;
    if (!el) return off;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        warmUp().catch(() => {});
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => { off(); io.disconnect(); };
  }, []);

  useEffect(() => () => { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }, []);

  const run = useCallback(async (bmp: ImageBitmap, c: Crop) => {
    setPhase(progress === null || progress < 100 ? "loading" : "analysing");
    setError(null);
    try {
      await warmUp();
      setPhase("analysing");
      const started = performance.now();
      const d = await diagnose(bmp, c);
      // Let the scan animation register even on fast devices
      const wait = 650 - (performance.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const id = uid();
      const scan: Scan = {
        id, at: Date.now(), classId: d.classId, confidence: d.confidence, supported: d.supported,
        probs: d.probs, thumb: await thumbnail(bmp, c), modelVersion: d.modelVersion, surveyId,
      };
      if (autoSave) {
        await saveScan(scan).catch(() => {});
        if (!surveyId) toast(t("save"), { href: "/history", action: "My scans" });
      }
      buzz(d.supported ? [18] : [30, 60, 30]);
      setScanId(id);
      setResult(d);
      setHeat(renderHeatmap(d, 448).toDataURL());
      setShowHeat(true);
      setPhase("result");
      onResult?.({ diagnosis: d, scan });
      requestAnimationFrame(() => {
        if (variant !== "hero" && window.innerWidth < 1024) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      console.error(e);
      setError(t("error"));
      setPhase("error");
    }
  }, [autoSave, onResult, progress, surveyId, t, variant]);

  const accept = useCallback(async (blob: Blob) => {
    if (!blob.type.startsWith("image/") && blob.type !== "") {
      setError(t("fileError"));
      setPhase("error");
      return;
    }
    try {
      const bmp = await decode(blob);
      const c = centerCrop(bmp.width, bmp.height);
      setBitmap(bmp);
      setCrop(c);
      setPreview(cropPreview(bmp, c));
      setResult(null);
      await run(bmp, c);
    } catch {
      setError(t("fileError"));
      setPhase("error");
    }
  }, [run, t]);

  // Paste an image from the clipboard anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) { e.preventDefault(); accept(f); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  const stopLive = useCallback(() => {
    liveRef.current = false;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLive(null);
    setTorch(null);
  }, []);
  useEffect(() => stopLive, [stopLive]);

  /** Live mode: the camera stream is diagnosed continuously on-device; the shutter keeps a frame. */
  const startLive = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { cameraRef.current?.click(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setPreview(null);
      setResult(null);
      setPhase("live");
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorch(caps.torch ? false : null);
      void (async () => {
        // The <video> mounts on the render after phase becomes "live"; wait for it rather than giving up
        let v = videoRef.current;
        for (let i = 0; !v && i < 120; i++) {
          await new Promise((r) => requestAnimationFrame(r));
          v = videoRef.current;
        }
        if (!v || streamRef.current !== stream) return;
        v.srcObject = stream;
        await v.play().catch(() => {});
        liveRef.current = true;
        await warmUp();
        while (liveRef.current) {
          if (v.readyState >= 2 && v.videoWidth) {
            const bmp = await createImageBitmap(v);
            try {
              const d = await diagnose(bmp, centerCrop(bmp.width, bmp.height));
              if (liveRef.current) setLive({ id: d.classId, p: d.confidence, supported: d.supported });
            } finally { bmp.close(); }
          }
          await new Promise((r) => setTimeout(r, 120));
        }
      })();
    } catch {
      // Permission denied or no camera: fall back to the system camera / file picker
      stopLive();
      setPhase("idle");
      cameraRef.current?.click();
    }
  }, [stopLive]);

  const capture = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    // A tap that lands before the camera's first frame waits for it instead of being lost
    if (!v.videoWidth) {
      const ready = await new Promise<boolean>((resolve) => {
        const t = setTimeout(() => resolve(false), 10_000);
        v.addEventListener("loadeddata", () => { clearTimeout(t); resolve(true); }, { once: true });
      });
      if (!ready || !v.videoWidth) return;
    }
    const bmp = await createImageBitmap(v);
    stopLive();
    buzz(12);
    const c = centerCrop(bmp.width, bmp.height);
    setBitmap(bmp);
    setCrop(c);
    setPreview(cropPreview(bmp, c));
    await run(bmp, c);
  }, [run, stopLive]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }).catch(() => {});
    setTorch(!torch);
  };

  // Deep links: ?camera=1 opens the live camera; ?shared=1 picks up a photo shared from another app
  useEffect(() => {
    if (variant === "hero") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("shared") === "1" && "caches" in window) {
      caches.open("leafcheckup-share").then(async (c) => {
        const res = await c.match("/shared-image");
        if (res) { await c.delete("/shared-image"); accept(await res.blob()); }
      });
    } else if (q.get("camera") === "1") {
      setTimeout(startLive, 0);
    }
    if (q.has("shared") || q.has("camera")) history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) accept(f);
  };

  const trySample = async (id: string) => {
    const c = byId[id];
    const res = await fetch(c.sample);
    accept(await res.blob());
  };

  const reset = () => {
    stopLive();
    setPhase("idle");
    setResult(null);
    setBitmap(null);
    setPreview(null);
    setHeat(null);
    setError(null);
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setSpeaking(false);
  };

  const condition = result ? byId[result.classId] : null;
  // Never display certainty: cap at 99%
  const pct = result ? Math.min(99, Math.round(result.confidence * 100)) : 0;
  const level = !result ? null : result.confidence >= 0.8 ? "high" : result.confidence >= 0.55 ? "mid" : "low";

  const speak = () => {
    if (!condition || !result || typeof speechSynthesis === "undefined") return;
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const lines = result.supported
      ? [
          `${tr(CROPS[condition.crop], locale)}: ${tr(condition.name, locale)}.`,
          `${t("confidence")}: ${pct}%.`,
          tr(condition.summary, locale),
          `${t("whatToDo")}.`,
          ...condition.act.now.map((x) => tr(x, locale)),
        ]
      : [t("unsupportedTitle"), t("unsupportedBody")];
    const u = new SpeechSynthesisUtterance(lines.join(" "));
    u.lang = "en-IN";
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("en-in")) ?? speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("en"));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const share = async () => {
    if (!condition || !result) return;
    const url = SITE.url;
    const text = t("shareText", { name: tr(condition.name, locale), pct, url });
    try {
      if (navigator.share) {
        const data: ShareData = { title: "LeafCheckup", text };
        if (preview) {
          const blob = await (await fetch(preview)).blob();
          const file = new File([blob], "leaf.jpg", { type: "image/jpeg" });
          if (navigator.canShare?.({ files: [file] })) data.files = [file];
        }
        await navigator.share(data);
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      }
    } catch { /* user cancelled */ }
  };

  const busy = phase === "loading" || phase === "analysing";
  const hero = variant === "hero";

  return (
    <div ref={rootRef} className={hero ? "" : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start"}>
      {/* ---------- Viewfinder ---------- */}
      <div className="lg:sticky lg:top-24">
        <div
          className={`viewfinder relative aspect-square w-full overflow-hidden rounded-[var(--radius-frame)] bg-[var(--color-leaf-deep)] text-white shadow-[0_30px_60px_-30px_rgb(19_35_27/0.55)] ${dragOver ? "ring-4 ring-[var(--color-bloom)]" : ""}`}
          style={{ ["--vf-color" as string]: result && !result.supported ? "#ffffff" : "var(--color-bloom)" }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
        >
          <span className="vf-b" />
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
              {phase === "result" && heat && result?.supported && byId[result.classId].severity !== "none" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heat} alt="" className={`absolute inset-0 h-full w-full object-cover mix-blend-normal transition-opacity duration-500 ${showHeat ? "opacity-100" : "opacity-0"}`} />
              )}
              {busy && (
                <>
                  <div className="absolute inset-0 bg-[rgb(19_35_27/0.35)]" />
                  <div className="scanline" />
                  <p className="absolute inset-x-0 bottom-6 z-[4] text-center text-[1.05rem] font-[600]" role="status" aria-live="polite">
                    {phase === "loading" && progress !== null && progress < 100 ? t("loadingModel", { pct: progress }) : t("analysing")}
                  </p>
                </>
              )}
            </>
          ) : phase === "live" ? (
            <>
              <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" aria-label="Live camera preview" />
              <div className="scanline opacity-60" />
              <div className="absolute inset-x-0 top-0 z-[4] flex justify-between p-7">
                <button type="button" onClick={reset} className="grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur" aria-label="Close camera">✕</button>
                {torch !== null && (
                  <button type="button" onClick={toggleTorch} aria-pressed={torch} className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur ${torch ? "bg-[var(--color-bloom)] text-[var(--color-ink)]" : "bg-black/45 text-white"}`} aria-label="Torch">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" fill="currentColor" /></svg>
                  </button>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col items-center gap-4 bg-gradient-to-t from-black/70 to-transparent px-5 pb-6 pt-16">
                <p className="min-h-[2.75rem] text-center" aria-live="polite">
                  {live && live.supported && live.p >= 0.55 ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 font-[650] text-[var(--color-ink)]">
                      <span className={`h-2.5 w-2.5 rounded-full ${byId[live.id].severity === "none" ? "bg-[var(--color-leaf)]" : "bg-[var(--color-blight)]"}`} />
                      {tr(byId[live.id].name, locale)} <span className="num text-[var(--muted)]">{Math.min(99, Math.round(live.p * 100))}%</span>
                    </span>
                  ) : (
                    <span className="text-white/90">{live ? `Fill the frame with one ${COVERAGE.cropsOr} leaf` : t("loadingModelShort")}</span>
                  )}
                </p>
                <button type="button" onClick={capture} aria-label={t("analyse")} className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-white/25 ring-4 ring-white backdrop-blur transition-transform active:scale-95">
                  <span className="h-14 w-14 rounded-full bg-white" />
                </button>
              </div>
            </>
          ) : (
            <>
              <HeroDemo />
              <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col items-center gap-4 bg-gradient-to-t from-[rgb(14_30_22/0.92)] via-[rgb(14_30_22/0.75)] to-transparent px-6 pb-7 pt-24 text-center">
                <p className="title text-[1.5rem] sm:text-[1.75rem]">{t("drop")}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button type="button" className="btn btn-primary" onClick={startLive}>
                    <CameraIcon /> {t("takePhoto")}
                  </button>
                  <button type="button" className="btn bg-white/12 text-white ring-1 ring-white/25 hover:bg-white/20" onClick={() => fileRef.current?.click()}>
                    {t("upload")}
                  </button>
                </div>
                <p className="hidden text-sm text-white/70 sm:block">{t("paste")}</p>
              </div>
            </>
          )}
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

        {phase === "idle" && (
          <div className="mt-5">
            <p className="text-[0.98rem] text-[var(--muted)]">{t("tryOne")}</p>
            <ul className="mt-3 grid grid-cols-6 gap-2">
              {CONDITIONS.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => trySample(c.id)}
                    className="group block aspect-square w-full overflow-hidden rounded-xl ring-1 ring-[var(--rule)] transition hover:ring-2 hover:ring-[var(--color-leaf)]"
                    aria-label={`${tr(CROPS[c.crop], locale)}: ${tr(c.name, locale)}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.sample} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(phase === "result" || phase === "error") && bitmap && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost min-h-11" onClick={reset}>{t("change")}</button>
            {phase === "result" && result?.supported && byId[result.classId].severity !== "none" && (
              <button type="button" className="btn btn-ghost min-h-11" aria-pressed={showHeat} onClick={() => setShowHeat((s) => !s)}>
                {showHeat ? t("hideHeat") : t("showHeat")}
              </button>
            )}
            {phase === "result" && crop && (
              <CropNudge bitmap={bitmap} crop={crop} label={t("zoom")} onApply={(c) => { setCrop(c); setPreview(cropPreview(bitmap, c)); run(bitmap, c); }} />
            )}
          </div>
        )}
      </div>

      {/* ---------- Result ---------- */}
      {!hero && (
        <div ref={resultRef} aria-live="polite" className="min-h-[2rem] scroll-mt-24">
          {phase === "error" && error && (
            <div role="alert" className="rounded-3xl bg-[var(--color-blight-soft)] p-6 text-[var(--color-ink)]">
              <p className="title text-xl">{error}</p>
              <button type="button" className="btn btn-ghost mt-4" onClick={reset}>{t("again")}</button>
            </div>
          )}
          {phase === "idle" && <IdleCopy />}
          {busy && <ResultSkeleton />}
          {phase === "result" && result && condition && (
            <ResultPanel
              d={result} c={condition} pct={pct} level={level!} scanId={scanId}
              speaking={speaking} onSpeak={speak} onShare={share} onAgain={reset} sev={ts(condition.severity)}
            />
          )}
        </div>
      )}

      {hero && phase === "result" && result && condition && (
        <HeroResult d={result} c={condition} pct={pct} scanId={scanId} onAgain={reset} sev={ts(condition.severity)} />
      )}
      {hero && phase === "error" && error && (
        <p role="alert" className="mt-4 rounded-2xl bg-[var(--color-blight-soft)] p-4 text-[var(--color-ink)]">{error}</p>
      )}
    </div>
  );
}

function cropPreview(bmp: ImageBitmap, c: Crop) {
  const s = 720;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  cv.getContext("2d")!.drawImage(bmp, c.x, c.y, c.size, c.size, 0, 0, s, s);
  return cv.toDataURL("image/jpeg", 0.9);
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function IdleCopy() {
  const t = useTranslations("home");
  const how = t.raw("how") as { t: string; d: string }[];
  return (
    <ol className="space-y-6">
      {how.map((s, i) => (
        <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-4">
          <span className="num display grid h-10 w-10 place-items-center rounded-full bg-[var(--tint)] text-xl">{i + 1}</span>
          <div>
            <p className="title t-h4">{s.t}</p>
            <p className="mt-1 text-[var(--muted)] prose-measure">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ResultSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-6 w-32 rounded-full bg-[var(--tint)]" />
      <div className="h-14 w-3/4 rounded-xl bg-[var(--tint)]" />
      <div className="h-4 w-full rounded-full bg-[var(--tint)]" />
      <div className="h-28 w-full rounded-2xl bg-[var(--tint)]" />
    </div>
  );
}

function SeverityChip({ severity, label }: { severity: string; label: string }) {
  const cls =
    severity === "none"
      ? "bg-[var(--color-sprout)] text-[var(--color-leaf-deep)]"
      : severity === "watch"
        ? "bg-[var(--color-bloom-soft)] text-[var(--color-ink)]"
        : "bg-[var(--color-blight)] text-white";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-[640] ${cls}`}><span className="h-2 w-2 rounded-full bg-current" />{label}</span>;
}

function ConfidenceMeter({ pct, level }: { pct: number; level: "high" | "mid" | "low" }) {
  const t = useTranslations("tool");
  const color = level === "high" ? "var(--color-leaf)" : level === "mid" ? "var(--color-bloom)" : "var(--color-blight)";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[var(--muted)]">{t("confidence")}</span>
        <span className="num display text-3xl">{pct}%</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--tint)]" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("confidence")}>
        <div className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-grow)]" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-2 text-[0.98rem] text-[var(--muted)]">
        {level === "high" ? t("confidenceHigh") : level === "mid" ? t("confidenceMid") : t("confidenceLow")}
      </p>
    </div>
  );
}

function ResultPanel({
  d, c, pct, level, scanId, speaking, onSpeak, onShare, onAgain, sev,
}: {
  d: Diagnosis; c: (typeof CONDITIONS)[number]; pct: number; level: "high" | "mid" | "low"; scanId: string | null;
  speaking: boolean; onSpeak: () => void; onShare: () => void; onAgain: () => void; sev: string;
}) {
  const t = useTranslations("tool");
  const locale = useLocale();
  if (!d.supported) {
    return (
      <div className="rounded-[var(--radius-frame)] bg-[var(--surface)] p-7 ring-1 ring-[var(--rule)]">
        <p className="display text-[2.6rem]">{t("unsupportedTitle")}</p>
        <p className="mt-3 text-[var(--muted)] prose-measure">{t("unsupportedBody")}</p>
        {d.quality.issues.length > 0 && <QualityNotes issues={d.quality.issues} />}
        <button type="button" className="btn btn-primary mt-6" onClick={onAgain}>{t("again")}</button>
      </div>
    );
  }
  return (
    <article className="reveal space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SeverityChip severity={c.severity} label={sev} />
          <span className="text-[var(--muted)]">{tr(CROPS[c.crop], locale)} · <i>{c.scientific}</i></span>
        </div>
        <h2 className="display t-h1">{tr(c.name, locale)}</h2>
        <p className="text-[1.15rem] prose-measure">{tr(c.summary, locale)}</p>
      </header>

      {d.quality.issues.length > 0 && <QualityNotes issues={d.quality.issues} />}

      <div className="grid gap-6 rounded-3xl bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)] sm:grid-cols-2">
        <ConfidenceMeter pct={pct} level={level} />
        <div>
          <p className="text-[var(--muted)]">{t("also")}</p>
          <ul className="mt-2 space-y-2">
            {d.probs.slice(1, 4).map((p) => (
              <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-[0.98rem]">
                <span className="truncate">{tr(byId[p.id].name, locale)} <span className="text-[var(--muted)]">· {tr(CROPS[byId[p.id].crop], locale)}</span></span>
                <span className="num text-[var(--muted)]">{p.p < 0.01 ? "<1" : Math.round(p.p * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-leaf" onClick={onShare}>{t("share")}</button>
        {scanId && <Link className="btn btn-ghost" href={{ pathname: "/report", query: { scan: scanId } }}>{t("report")}</Link>}
        <button type="button" className="btn btn-ghost" onClick={onSpeak} aria-pressed={speaking}>{speaking ? t("stop") : t("listen")}</button>
      </div>

      <Section title={t("whatToDo")} items={c.act.now.map((x) => tr(x, locale))} tone="act" />
      <Section title={t("symptoms")} items={c.symptoms.map((x) => tr(x, locale))} />
      <Section title={t("prevent")} items={c.act.prevent.map((x) => tr(x, locale))} />
      {c.act.chemical && (
        <details className="group rounded-3xl bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)]">
          <summary className="title flex cursor-pointer list-none items-center justify-between text-[1.35rem]">
            {t("chemical")}
            <span className="transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <ul className="mt-3 space-y-2">{c.act.chemical.map((x, i) => <li key={i}>{tr(x, locale)}</li>)}</ul>
          <p className="mt-3 text-sm text-[var(--muted)]">{t("chemicalNote")}</p>
        </details>
      )}
      <Section title={t("lookalikes")} items={c.lookalikes.map((x) => tr(x, locale))} />

      <div className="flex flex-wrap items-center gap-4">
        <Link className="link font-[600]" href={`/diseases/${c.slug}`}>{t("fullGuide")}</Link>
        <button type="button" className="link font-[600]" onClick={onAgain}>{t("again")}</button>
      </div>
      <p className="text-sm text-[var(--muted)]">{t("time", { ms: Math.round(d.ms) })} ({d.backend === "webgpu" ? "WebGPU" : `WebAssembly${(backendInfo.wasm?.threads ?? 1) > 1 ? `, ${backendInfo.wasm?.threads} threads` : ""}`}) · model {d.modelVersion}. {t("disclaimer")}</p>
    </article>
  );
}

function HeroResult({ d, c, pct, scanId, onAgain, sev }: { d: Diagnosis; c: (typeof CONDITIONS)[number]; pct: number; scanId: string | null; onAgain: () => void; sev: string }) {
  const t = useTranslations("tool");
  const locale = useLocale();
  return (
    <div className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--rule)]" aria-live="polite">
      {d.supported ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <SeverityChip severity={c.severity} label={sev} />
            <span className="num display text-2xl">{pct}%</span>
          </div>
          <p className="display mt-3 text-[2.2rem]">{tr(c.name, locale)}</p>
          <p className="text-[var(--muted)]">{tr(CROPS[c.crop], locale)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn btn-leaf min-h-11" href={`/diseases/${c.slug}`}>{t("whatToDo")}</Link>
            {scanId && <Link className="btn btn-ghost min-h-11" href={{ pathname: "/report", query: { scan: scanId } }}>{t("report")}</Link>}
            <button type="button" className="btn btn-ghost min-h-11" onClick={onAgain}>{t("again")}</button>
          </div>
        </>
      ) : (
        <>
          <p className="title text-xl">{t("unsupportedTitle")}</p>
          <p className="mt-1 text-[var(--muted)]">{t("unsupportedBody")}</p>
          <button type="button" className="btn btn-ghost mt-3 min-h-11" onClick={onAgain}>{t("again")}</button>
        </>
      )}
    </div>
  );
}

function QualityNotes({ issues }: { issues: string[] }) {
  const t = useTranslations("tool.quality");
  return (
    <ul className="space-y-1 rounded-2xl bg-[var(--color-bloom-soft)] p-4 text-[var(--color-ink)]">
      {issues.map((i) => <li key={i}>{t(i as "blurry")}</li>)}
    </ul>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: "act" }) {
  return (
    <section>
      <h3 className="title t-h4">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.map((x, i) => (
          <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-3">
            <span aria-hidden="true" className={`mt-[0.55em] h-2.5 w-2.5 rounded-full ${tone === "act" ? "bg-[var(--color-bloom)]" : "bg-[var(--color-leaf)]"}`} />
            <span className="prose-measure">{x}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lets the user zoom/pan the crop when the leaf is small in the photo. */
function CropNudge({ bitmap, crop, onApply, label }: { bitmap: ImageBitmap; crop: Crop; onApply: (c: Crop) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const full = centerCrop(bitmap.width, bitmap.height);
  const [zoom, setZoom] = useState(full.size / crop.size);
  const [cx, setCx] = useState(crop.x + crop.size / 2);
  const [cy, setCy] = useState(crop.y + crop.size / 2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const t = useTranslations("tool");

  const size = full.size / zoom;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const c: Crop = {
    size,
    x: clamp(cx - size / 2, 0, bitmap.width - size),
    y: clamp(cy - size / 2, 0, bitmap.height - size),
  };

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const cv = canvasRef.current;
    cv.width = cv.height = 480;
    cv.getContext("2d")!.drawImage(bitmap, c.x, c.y, c.size, c.size, 0, 0, 480, 480);
  });

  if (!open) return <button type="button" className="btn btn-ghost min-h-11" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(10_20_15/0.7)] p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div className="w-full max-w-md rounded-[var(--radius-frame)] bg-[var(--bg)] p-5">
        <p className="text-[var(--muted)]">{t("frameHint")}</p>
        <canvas
          ref={canvasRef}
          className="viewfinder mt-3 aspect-square w-full touch-none rounded-2xl"
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx, cy }; }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const k = size / (e.currentTarget.clientWidth || 1);
            setCx(clamp(drag.current.cx - (e.clientX - drag.current.x) * k, size / 2, bitmap.width - size / 2));
            setCy(clamp(drag.current.cy - (e.clientY - drag.current.y) * k, size / 2, bitmap.height - size / 2));
          }}
          onPointerUp={() => { drag.current = null; }}
          onWheel={(e) => setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.08 : 0.92), 1, 4))}
        />
        <label className="mt-4 block">
          <span className="text-sm text-[var(--muted)]">{t("zoom")}</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-leaf)]" />
        </label>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary flex-1" onClick={() => { setOpen(false); onApply(c); }}>{t("analyse")}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>✕</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Idle viewfinder: cycles through real field photos with the model's actual
 * output (heatmap + label precomputed from the shipped model), so the hero
 * shows what the product does before anyone touches it.
 */
function HeroDemo() {
  const locale = useLocale();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    if (ref.current) io.observe(ref.current);
    const id = setInterval(() => { if (visible && !document.hidden) setI((x) => (x + 1) % CONDITIONS.length); }, 3600);
    return () => { clearInterval(id); io.disconnect(); };
  }, []);
  const res = SAMPLE_RESULTS as Record<string, { pred: string; p: number }>;
  return (
    <div ref={ref} className="absolute inset-0" aria-hidden="true">
      {CONDITIONS.map((c, k) => (
        <div key={c.id} className="demo-slide" data-on={k === i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.sample} alt="" className="absolute inset-0 h-full w-full object-cover" loading={k === 0 ? "eager" : "lazy"} />
          {c.severity !== "none" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/samples/heat/${c.id}.png`} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? "opacity-100 delay-[1100ms]" : "opacity-0"}`} />
          )}
          {k === i && (
            <>
              <div className="scanline scan-once" style={{ animationIterationCount: 1 }} />
              <div className="demo-chip absolute left-1/2 top-[18%] z-[3] -translate-x-1/2">
                <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2 text-[0.98rem] font-[650] text-[var(--color-ink)] shadow-lg">
                  <span className={`h-2.5 w-2.5 rounded-full ${c.severity === "none" ? "bg-[var(--color-leaf)]" : "bg-[var(--color-blight)]"}`} />
                  {tr(c.name, locale)}
                  <span className="num text-[var(--muted)]">{Math.min(99, Math.round(res[c.id].p * 100))}%</span>
                </span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
