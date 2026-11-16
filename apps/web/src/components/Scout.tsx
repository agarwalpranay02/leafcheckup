"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { byId, CONDITIONS, CROP_IDS, CROPS, t as tr } from "@/lib/diseases";
import { deleteSurvey, listScans, listSurveys, saveSurvey, uid, type Scan, type Survey } from "@/lib/store";
import { DiagnoseTool, type ToolResult } from "./DiagnoseTool";

export function Scout() {
  const t = useTranslations("scout");
  const locale = useLocale();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [active, setActive] = useState<Survey | null>(null);
  const [name, setName] = useState("");
  const [crop, setCrop] = useState<Survey["crop"]>(CROP_IDS[0]);
  const [useGeo, setUseGeo] = useState(false);

  const load = useCallback(async () => { setSurveys(await listSurveys()); setScans(await listScans()); }, []);

  // Keep the screen on while walking the field with a survey open
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release().catch(() => {}); };
  }, [active]);
  useEffect(() => {
    let alive = true;
    Promise.all([listSurveys(), listScans()]).then(([a, b]) => { if (alive) { setSurveys(a); setScans(b); } });
    return () => { alive = false; };
  }, []);

  const start = async () => {
    let geo: Survey["geo"];
    if (useGeo && navigator.geolocation) {
      geo = await new Promise((res) => navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) }), () => res(undefined), { timeout: 8000 }));
    }
    const s: Survey = { id: uid(), at: Date.now(), name: name.trim() || new Date().toLocaleDateString(), crop, scanIds: [], geo, done: false };
    await saveSurvey(s);
    setActive(s);
  };

  const onResult = useCallback(async ({ scan }: ToolResult) => {
    setActive((cur) => {
      if (!cur) return cur;
      const next = { ...cur, scanIds: [...cur.scanIds, scan.id] };
      saveSurvey(next);
      return next;
    });
    setScans((s) => [scan, ...s]);
  }, []);

  const stats = (s: Survey) => {
    const mine = scans.filter((x) => s.scanIds.includes(x.id) && x.supported);
    const diseased = mine.filter((x) => byId[x.classId].severity !== "none").length;
    const by = CONDITIONS.filter((c) => c.crop === s.crop).map((c) => ({ c, n: mine.filter((x) => x.classId === c.id).length }));
    return { n: mine.length, inc: mine.length ? diseased / mine.length : 0, by };
  };

  if (active) {
    const st = stats(active);
    const advice = st.inc < 0.1 ? t("adviceLow") : st.inc < 0.3 ? t("adviceMid") : t("adviceHigh");
    return (
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-[var(--muted)]">{tr(CROPS[active.crop], locale)}</p>
          <h2 className="display t-h2">{active.name}</h2>
          <div className="mt-6 max-w-[520px]"><DiagnoseTool key={active.scanIds.length} variant="hero" surveyId={active.id} onResult={onResult} /></div>
        </div>
        <div className="space-y-6">
          <div className="rounded-[var(--radius-frame)] bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)]">
            <p className="text-[var(--muted)]">{t("incidence")}</p>
            <p className="num display text-[5rem] leading-none">{Math.round(st.inc * 100)}%</p>
            <p className="mt-2">{t("scanned", { n: st.n })}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("incidenceNote")}</p>
          </div>
          <div>
            <h3 className="title text-xl">{t("byCondition")}</h3>
            <ul className="mt-3 space-y-2">
              {st.by.map(({ c, n }) => (
                <li key={c.id} className="flex justify-between border-b border-[var(--rule)] pb-2"><span>{tr(c.name, locale)}</span><span className="num">{n}</span></li>
              ))}
            </ul>
          </div>
          {st.n >= 5 && <p className="rounded-2xl bg-[var(--color-bloom-soft)] p-4 text-[var(--color-ink)]"><b>{t("advice")}:</b> {advice}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-leaf" onClick={async () => { await saveSurvey({ ...active, done: true }); setActive(null); load(); }}>{t("finish")}</button>
            <Link className="btn btn-ghost" href={{ pathname: "/report", query: { survey: active.id } }}>{t("report")}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
      <form className="space-y-5 rounded-[var(--radius-frame)] bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)]" onSubmit={(e) => { e.preventDefault(); start(); }}>
        <label className="block">
          <span className="font-[600]">{t("plot")}</span>
          <input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("plotPh")} maxLength={80} />
        </label>
        <fieldset>
          <legend className="font-[600]">{t("crop")}</legend>
          <div className="mt-2 flex gap-2">
            {CROP_IDS.map((c) => (
              <label key={c} className={`btn min-h-11 cursor-pointer ${crop === c ? "btn-leaf" : "btn-ghost"}`}>
                <input type="radio" name="crop" value={c} checked={crop === c} onChange={() => setCrop(c)} className="sr-only" />
                {tr(CROPS[c], locale)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={useGeo} onChange={(e) => setUseGeo(e.target.checked)} className="h-5 w-5 accent-[var(--color-leaf)]" />
          {t("location")}
        </label>
        <button type="submit" className="btn btn-primary w-full">{t("start")}</button>
      </form>
      <section aria-labelledby="saved">
        <h2 id="saved" className="title text-2xl">{t("surveys")}</h2>
        {surveys.length === 0 ? <p className="mt-3 text-[var(--muted)]">{t("none")}</p> : (
          <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {surveys.map((s) => {
              const st = stats(s);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="title truncate text-xl">{s.name}</p>
                    <p className="text-sm text-[var(--muted)]">{tr(CROPS[s.crop], locale)} · {new Date(s.at).toLocaleDateString("en-IN")} · {t("scanned", { n: st.n })}</p>
                  </div>
                  <p className="num display text-3xl">{Math.round(st.inc * 100)}%</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-ghost min-h-10 px-4 text-sm" onClick={() => setActive(s)}>{t("scan")}</button>
                    <Link className="btn btn-ghost min-h-10 px-4 text-sm" href={{ pathname: "/report", query: { survey: s.id } }}>PDF</Link>
                    <button type="button" className="btn btn-ghost min-h-10 px-4 text-sm" onClick={async () => { await deleteSurvey(s.id); load(); }}>{t("delete")}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
