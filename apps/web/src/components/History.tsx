"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { byId, CROPS, t as tr } from "@/lib/diseases";
import { clearScans, deleteScan, exportAll, importAll, listScans, saveScan, type Scan } from "@/lib/store";

export function History() {
  const t = useTranslations("history");
  const tt = useTranslations("tool");
  const locale = useLocale();
  const [scans, setScans] = useState<Scan[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => listScans().then(setScans);
  useEffect(() => { load(); }, []);

  const download = async () => {
    const blob = new Blob([await exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leafcheckup-scans-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!scans) return <p className="text-[var(--muted)]">…</p>;
  const shown = scans.filter((s) => filter === "all" || (filter === "_" ? !s.supported : s.classId === filter));
  const classes = [...new Set(scans.filter((s) => s.supported).map((s) => s.classId))];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="hfilter">{t("filter")}</label>
        <select id="hfilter" className="field w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t("all")} ({scans.length})</option>
          {classes.map((c) => <option key={c} value={c}>{tr(byId[c].name, locale)} · {tr(CROPS[byId[c].crop], locale)}</option>)}
        </select>
        <button type="button" className="btn btn-ghost min-h-11" onClick={download} disabled={!scans.length}>{t("export")}</button>
        <button type="button" className="btn btn-ghost min-h-11" onClick={() => fileRef.current?.click()}>{t("import")}</button>
        <input ref={fileRef} type="file" accept="application/json" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) { try { await importAll(await f.text()); load(); } catch (err) { alert(String(err)); } }
          e.target.value = "";
        }} />
        {scans.length > 0 && (
          <button type="button" className="btn btn-ghost min-h-11 text-[var(--color-blight)]" onClick={async () => { if (confirm(t("confirmClear"))) { await clearScans(); load(); } }}>{t("clear")}</button>
        )}
      </div>

      {scans.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-frame)] bg-[var(--surface)] p-10 text-center ring-1 ring-[var(--rule)]">
          <p className="title text-2xl">{t("empty")}</p>
          <Link href="/diagnose" className="btn btn-primary mt-6">{t("start")}</Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => {
            const c = byId[s.classId];
            return (
              <li key={s.id} className="overflow-hidden rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--rule)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.thumb} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <div className="p-5">
                  <p className="text-sm text-[var(--muted)]">{new Date(s.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                  <p className="title mt-1 text-[1.4rem]">{s.supported ? tr(c.name, locale) : tt("unsupportedTitle")}</p>
                  {s.supported && <p className="text-[var(--muted)]">{tr(CROPS[c.crop], locale)} · <span className="num">{Math.min(99, Math.round(s.confidence * 100))}%</span></p>}
                  <label className="mt-3 block">
                    <span className="sr-only">{t("note")}</span>
                    <input className="field min-h-10 text-[0.95rem]" placeholder={t("notePh")} defaultValue={s.note ?? ""} maxLength={300}
                      onBlur={(e) => saveScan({ ...s, note: e.target.value.trim() || undefined })} />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <Link className="btn btn-ghost min-h-10 px-4 text-sm" href={{ pathname: "/report", query: { scan: s.id } }}>PDF</Link>
                    {s.supported && <Link className="btn btn-ghost min-h-10 px-4 text-sm" href={`/diseases/${c.slug}`}>{tt("whatToDo")}</Link>}
                    <button type="button" className="btn btn-ghost ml-auto min-h-10 px-4 text-sm" onClick={async () => { await deleteScan(s.id); load(); }}>{t("delete")}</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
