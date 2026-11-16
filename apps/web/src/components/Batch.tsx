"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { byId, CONDITIONS, CROPS, t as tr } from "@/lib/diseases";
import { backendInfo, centerCrop, decode, diagnose, warmUp, webgpuAvailable, type Backend } from "@/lib/model/engine";
import type { BatchRow } from "./Report";

const LIMIT = 200;

export function Batch() {
  const t = useTranslations("batch");
  const locale = useLocale();
  const [rows, setRows] = useState<(BatchRow & { thumb: string })[]>([]);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [backend, setBackend] = useState<string | null>(null);

  const start = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    setNote(imgs.length > LIMIT ? t("limit") : null);
    const list = imgs.slice(0, LIMIT);
    setRows([]);
    setTotal(list.length);
    setRunning(true);
    // Large batches use the graphics card through WebGPU when available, else multi-threaded WebAssembly
    let ep: Backend = (await webgpuAvailable()) ? "webgpu" : "wasm";
    try { await warmUp(ep); } catch { ep = "wasm"; await warmUp("wasm"); }
    const label = () => (ep === "webgpu" ? "WebGPU (graphics card)" : `WebAssembly, ${backendInfo.wasm?.threads ?? 1} thread${(backendInfo.wasm?.threads ?? 1) > 1 ? "s" : ""}`);
    setBackend(label());
    for (const f of list) {
      try {
        const bmp = await decode(f);
        const c = centerCrop(bmp.width, bmp.height);
        let d;
        try {
          d = await diagnose(bmp, c, ep);
        } catch (err) {
          if (ep !== "webgpu") throw err;
          ep = "wasm";
          await warmUp("wasm");
          setBackend(label());
          d = await diagnose(bmp, c, ep);
        }
        const cv = document.createElement("canvas");
        cv.width = cv.height = 72;
        cv.getContext("2d")!.drawImage(bmp, c.x, c.y, c.size, c.size, 0, 0, 72, 72);
        bmp.close();
        setRows((r) => [...r, { name: f.name, classId: d.classId, confidence: d.confidence, supported: d.supported, thumb: cv.toDataURL("image/jpeg", 0.7) }]);
      } catch {
        setRows((r) => [...r, { name: f.name, classId: CONDITIONS[0].id, confidence: 0, supported: false, thumb: "" }]);
      }
    }
    setRunning(false);
  };

  const csv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const head = ["file", "supported", "crop", "condition", "confidence"].join(",");
    const lines = rows.map((r) => [esc(r.name), r.supported, r.supported ? byId[r.classId].crop : "", r.supported ? r.classId : "", r.confidence.toFixed(4)].join(","));
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leafcheckup-batch-${Date.now()}.csv`;
    a.click();
  };

  const counts = CONDITIONS.map((c) => ({ c, n: rows.filter((r) => r.supported && r.classId === c.id).length })).filter((x) => x.n);
  const unsupported = rows.filter((r) => !r.supported).length;
  const max = Math.max(1, ...counts.map((x) => x.n), unsupported);

  return (
    <div>
      {!rows.length && !running ? (
        <div
          className={`grid min-h-72 place-items-center rounded-[var(--radius-frame)] border-2 border-dashed p-10 text-center ${over ? "border-[var(--color-bloom)] bg-[var(--color-bloom-soft)]" : "border-[var(--rule)] bg-[var(--surface)]"}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); start(Array.from(e.dataTransfer.files)); }}
        >
          <div>
            <p className="title text-2xl">{t("drop")}</p>
            <button type="button" className="btn btn-primary mt-5" onClick={() => inputRef.current?.click()}>{t("pick")}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <p className="title text-xl" role="status">{t("running", { done: rows.length, total })}</p>
            ) : (
              <>
                <button type="button" className="btn btn-leaf" onClick={csv}>{t("csv")}</button>
                <Link className="btn btn-ghost" href={{ pathname: "/report", query: { batch: "1" } }} onClick={() => sessionStorage.setItem("leafcheckup-batch", JSON.stringify(rows.map((r) => ({ name: r.name, classId: r.classId, confidence: r.confidence, supported: r.supported }))))}>{t("pdf")}</Link>
                <button type="button" className="btn btn-ghost" onClick={() => { setRows([]); setTotal(0); }}>{t("clear")}</button>
              </>
            )}
            {note && <p className="text-[var(--muted)]">{note}</p>}
            {backend && <p className="t-small ml-auto rounded-full bg-[var(--tint)] px-3 py-1 text-[var(--muted)]">Running on {backend}</p>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--tint)]">
            <div className="h-full bg-[var(--color-leaf)] transition-[width]" style={{ width: `${total ? (rows.length / total) * 100 : 0}%` }} />
          </div>
          <section aria-labelledby="bsum">
            <h2 id="bsum" className="title text-2xl">{t("summary")}</h2>
            <ul className="mt-4 space-y-2">
              {counts.map(({ c, n }) => (
                <li key={c.id} className="grid grid-cols-[minmax(10rem,16rem)_1fr_3rem] items-center gap-3">
                  <span className="truncate">{tr(c.name, locale)} <span className="text-[var(--muted)]">· {tr(CROPS[c.crop], locale)}</span></span>
                  <span className="h-3 rounded-full bg-[var(--tint)]"><span className={`block h-3 rounded-full ${c.severity === "none" ? "bg-[var(--color-leaf)]" : "bg-[var(--color-blight)]"}`} style={{ width: `${(n / max) * 100}%` }} /></span>
                  <span className="num text-right">{n}</span>
                </li>
              ))}
              {unsupported > 0 && (
                <li className="grid grid-cols-[minmax(10rem,16rem)_1fr_3rem] items-center gap-3">
                  <span>{t("unsupported")}</span>
                  <span className="h-3 rounded-full bg-[var(--tint)]"><span className="block h-3 rounded-full bg-[var(--muted)]" style={{ width: `${(unsupported / max) * 100}%` }} /></span>
                  <span className="num text-right">{unsupported}</span>
                </li>
              )}
            </ul>
          </section>
          <div className="overflow-x-auto rounded-3xl ring-1 ring-[var(--rule)]">
            <table className="w-full min-w-[34rem] text-left">
              <thead className="bg-[var(--tint)]"><tr><th className="p-3">{t("file")}</th><th className="p-3">{t("result")}</th><th className="p-3 text-right">{t("conf")}</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--rule)]">
                    <td className="p-3">
                      <span className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.thumb && <img src={r.thumb} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                        <span className="max-w-[16rem] truncate">{r.name}</span>
                      </span>
                    </td>
                    <td className="p-3">{r.supported ? tr(byId[r.classId].name, locale) : <span className="text-[var(--muted)]">{t("unsupported")}</span>}</td>
                    <td className="num p-3 text-right">{r.supported ? `${Math.min(99, Math.round(r.confidence * 100))}%` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { start(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
  );
}
