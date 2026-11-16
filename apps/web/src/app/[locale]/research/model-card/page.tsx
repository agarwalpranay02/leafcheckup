import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { byId, CONDITIONS, COVERAGE, CROP_IDS, CROPS } from "@/lib/diseases";
import { getModelFacts } from "@/lib/model/server";

export const metadata: Metadata = { title: "Model card", description: "How LeafCheckup's leaf disease model was trained and evaluated, and where it fails." };

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-[var(--rule)] py-4 sm:grid-cols-[14rem_1fr]"><dt className="font-[620]">{k}</dt><dd className="text-[var(--muted)]">{v}</dd></div>
  );
}

export default async function ModelCard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const f = await getModelFacts();
  const ev = f.evaluation as Record<string, number | string | Record<string, unknown>>;
  const classes = Object.keys(f.perClass ?? {});
  const label = (id: string) => `${CROPS[byId[id].crop].en}: ${byId[id].name}`;
  const short = (id: string) => (byId[id].severity === "none" ? `${CROPS[byId[id].crop].en} healthy` : byId[id].short);
  return (
    <>
      <PageHeader title="Model card" sub={`LeafCheckup ${f.version}. Written for agronomists, researchers and developers who need to know what the model can and cannot do.`} />
      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 [&>*]:max-w-5xl" lang="en">
        <dl>
          <Row k="Task" v={`Single-leaf image classification into ${CONDITIONS.length} classes across ${CROP_IDS.length} crops: ${COVERAGE.coverageDetail} Images that do not look like these leaves are rejected.`} />
          <Row k="Architecture" v="EfficientNet-B0 (ImageNet pre-trained, timm), fine-tuned end-to-end at 224×224. Classifier head applied in the client so a class activation map can be computed from the same features." />
          <Row k="Training data" v="Original field photographs only: 600 ridge gourd leaves (IEEE DataPort 10.21227/469z-vm04) and 850 brinjal leaves (Mendeley Data 10.17632/c39p3k87g2.1), captured with smartphones on farms in Rajasthan. The published offline variants (thresholding, edge maps, etc.) were not used; online augmentation (crops, flips, rotation, colour jitter, blur, random erasing) was used instead." />
          <Row k="Split" v={`70/15/15 stratified group split by source leaf. ${f.split?.near_duplicates_merged ?? 0} near-duplicate photos (perceptual hash) were grouped; ${(f.split?.label_conflicts_removed.length ?? 0) * 2} photos that appeared under two different labels were removed.`} />
          <Row k="Test accuracy" v={`${pct(f.testAccuracy)} (95% bootstrap CI ${pct(f.ci[0])}–${pct(f.ci[1])}) on ${f.testImages} held-out leaves, with horizontal-flip test-time augmentation.`} />
          <Row k="Macro F1" v={f.macroF1.toFixed(3)} />
          <Row k="Calibration" v={`Temperature scaling fitted on validation. Expected calibration error on test: ${pct(Number(ev.test_ece_calibrated))}. Displayed confidence can be read as a probability.`} />
          <Row k="Not-a-leaf detection" v={`Mahalanobis distance in a 128-d PCA subspace of the features. On a synthetic set of ${ev.ood_synthetic_n} non-leaf images it rejects ${pct(Number(ev.ood_synthetic_rejection))} (AUROC ${Number(ev.auroc_synthetic).toFixed(3)}) while keeping ${pct(Number(ev.id_test_kept))} of real test leaves. A photo-quality check (sharpness, exposure, plant coverage) runs alongside.`} />
          <Row k="Runtime" v={`ONNX (fp32, ${f.modelMB} MB), run in the browser with ONNX Runtime Web (WebAssembly) in a worker. Max deviation from PyTorch: ${Number(ev.onnx_max_abs_err).toExponential(1)}. Static INT8 quantisation was evaluated and rejected because it lost accuracy.`} />
        </dl>

        {f.perClass && (
          <section>
            <h2 className="display t-h2">Per-class results</h2>
            <div className="mt-6 overflow-x-auto rounded-3xl ring-1 ring-[var(--rule)]">
              <table className="w-full min-w-[36rem] text-left">
                <thead className="bg-[var(--tint)]"><tr><th className="p-3">Class</th><th className="p-3 text-right">Precision</th><th className="p-3 text-right">Recall</th><th className="p-3 text-right">F1</th><th className="p-3 text-right">Test leaves</th></tr></thead>
                <tbody>
                  {classes.map((c) => {
                    const r = f.perClass![c];
                    return <tr key={c} className="border-t border-[var(--rule)]"><td className="p-3">{label(c)}</td><td className="num p-3 text-right">{r.precision.toFixed(3)}</td><td className="num p-3 text-right">{r.recall.toFixed(3)}</td><td className="num p-3 text-right">{r["f1-score"].toFixed(3)}</td><td className="num p-3 text-right">{r.support}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {f.confusion && (
          <section>
            <h2 className="display t-h2">Confusion matrix</h2>
            <p className="mt-2 text-[var(--muted)]">Rows: true class. Columns: predicted class.</p>
            <div className="mt-6 overflow-x-auto">
              <table className="text-center text-sm">
                <thead><tr><th />{classes.map((c) => <th key={c} className="max-w-[6rem] p-2 font-[600]">{short(c)}</th>)}</tr></thead>
                <tbody>
                  {f.confusion.map((row, i) => {
                    const tot = row.reduce((a, b) => a + b, 0) || 1;
                    return (
                      <tr key={i}>
                        <th className="p-2 text-left font-[600]">{short(classes[i])}</th>
                        {row.map((v, j) => (
                          <td key={j} className="num h-14 w-20 p-0">
                            <span className="grid h-full w-full place-items-center rounded-lg" style={{ background: i === j ? `color-mix(in oklab, var(--color-leaf) ${Math.round((v / tot) * 85)}%, transparent)` : v ? `color-mix(in oklab, var(--color-blight) ${Math.min(80, 20 + Math.round((v / tot) * 200))}%, transparent)` : "transparent", color: i === j && v / tot > 0.5 ? "#fff" : undefined }}>{v}</span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="display t-h2">Limitations</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-[var(--muted)] prose-measure">
            <li>Trained on leaves from a few districts of Rajasthan. Other varieties, regions, growth stages and camera types may reduce accuracy until more data is added.</li>
            <li>It only knows six classes. A leaf with a different disease (for example downy mildew) will be forced into the nearest known class unless the not-a-leaf detector catches it. Always read the symptom checklist.</li>
            <li>Little leaf is a whole-plant disease; a single leaf photo shows only part of the picture.</li>
            <li>The test set is small (217 leaves), so the accuracy interval is several points wide.</li>
            <li>The not-a-leaf detector was calibrated on synthetic non-leaf images, not on other crops.</li>
          </ul>
        </section>
        <section>
          <h2 className="display t-h2">Intended use</h2>
          <p className="mt-4 text-[var(--muted)] prose-measure">Decision support for growers, extension workers and agronomists: a fast first opinion and a structured field checklist. It is not a regulatory or laboratory diagnosis and must not be the sole basis for pesticide use.</p>
        </section>
      </div>
    </>
  );
}
