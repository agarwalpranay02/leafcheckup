import { COVERAGE } from "@/lib/diseases";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Playground } from "@/components/Playground";
import { Link } from "@/i18n/navigation";
import { MODEL_VERSION } from "@/lib/model/model-version";
import { SITE } from "@/lib/site";
import { share } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dev" });
  return share({ title: "Developer API", description: t("sub"), alternates: { canonical: "/developers" } });
}

const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-2xl bg-[#0e1913] p-5 text-[0.9rem] leading-relaxed text-[#d7e6d1]"><code>{children}</code></pre>
);

export default async function Developers({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dev");
  const base = SITE.url;
  const response = JSON.stringify({
    model: MODEL_VERSION,
    supported: true,
    prediction: { id: "ridge_gourd__leaf_miner", crop: "ridge_gourd", condition: "leaf_miner", confidence: 0.973 },
    probabilities: [
      { id: "ridge_gourd__leaf_miner", p: 0.973 },
      { id: "ridge_gourd__mosaic_virus", p: 0.018 },
      { id: "ridge_gourd__healthy", p: 0.006 },
    ],
    ood: { score: -118.4, threshold: -203.0 },
    quality: { blur: 412.7, brightness: 121.3, plant_cover: 0.71, issues: [] },
    guide_url: `${base}/diseases/ridge-gourd-leaf-miner`,
    latency_ms: 74,
  }, null, 2);
  const errors = [
    ["400", "missing_image / bad_request", "No image in the request, or the body could not be read."],
    ["401", "invalid_api_key", "Missing, malformed, revoked or unknown key."],
    ["413", "too_large", "Image larger than 8 MB."],
    ["415", "unsupported_image", "Not a JPEG, PNG or WebP (checked by file signature)."],
    ["422", "undecodable_image", "The file could not be decoded as an image."],
    ["429", "rate_limited / quota_exceeded", "Per-minute or monthly fair-use limit reached. Respect Retry-After."],
    ["502", "inference_error", "The inference service failed on this image. Retrying rarely helps."],
    ["503", "inference_starting / inference_unavailable", "The free-tier inference server is waking up after a quiet period (retry after the Retry-After seconds), or is not configured."],
  ];
  return (
    <>
      <PageHeader title={t("title")} sub={t("sub")}>
        <Link href="/account" className="btn btn-primary mt-8">{t("getKey")}</Link>
      </PageHeader>
      <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-12" lang="en">
          <section>
            <h2 className="title text-3xl">{t("endpoint")}</h2>
            <Code>{`POST ${base}/api/v1/diagnose`}</Code>
          </section>
          <section>
            <h2 className="title text-3xl">{t("auth")}</h2>
            <p className="mt-2 text-[var(--muted)]">{t("authBody")}</p>
            <Code>{`Authorization: Bearer lc_live_…`}</Code>
          </section>
          <section className="space-y-3">
            <h2 className="title text-3xl">{t("request")}</h2>
            <Code>{`curl -X POST ${base}/api/v1/diagnose \\
  -H "Authorization: Bearer $LEAFCHECKUP_KEY" \\
  -F image=@leaf.jpg`}</Code>
            <Code>{`import requests

r = requests.post(
    "${base}/api/v1/diagnose",
    headers={"Authorization": f"Bearer {LEAFCHECKUP_KEY}"},
    files={"image": open("leaf.jpg", "rb")},
    timeout=30,
)
r.raise_for_status()
print(r.json()["prediction"])`}</Code>
            <Code>{`const fd = new FormData();
fd.append("image", file);
const res = await fetch("${base}/api/v1/diagnose", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.LEAFCHECKUP_KEY}\` },
  body: fd,
});
const { prediction, supported } = await res.json();`}</Code>
            <p className="text-sm text-[var(--muted)]">Also accepted: a raw image body with Content-Type image/jpeg|png|webp, or JSON {`{"image_base64": "…"}`}.</p>
          </section>
          <section>
            <h2 className="title text-3xl">{t("response")}</h2>
            <Code>{response}</Code>
            <p className="mt-2 text-sm text-[var(--muted)]">When <code>supported</code> is false the photo did not look like a {COVERAGE.cropsOr} leaf; ignore the prediction.</p>
          </section>
          <section>
            <h2 className="title text-3xl">{t("limits")}</h2>
            <p className="mt-2 text-[var(--muted)]">{t("limitsBody")}</p>
          </section>
          <section>
            <h2 className="title text-3xl">{t("errors")}</h2>
            <p className="mt-2 text-[var(--muted)]">Errors use one shape: <code>{`{"error": {"code": "…", "message": "…"}}`}</code></p>
            <table className="mt-4 w-full text-left text-[0.95rem]">
              <tbody>{errors.map(([s, c, d]) => <tr key={c} className="border-t border-[var(--rule)]"><td className="num py-2 pr-3">{s}</td><td className="py-2 pr-3 font-mono text-sm">{c}</td><td className="py-2 text-[var(--muted)]">{d}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Playground label={t("playground")} body={t("playgroundBody")} />
        </div>
      </div>
    </>
  );
}
