import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { getModelFacts } from "@/lib/model/server";
import { RESEARCH } from "@/lib/site";
import { share } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "research" });
  return share({ title: t("title"), description: t("sub"), alternates: { canonical: "/research" } });
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default async function Research({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("research");
  const f = await getModelFacts();
  return (
    <>
      <PageHeader title={t("title")} sub={t("sub")} />
      <div className="mx-auto max-w-7xl space-y-24 px-4 sm:px-6">
        {/* Benchmark */}
        <section aria-labelledby="bench">
          <h2 id="bench" className="display t-h2">{t("benchmark")}</h2>
          <p className="mt-4 t-lead muted prose-measure">{t("benchSub")}</p>
          <div className="mt-8 overflow-x-auto rounded-3xl ring-1 ring-[var(--rule)]">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="bg-[var(--tint)]">
                <tr><th className="p-4">{t("model")}</th><th className="p-4">{t("protocol")}</th><th className="p-4 text-right">{t("acc")}</th><th className="p-4 text-right">{t("f1")}</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--rule)]">
                  <td className="p-4">DenseNet121 + XGBoost (MIND 2025, as published)</td><td className="p-4">{t("leaky")}</td>
                  <td className="num p-4 text-right">92.0%</td><td className="num p-4 text-right">0.92</td>
                </tr>
                {f.bench && (
                  <>
                    <tr className="border-t border-[var(--rule)]">
                      <td className="p-4">DenseNet121 + XGBoost (re-run)</td><td className="p-4">{t("leaky")}<span className="block text-sm text-[var(--muted)]">test leaves also in train: {f.bench.paper_protocol.test_leaves_also_in_train}</span></td>
                      <td className="num p-4 text-right">{pct(f.bench.paper_protocol.accuracy)}</td><td className="num p-4 text-right">{f.bench.paper_protocol.macro_f1.toFixed(3)}</td>
                    </tr>
                    <tr className="border-t border-[var(--rule)]">
                      <td className="p-4">DenseNet121 + XGBoost (re-run), ridge gourd</td><td className="p-4">{t("leakfree")}<span className="block text-sm text-[var(--muted)]">{f.bench.leak_free_protocol.n_test} test leaves</span></td>
                      <td className="num p-4 text-right">{pct(f.bench.leak_free_protocol.accuracy)}</td><td className="num p-4 text-right">{f.bench.leak_free_protocol.macro_f1.toFixed(3)}</td>
                    </tr>
                    {f.bench.leafcheckup_ridge_gourd_subset && (
                      <tr className="border-t border-[var(--rule)] bg-[var(--color-sprout)]/50 font-[620]">
                        <td className="p-4">LeafCheckup EfficientNet-B0, ridge gourd</td><td className="p-4">{t("leakfree")}<span className="block text-sm font-normal text-[var(--muted)]">same {f.bench.leafcheckup_ridge_gourd_subset.n_test} test leaves</span></td>
                        <td className="num p-4 text-right">{pct(f.bench.leafcheckup_ridge_gourd_subset.accuracy)}</td><td className="num p-4 text-right">{f.bench.leafcheckup_ridge_gourd_subset.macro_f1.toFixed(3)}</td>
                      </tr>
                    )}
                  </>
                )}
                <tr className="border-t border-[var(--rule)] bg-[var(--color-sprout)]/50 font-[620]">
                  <td className="p-4">LeafCheckup EfficientNet-B0, both crops (6 classes)</td><td className="p-4">{t("leakfree")}</td>
                  <td className="num p-4 text-right">{pct(f.testAccuracy)}</td><td className="num p-4 text-right">{f.macroF1.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">LeafCheckup: {f.testImages} held-out leaves, 95% bootstrap interval {pct(f.ci[0])}–{pct(f.ci[1])}. Ridge-gourd-only rows use the ridge gourd test leaves. <Link className="link" href="/research/model-card">{t("modelCard")}</Link></p>
          {f.split && (
            <div className="mt-8 rounded-3xl bg-[var(--color-bloom-soft)] p-6 text-[var(--color-ink)]">
              <h3 className="title text-xl">{t("dataQuality")}</h3>
              <p className="mt-2 prose-measure">{t("dataQualityBody", { conflicts: f.split.label_conflicts_removed.length * 2, dups: f.split.near_duplicates_merged })}</p>
              <ul className="mt-3 grid gap-1 font-mono text-sm sm:grid-cols-2">
                {f.split.label_conflicts_removed.map(([a, b]) => <li key={a}>{a} ≡ {b}</li>)}
              </ul>
            </div>
          )}
        </section>

        {/* Papers */}
        <section aria-labelledby="papers">
          <h2 id="papers" className="display t-h2">{t("papers")}</h2>
          <ul className="mt-8 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {RESEARCH.papers.map((p) => (
              <li key={p.id} className="grid gap-4 py-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="title t-h3 prose-measure">{p.title}</p>
                  <p className="text-[var(--muted)]">{p.venue}</p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {p.url && <a className="btn btn-leaf min-h-10 px-4 text-sm" href={p.url} target="_blank" rel="noopener noreferrer">{t("read")}</a>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Datasets */}
        <section aria-labelledby="datasets">
          <h2 id="datasets" className="display t-h2">{t("datasets")}</h2>
          <ul className="mt-8 grid gap-6 lg:grid-cols-2">
            {RESEARCH.datasets.map((d) => (
              <li key={d.id} className="rounded-[var(--radius-frame)] bg-[var(--surface)] p-7 ring-1 ring-[var(--rule)]">
                <p className="title t-h4">{d.title}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <div><dt className="text-sm text-[var(--muted)]">Original photos</dt><dd className="num display text-3xl">{d.originals}</dd></div>
                  <div><dt className="text-sm text-[var(--muted)]">Images incl. variants</dt><dd className="num display text-3xl">{d.images.toLocaleString("en-IN")}</dd></div>
                  {d.downloads && <div><dt className="text-sm text-[var(--muted)]">Downloads</dt><dd className="num display text-3xl">{d.downloads.toLocaleString("en-IN")}</dd></div>}
                  <div><dt className="text-sm text-[var(--muted)]">Collected in</dt><dd>{d.where}</dd></div>
                </dl>
                <p className="mt-4 text-sm text-[var(--muted)]">{d.host} · DOI <a className="link" href={d.url} target="_blank" rel="noopener noreferrer">{d.doi}</a> · {d.license}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Patent + press */}
        <section className="grid gap-10 lg:grid-cols-2">
          <div aria-labelledby="patent">
            <h2 id="patent" className="display t-h2">{t("patent")}</h2>
            <p className="num display mt-6 text-[3.4rem] leading-none text-[var(--color-leaf)]">{RESEARCH.patent.number}</p>
            <p className="title mt-4 text-xl prose-measure">{RESEARCH.patent.title}</p>
            <p className="mt-2 text-[var(--muted)]">{RESEARCH.patent.office} · {RESEARCH.patent.klass} · registered {RESEARCH.patent.filed}, certified {RESEARCH.patent.certified}</p>
          </div>
          <div aria-labelledby="press">
            <h2 id="press" className="display t-h2">{t("press")}</h2>
            <figure className="mt-6 border-l-4 border-[var(--color-bloom)] pl-6">
              <blockquote className="title text-2xl">मोबाइल से होगी रोग की पहचान, किसान बचाएंगे फसल</blockquote>
              <figcaption className="mt-3 text-[var(--muted)]">Punjab Kesari, Jaipur, 10 October 2025. Report on the ridge gourd study, the real-time data collection device design and the farmer app.</figcaption>
            </figure>
          </div>
        </section>

      </div>
    </>
  );
}
