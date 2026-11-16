"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { byId, CROPS, t as tr } from "@/lib/diseases";
import { getScan, getSurvey, listScans, type Scan, type Survey } from "@/lib/store";
import { SITE } from "@/lib/site";
import { LogoMark } from "./Logo";

export type BatchRow = { name: string; classId: string; confidence: number; supported: boolean; thumb?: string };

/**
 * Printable report. Rendered as HTML and printed by the browser ("Save as PDF"),
 * which shapes Devanagari correctly, unlike JS PDF generators.
 */
export function Report() {
  const q = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("tool");
  const tsv = useTranslations("scout");
  const tb = useTranslations("batch");
  const sev = useTranslations("severity");
  const [scan, setScan] = useState<Scan | null>(null);
  const [survey, setSurvey] = useState<{ s: Survey; scans: Scan[] } | null>(null);
  const [batch, setBatch] = useState<BatchRow[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      const scanId = q.get("scan");
      const surveyId = q.get("survey");
      if (scanId) {
        const s = await getScan(scanId);
        if (s) { setScan(s); setState("ready"); return; }
      } else if (surveyId) {
        const s = await getSurvey(surveyId);
        if (s) {
          const all = await listScans();
          setSurvey({ s, scans: all.filter((x) => s.scanIds.includes(x.id)) });
          setState("ready");
          return;
        }
      } else if (q.get("batch")) {
        const raw = sessionStorage.getItem("leafcheckup-batch");
        if (raw) { setBatch(JSON.parse(raw)); setState("ready"); return; }
      }
      setState("missing");
    })();
  }, [q]);

  if (state === "loading") return <p className="p-10 text-center text-[var(--muted)]">…</p>;
  if (state === "missing") return <p className="p-10 text-center">{t("error")}</p>;

  const date = new Date(scan?.at ?? survey?.s.at ?? now).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-[210mm] px-4 py-8 print:p-0">
      <div className="no-print mb-6 flex gap-3">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>{t("report")}</button>
        <button type="button" className="btn btn-ghost" onClick={() => history.back()}>←</button>
      </div>
      <div className="rounded-2xl bg-white p-8 text-[#13231b] shadow-sm ring-1 ring-[var(--rule)] print:shadow-none print:ring-0">
        <header className="flex items-start justify-between border-b border-[#cfdacb] pb-4">
          <div className="flex items-center gap-2">
            <LogoMark className="h-9 w-9 text-[#2c5a44]" />
            <div>
              <p className="title text-2xl">LeafCheckup</p>
              <p className="text-xs text-[#3b4a42]">{SITE.url.replace("https://", "")}</p>
            </div>
          </div>
          <p className="text-right text-sm text-[#3b4a42]">{date}</p>
        </header>

        {scan && (() => {
          const c = byId[scan.classId];
          return (
            <section className="mt-6 grid grid-cols-[180px_1fr] gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={scan.thumb} alt="" className="h-[180px] w-[180px] rounded-xl object-cover" />
              <div>
                {scan.supported ? (
                  <>
                    <p className="text-sm">{tr(CROPS[c.crop], locale)} · {sev(c.severity)}</p>
                    <h1 className="display mt-1 text-5xl">{tr(c.name, locale)}</h1>
                    <p className="mt-1 text-sm italic">{c.scientific}</p>
                    <p className="mt-3">{t("confidence")}: <b className="num">{Math.min(99, Math.round(scan.confidence * 100))}%</b></p>
                    <p className="mt-1 text-sm">{t("also")}: {scan.probs.slice(1, 3).map((p) => `${tr(byId[p.id].name, locale)} ${p.p < 0.01 ? "<1" : Math.round(p.p * 100)}%`).join(", ")}</p>
                  </>
                ) : (
                  <h1 className="title text-3xl">{t("unsupportedTitle")}</h1>
                )}
                {scan.note && <p className="mt-3 rounded-lg bg-[#f5f8f2] p-3 text-sm">{scan.note}</p>}
              </div>
              {scan.supported && (
                <div className="col-span-2 mt-2 grid grid-cols-2 gap-6 text-[0.95rem]">
                  <div>
                    <h2 className="title text-xl">{t("whatToDo")}</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5">{c.act.now.map((x, i) => <li key={i}>{tr(x, locale)}</li>)}</ul>
                    <h2 className="title mt-4 text-xl">{t("symptoms")}</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5">{c.symptoms.map((x, i) => <li key={i}>{tr(x, locale)}</li>)}</ul>
                  </div>
                  <div>
                    <h2 className="title text-xl">{t("prevent")}</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5">{c.act.prevent.map((x, i) => <li key={i}>{tr(x, locale)}</li>)}</ul>
                    {c.act.chemical && (
                      <>
                        <h2 className="title mt-4 text-xl">{t("chemical")}</h2>
                        <ul className="mt-2 list-disc space-y-1 pl-5">{c.act.chemical.map((x, i) => <li key={i}>{tr(x, locale)}</li>)}</ul>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {survey && <SurveyReport survey={survey.s} scans={survey.scans} locale={locale} t={tsv} />}

        {batch && (
          <section className="mt-6">
            <h1 className="display t-h2">{tb("title")}</h1>
            <Summary rows={batch} locale={locale} unsupported={tb("unsupported")} />
            <table className="mt-6 w-full text-left text-sm">
              <thead><tr className="border-b border-[#cfdacb]"><th className="py-2">{tb("file")}</th><th>{tb("result")}</th><th className="text-right">{tb("conf")}</th></tr></thead>
              <tbody>
                {batch.map((r, i) => (
                  <tr key={i} className="border-b border-[#e5ece2]">
                    <td className="max-w-[60mm] truncate py-1.5">{r.name}</td>
                    <td>{r.supported ? `${tr(byId[r.classId].name, locale)} (${tr(CROPS[byId[r.classId].crop], locale)})` : tb("unsupported")}</td>
                    <td className="num text-right">{r.supported ? `${Math.round(r.confidence * 100)}%` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-8 border-t border-[#cfdacb] pt-3 text-xs text-[#3b4a42]">
          {t("disclaimer")} · Model {scan?.modelVersion ?? ""}
        </footer>
      </div>
    </div>
  );
}

function Summary({ rows, locale, unsupported }: { rows: BatchRow[]; locale: string; unsupported: string }) {
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r.supported ? r.classId : "_", (counts.get(r.supported ? r.classId : "_") ?? 0) + 1));
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
      {[...counts.entries()].map(([k, v]) => (
        <li key={k} className="rounded-lg bg-[#f5f8f2] p-3">
          <span className="num display text-2xl">{v}</span>{" "}
          {k === "_" ? unsupported : tr(byId[k].name, locale)}
        </li>
      ))}
    </ul>
  );
}

function SurveyReport({ survey, scans, locale, t }: { survey: Survey; scans: Scan[]; locale: string; t: ReturnType<typeof useTranslations> }) {
  const valid = scans.filter((s) => s.supported);
  const diseased = valid.filter((s) => byId[s.classId].severity !== "none").length;
  const inc = valid.length ? Math.round((diseased / valid.length) * 100) : 0;
  return (
    <section className="mt-6">
      <p className="text-sm">{tr(CROPS[survey.crop], locale)}{survey.geo ? ` · ${survey.geo.lat.toFixed(4)}, ${survey.geo.lon.toFixed(4)}` : ""}</p>
      <h1 className="display t-h2">{survey.name}</h1>
      <p className="mt-4 text-lg">{t("incidence")}: <b className="num display text-3xl">{inc}%</b> · {t("scanned", { n: valid.length })}</p>
      <Summary rows={valid.map((s) => ({ name: s.id, classId: s.classId, confidence: s.confidence, supported: true }))} locale={locale} unsupported="" />
      <div className="mt-6 grid grid-cols-6 gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {scans.slice(0, 36).map((s) => <img key={s.id} src={s.thumb} alt="" className="aspect-square w-full rounded object-cover" />)}
      </div>
    </section>
  );
}
