"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function Calculator() {
  const t = useTranslations("calc");
  const [dose, setDose] = useState(2);
  const [unit, setUnit] = useState<"ml" | "g">("ml");
  const [tank, setTank] = useState(16);
  const [area, setArea] = useState(1);
  const [vol, setVol] = useState(200);

  const ok = dose > 0 && tank > 0 && area > 0 && vol > 0;
  const perTank = dose * tank;
  const water = vol * area;
  const tanks = Math.ceil(water / tank);
  const total = dose * water;
  const f = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} ${unit === "ml" ? "L" : "kg"}` : `${n.toFixed(n < 10 ? 1 : 0)} ${unit}`);

  const num = (label: string, value: number, set: (n: number) => void, suffix: string, step = 1) => (
    <label className="block">
      <span className="font-[600]">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <input type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => set(parseFloat(e.target.value))} className="field num" />
        <span className="shrink-0 text-[var(--muted)]">{suffix}</span>
      </span>
    </label>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
      <form className="space-y-5 rounded-[var(--radius-frame)] bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)]" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          {num(t("dose"), dose, setDose, t("doseUnit"), 0.1)}
          <label className="block">
            <span className="sr-only">{t("unit")}</span>
            <select className="field" value={unit} onChange={(e) => setUnit(e.target.value as "ml" | "g")}><option value="ml">ml</option><option value="g">g</option></select>
          </label>
        </div>
        {num(t("tank"), tank, setTank, t("litres"))}
        {num(t("area"), area, setArea, t("acres"), 0.1)}
        {num(t("volume"), vol, setVol, t("perAcre"), 10)}
        <p className="text-sm text-[var(--muted)]">{t("note")}</p>
      </form>
      <dl className="grid grid-cols-2 content-start gap-px overflow-hidden rounded-[var(--radius-frame)] bg-[var(--rule)] ring-1 ring-[var(--rule)]" aria-live="polite">
        {[
          [t("perTank"), ok ? f(perTank) : "–"],
          [t("tanks"), ok ? String(tanks) : "–"],
          [t("total"), ok ? f(total) : "–"],
          [t("water"), ok ? `${water.toFixed(0)} ${t("litres")}` : "–"],
        ].map(([k, v], i) => (
          <div key={k} className={`p-6 ${i === 0 ? "col-span-2 bg-[var(--color-leaf-deep)] text-white" : i === 3 ? "col-span-2 bg-[var(--surface)]" : "bg-[var(--surface)]"}`}>
            <dt className={i === 0 ? "text-white/80" : "text-[var(--muted)]"}>{k}</dt>
            <dd className={`num display mt-1 ${i === 0 ? "text-[4.5rem] leading-none" : "text-[2.4rem]"}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
