import { ViewTransition } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DiagnoseTool } from "@/components/DiagnoseTool";
import { ToolList } from "@/components/ToolList";
import { Link } from "@/i18n/navigation";
import { CONDITIONS, CROP_IDS, CROPS, t as tr } from "@/lib/diseases";
import { getModelFacts } from "@/lib/model/server";
import { RESEARCH } from "@/lib/site";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const ts = await getTranslations("severity");
  const facts = await getModelFacts();
  const acc = (facts.testAccuracy * 100).toFixed(1);
  const how = t.raw("how") as { t: string; d: string }[];
  const faq = t.raw("faq") as { q: string; a: string }[];
  const crops = CROP_IDS;

  return (
    <>
      {/* Hero: the tool is the hero */}
      <section className="vein-bg">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-24 lg:pt-16">
          <div className="flex flex-col justify-center">
            <h1 className="display t-hero text-[var(--color-leaf-deep)] dark:text-[var(--color-sprout)]">
              {t("title").split(/(?<=\.)\s+/).map((line) => <span key={line} className="block">{line}</span>)}
            </h1>
            <p className="mt-6 max-w-[38ch] t-lead">{t("sub")}</p>
            <p className="mt-6 flex items-center gap-3 text-[var(--muted)]">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-bloom)]" aria-hidden="true" />
              {t("crops")}
            </p>
          </div>
          <div className="w-full max-w-[560px] justify-self-center lg:justify-self-end">
            <DiagnoseTool variant="hero" />
          </div>
        </div>
      </section>

      {/* Specimen sheet: six conditions, real dataset photos */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="conditions">
        <div className="max-w-3xl">
          <h2 id="conditions" className="display t-h2">{t("conditionsTitle")}</h2>
          <p className="mt-4 t-lead muted prose-measure">{t("conditionsSub")}</p>
        </div>
        <div className="mt-12 space-y-14">
          {crops.map((crop) => (
            <div key={crop} className="grid gap-6 lg:grid-cols-[14rem_1fr]">
              <div>
                <p className="display text-[3rem] leading-none">{tr(CROPS[crop], locale)}</p>
                <p className="mt-1 italic text-[var(--muted)]">{CROPS[crop].scientific}</p>
              </div>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {CONDITIONS.filter((c) => c.crop === crop).map((c) => (
                  <li key={c.id}>
                    <Link href={`/diseases/${c.slug}`} className="group block">
                      <div className="overflow-hidden rounded-[22px] ring-1 ring-[var(--rule)]">
                        <ViewTransition name={`leaf-${c.slug}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.sample} alt={tr(c.name, locale)} loading="lazy" width={448} height={448} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                        </ViewTransition>
                      </div>
                      <div className="mt-3 flex items-baseline justify-between gap-3">
                        <p className="title t-h4 group-hover:underline">{tr(c.name, locale)}</p>
                        <span className={`shrink-0 text-sm font-[620] ${c.severity === "none" ? "text-[var(--color-leaf)]" : "text-[var(--color-blight)]"}`}>{ts(c.severity)}</span>
                      </div>
                      <p className="text-[var(--muted)]">{tr(c.kind, locale)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works: a real sequence */}
      <section className="border-y border-[var(--rule)] bg-[var(--surface)]" aria-labelledby="how">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 id="how" className="display t-h2">{t("howTitle")}</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {how.map((s, i) => (
              <li key={i}>
                <HowVisual step={i} severityLabel={ts("act")} />
                <h3 className="title t-h3 mt-6 flex items-baseline gap-3">
                  <span className="num display text-[var(--color-bloom)]" aria-hidden="true">{i + 1}</span>
                  {s.t}
                </h3>
                <p className="mt-2 muted prose-measure">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Evidence */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="evidence">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="evidence" className="display t-h2">{t("evidenceTitle")}</h2>
            <p className="mt-4 t-lead muted prose-measure">{t("evidenceSub")}</p>
            <p className="mt-6 text-[var(--muted)]">{t("pressLine")} <a className="link" href={RESEARCH.press[0].url} target="_blank" rel="noopener noreferrer">Read the article</a></p>
            <Link href="/research" className="btn btn-leaf mt-8">{t("readResearch")}</Link>
          </div>
          <dl className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            <Fact value={`${acc}%`} label={t("statAccuracy")} note={t("statAccuracyNote", { n: facts.testImages, lo: (facts.ci[0] * 100).toFixed(1), hi: (facts.ci[1] * 100).toFixed(1) })} />
            <Fact value={(RESEARCH.datasets[0].originals + RESEARCH.datasets[1].originals).toLocaleString("en-IN")} label={t("statDownloads")} note="IEEE DataPort and Mendeley Data, open access" />
            <Fact value={RESEARCH.patent.number} label={t("statPatent")} note={RESEARCH.patent.klass} />
            <Fact value="2" label={t("statPapers")} note="Springer CCIS (MIND 2025) · Discover Artificial Intelligence (2026)" />
          </dl>
        </div>
      </section>

      {/* Tools */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6" aria-labelledby="tools">
        <h2 id="tools" className="display t-h2">{t("toolsTitle")}</h2>
        <p className="mt-4 t-lead muted prose-measure">{t("toolsSub")}</p>
        <ToolList />
      </section>

      {/* Privacy band */}
      <section className="bg-[var(--color-leaf-deep)] text-[#eef4ea]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <h2 className="display t-h2">{t("privacyTitle")}</h2>
          <p className="text-[1.15rem] leading-relaxed text-[#d5e2d0]">{t("privacyBody", { mb: facts.modelMB })}</p>
        </div>
      </section>

      {/* Organisations */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-8 rounded-[var(--radius-frame)] bg-[var(--color-bloom-soft)] p-8 text-[var(--color-ink)] sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <h2 className="display t-h2">{t("orgTitle")}</h2>
            <p className="mt-4 text-[1.1rem] prose-measure">{t("orgBody")}</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/developers" className="btn btn-leaf">{t("orgCta")}</Link>
            <Link href="/about" className="btn bg-white/70 text-[var(--color-ink)] hover:bg-white">{t("orgCta2")}</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 pb-8 sm:px-6" aria-labelledby="faq">
        <h2 id="faq" className="display t-h2">{t("faqTitle")}</h2>
        <div className="mt-8 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {faq.map((f, i) => (
            <details key={i} className="group py-5">
              <summary className="title flex cursor-pointer list-none items-start justify-between gap-6 text-[1.4rem]">
                {f.q}
                <span className="mt-1 text-2xl leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-[var(--muted)] prose-measure">{f.a.replace("{acc}", acc)}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

/** Real pipeline stages for the leaf-miner sample: photo -> model heatmap -> result. */
function HowVisual({ step, severityLabel }: { step: number; severityLabel: string }) {
  const img = "/samples/ridge_gourd__leaf_miner.jpg";
  return (
    <div className="viewfinder relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[var(--color-leaf-deep)]" aria-hidden="true">
      <span className="vf-b" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover ${step === 2 ? "scale-110 blur-[2px] brightness-[0.55]" : ""}`} />
      {step === 1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/samples/heat/ridge_gourd__leaf_miner.png" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {step === 2 && (
        <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-white p-4 text-[var(--color-ink)] shadow-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-blight)] px-2.5 py-0.5 text-xs font-[650] text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" />{severityLabel}</span>
          <p className="display mt-1.5 text-[1.9rem]">Leaf miner</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-[var(--color-sprout)]"><div className="h-2 w-[99%] rounded-full bg-[var(--color-leaf)]" /></div>
            <span className="num font-[650]">99%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="grid gap-1 py-6 sm:grid-cols-[13rem_1fr] sm:gap-8">
      <dt className="num display text-[3.2rem] leading-none">{value}</dt>
      <dd>
        <p className="text-[1.1rem] font-[560]">{label}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{note}</p>
      </dd>
    </div>
  );
}
