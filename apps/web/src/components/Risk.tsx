"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { level, scoreDay, type Day, type RiskKey } from "@/lib/risk";

type Place = { name: string; lat: number; lon: number };
const KEYS: RiskKey[] = ["whitefly", "leafminer", "blight", "leafhopper"];

export function Risk() {
  const t = useTranslations("risk");
  const [place, setPlace] = useState<Place | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "denied">("idle");

  const forecast = async (p: Place) => {
    setPlace(p);
    setMatches([]);
    setStatus("loading");
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum&timezone=auto&forecast_days=7`;
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      const j = await r.json();
      setDays(j.daily.time.map((date: string, i: number) => ({
        date, tmax: j.daily.temperature_2m_max[i], tmin: j.daily.temperature_2m_min[i],
        rh: j.daily.relative_humidity_2m_mean[i], rain: j.daily.precipitation_sum[i],
      })));
      setStatus("idle");
    } catch { setStatus("error"); }
  };

  const locate = () => {
    if (!navigator.geolocation) return setStatus("denied");
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => forecast({ name: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`, lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setStatus("denied"),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=en&countryCode=IN`);
      const j = await r.json();
      setMatches((j.results ?? []).map((x: { name: string; admin1?: string; latitude: number; longitude: number }) => ({ name: [x.name, x.admin1].filter(Boolean).join(", "), lat: x.latitude, lon: x.longitude })));
    } catch { setStatus("error"); }
  };

  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const cell = (s: number) => {
    const l = level(s);
    const cls = l === "high" ? "bg-[var(--color-blight)] text-white" : l === "moderate" ? "bg-[var(--color-bloom)] text-[var(--color-ink)]" : "bg-[var(--tint)] text-[var(--muted)]";
    return <span className={`inline-flex min-w-[5.5rem] justify-center rounded-full px-3 py-1 text-sm font-[620] ${cls}`}>{t(l)}</span>;
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <button type="button" className="btn btn-primary" onClick={locate}>{t("useLocation")}</button>
        <form onSubmit={search} className="flex flex-1 gap-2" role="search">
          <label className="flex-1">
            <span className="mb-1 block text-sm text-[var(--muted)]">{t("search")}</span>
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} maxLength={80} />
          </label>
          <button type="submit" className="btn btn-ghost self-end">→</button>
        </form>
      </div>
      {matches.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {matches.map((m) => <li key={`${m.lat},${m.lon}`}><button type="button" className="btn btn-ghost min-h-10 text-sm" onClick={() => forecast(m)}>{m.name}</button></li>)}
        </ul>
      )}
      {status === "loading" && <p role="status" className="text-[var(--muted)]">{t("loading")}</p>}
      {status === "error" && <p role="alert" className="text-[var(--color-blight)]">{t("error")}</p>}
      {status === "denied" && <p role="alert" className="text-[var(--color-blight)]">{t("denied")}</p>}
      {days && place && status === "idle" && (
        <section aria-label={place.name}>
          <h2 className="title text-2xl">{place.name}</h2>
          <div className="mt-4 overflow-x-auto rounded-3xl ring-1 ring-[var(--rule)]">
            <table className="w-full min-w-[46rem] text-left">
              <thead className="bg-[var(--tint)]">
                <tr><th className="p-3">{t("day")}</th><th className="p-3">°C</th><th className="p-3">RH</th><th className="p-3">mm</th>{KEYS.map((k) => <th key={k} className="p-3 text-sm">{t(k)}</th>)}</tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const s = scoreDay(d);
                  return (
                    <tr key={d.date} className="border-t border-[var(--rule)]">
                      <td className="p-3 font-[600]">{fmt(d.date)}</td>
                      <td className="num p-3">{Math.round(d.tmin)}–{Math.round(d.tmax)}</td>
                      <td className="num p-3">{Math.round(d.rh)}%</td>
                      <td className="num p-3">{d.rain.toFixed(1)}</td>
                      {KEYS.map((k) => <td key={k} className="p-3">{cell(s[k])}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <details className="rounded-3xl bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)]">
        <summary className="title cursor-pointer text-xl">{t("method")}</summary>
        <p className="mt-3 text-[var(--muted)] prose-measure">{t("methodBody")}</p>
      </details>
    </div>
  );
}
