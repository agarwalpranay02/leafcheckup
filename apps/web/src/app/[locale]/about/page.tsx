import { COVERAGE } from "@/lib/diseases";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { getModelFacts } from "@/lib/model/server";
import { RESEARCH, SITE } from "@/lib/site";
import { share } from "@/lib/seo";

export const metadata: Metadata = share({
  title: "About",
  description: "How LeafCheckup went from a field dataset in Rajasthan to a published model and a free, on-device diagnosis app.",
  alternates: { canonical: "/about" },
});

const STACK: { area: string; items: string[] }[] = [
  { area: "Machine learning", items: ["PyTorch", "timm (EfficientNet-B0)", "Group-aware leak-free evaluation", "Temperature calibration", "Mahalanobis out-of-distribution detection", "Class activation maps", "ONNX export", "scikit-learn, XGBoost baselines"] },
  { area: "In the browser", items: ["Next.js 16 and React 19", "TypeScript", "ONNX Runtime Web in a Web Worker", "Multi-threaded WebAssembly (cross-origin isolation)", "WebGPU for batch scans", "Live camera AI (getUserMedia)", "Installable PWA with offline service worker", "Web Share Target, Wake Lock, Speech Synthesis", "View Transitions", "IndexedDB storage", "Tailwind CSS 4"] },
  { area: "Backend", items: ["Next.js route handlers as API gateway", "FastAPI + ONNX Runtime inference service", "better-auth (magic link, Google)", "Drizzle ORM on Postgres (PGlite locally)", "Hashed API keys, quotas, rate limiting", "Prometheus metrics, OpenTelemetry tracing"] },
  { area: "Hosting", items: ["Vercel edge network and serverless functions", "Neon serverless Postgres", "Render container for the inference API", "Self-hosted option: Docker Compose, Caddy, Cloudflare WAF and CDN, hardened Ubuntu"] },
  { area: "Security and DevOps", items: ["Strict nonce-based Content-Security-Policy", "HSTS, COOP/COEP cross-origin isolation, CSRF guard", "Docker (non-root, read-only filesystems)", "GitHub Actions CI/CD", "CodeQL, gitleaks, Trivy, npm audit, pip-audit", "Playwright end-to-end tests on desktop and mobile"] },
];

export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const f = await getModelFacts();
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const rg = f.bench?.leafcheckup_ridge_gourd_subset;
  const results = [
    { v: rg ? pct(rg.accuracy) : pct(f.testAccuracy), l: "accuracy on unseen ridge gourd leaves", n: `vs ${f.bench ? pct(f.bench.leak_free_protocol.accuracy) : "92.0%"} for the published DenseNet121 + XGBoost method on the same leaves` },
    { v: pct(f.testAccuracy), l: `accuracy across ${COVERAGE.cropCount} crops and ${COVERAGE.conditionCount} conditions`, n: `${f.testImages} held-out leaves, 95% interval ${pct(f.ci[0])}–${pct(f.ci[1])}` },
    { v: Number(f.evaluation.auroc_synthetic).toFixed(3), l: "AUROC for rejecting photos that aren't leaves", n: "Mahalanobis distance in the model's feature space" },
    { v: "< 1 s", l: "per diagnosis, on the phone, offline", n: "No photo is ever uploaded" },
  ];
  return (
    <>
      <PageHeader title="About LeafCheckup" sub="A health checkup for crop leaves. It is a research project turned into a working, free product: crop disease diagnosis that runs on a farmer's phone." />
      <div className="mx-auto max-w-7xl space-y-24 px-4 sm:px-6">
        <section className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <h2 className="display t-h2">Why it exists</h2>
          <div className="space-y-4 t-lead prose-measure">
            <p>Most plant-disease AI is trained on tomato, potato and grape, because that is where the big public datasets are. Farmers growing local crops like ridge gourd get nothing. On farms around Jaipur, growers say diseases usually go unnoticed until they have already spread.</p>
            <p>So the work started in the field: photographing leaves on farms in Rajasthan, labelling them, and publishing the datasets openly. The ridge gourd set has been downloaded {RESEARCH.datasets[0].downloads?.toLocaleString("en-IN")} times on IEEE DataPort.</p>
            <p>The model was then rebuilt for real use. Its evaluation was rerun on a strict split by source leaf, so no augmented copy of a test leaf is ever seen in training. It was made small enough to run inside a phone&apos;s browser, and it learned to say &ldquo;this isn&apos;t a leaf I know&rdquo; instead of guessing.</p>
          </div>
        </section>

        <section aria-labelledby="results">
          <h2 id="results" className="display t-h2">Results</h2>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-frame)] bg-[var(--rule)] ring-1 ring-[var(--rule)] sm:grid-cols-2 lg:grid-cols-4">
            {results.map((r) => (
              <div key={r.l} className="bg-[var(--surface)] p-6">
                <dt className="sr-only">{r.l}</dt>
                <dd>
                  <p className="num display text-[3.2rem] leading-none text-[var(--color-leaf)] dark:text-[var(--color-sprout)]">{r.v}</p>
                  <p className="mt-3 font-[600]">{r.l}</p>
                  <p className="t-small muted mt-1">{r.n}</p>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 muted">Full protocol, per-class results and limitations are on the <Link className="link" href="/research/model-card">model card</Link>.</p>
        </section>

        <section aria-labelledby="arch">
          <h2 id="arch" className="display t-h2">How it is built</h2>
          <Architecture />
        </section>

        <section aria-labelledby="stack">
          <h2 id="stack" className="display t-h2">Stack</h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {STACK.map((g) => (
              <div key={g.area} className="border-t border-[var(--rule)] pt-5">
                <h3 className="title t-h4">{g.area}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {g.items.map((i) => <li key={i} className="rounded-full bg-[var(--tint)] px-3 py-1.5 t-small">{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="recognition" className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <h2 id="recognition" className="display t-h2">Recognition</h2>
          <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {RESEARCH.papers.map((p) => (
              <li key={p.id} className="py-4"><p className="font-[600]">{p.title}</p><p className="muted t-small mt-1">{p.venue}</p></li>
            ))}
            <li className="py-4"><p className="font-[600]">Registered design {RESEARCH.patent.number}, Government of India</p><p className="muted t-small mt-1">{RESEARCH.patent.title}</p></li>
            <li className="py-4"><p className="font-[600]">Featured in Punjab Kesari, Jaipur, 10 October 2025</p></li>
            <li className="py-4"><p className="font-[600]">Two open datasets, {RESEARCH.datasets[0].downloads?.toLocaleString("en-IN")}+ downloads</p><p className="muted t-small mt-1">IEEE DataPort and Mendeley Data</p></li>
          </ul>
        </section>

        <section aria-labelledby="maker" className="grid gap-10 rounded-[var(--radius-frame)] bg-[var(--color-leaf-deep)] p-8 text-[#eef4ea] sm:p-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="maker" className="display t-h2">Made by {SITE.founder}</h2>
            <p className="mt-4 t-lead text-[#d5e2d0]">Computer science engineer from BIT Mesra working on computer vision, edge AI and agricultural AI. I designed the datasets, trained and evaluated the models, and built this product end to end.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn btn-primary" href={`mailto:${SITE.email}`}>Email me</a>
              <a className="btn bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20" href={SITE.github} target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>
          <div className="rounded-3xl bg-[var(--bg)] p-6 text-[var(--fg)]"><ContactForm /></div>
        </section>
      </div>
    </>
  );
}

function Box({ t, d, tone = "plain" }: { t: string; d: string; tone?: "plain" | "leaf" | "bloom" }) {
  return (
    <div className={`rounded-2xl p-4 ${tone === "leaf" ? "bg-[var(--color-leaf)] text-white" : tone === "bloom" ? "bg-[var(--color-bloom-soft)] text-[var(--color-ink)]" : "bg-[var(--surface)] ring-1 ring-[var(--rule)]"}`}>
      <p className="font-[650]">{t}</p>
      <p className={`t-small mt-1 ${tone === "leaf" ? "text-white/80" : "muted"}`}>{d}</p>
    </div>
  );
}

function Arrow() {
  return <div aria-hidden="true" className="mx-auto h-6 w-0.5 bg-[var(--color-bloom)]" />;
}

/** Responsive architecture diagram: what runs on the phone, what runs on the server. */
function Architecture() {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_auto_1fr] lg:items-start">
      <figure className="rounded-[var(--radius-frame)] bg-[var(--tint)] p-5">
        <figcaption className="title t-h4 mb-4">On the phone (offline)</figcaption>
        <Box t="Camera, gallery, WhatsApp share" d="Live video or a photo, cropped to the leaf" tone="bloom" />
        <Arrow />
        <Box t="Web Worker: ONNX Runtime Web" d="EfficientNet-B0 features. Multi-threaded WebAssembly, or WebGPU for batches" tone="leaf" />
        <Arrow />
        <Box t="Classifier head in the page" d="Calibrated probabilities, heatmap, not-a-leaf check, photo-quality check" />
        <Arrow />
        <Box t="Result, field guide, history" d="IndexedDB on the device; printable report; read-aloud" />
      </figure>
      <div className="hidden self-center lg:block" aria-hidden="true">
        <p className="t-small muted max-w-[9rem] text-center">Only API calls and sign-in cross this line. Photos never do.</p>
        <div className="mx-auto mt-2 h-40 w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--rule)_0_8px,transparent_8px_14px)]" />
      </div>
      <figure className="rounded-[var(--radius-frame)] bg-[var(--tint)] p-5">
        <figcaption className="title t-h4 mb-4">On the server</figcaption>
        <Box t="Edge network" d="TLS, CDN caching for pages and model files, DDoS protection" tone="bloom" />
        <Arrow />
        <Box t="Next.js" d="Pages, auth, API gateway: keys, quotas, rate limits" tone="leaf" />
        <Arrow />
        <div className="grid grid-cols-2 gap-3">
          <Box t="FastAPI" d="Same model, ONNX Runtime" />
          <Box t="Postgres" d="Users, keys, usage (Neon)" />
        </div>
      </figure>
    </div>
  );
}
