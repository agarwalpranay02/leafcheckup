import { ViewTransition } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Link } from "@/i18n/navigation";
import { bySlug, CONDITIONS, CROPS, t as tr } from "@/lib/diseases";
import { SITE } from "@/lib/site";
import { share } from "@/lib/seo";

export function generateStaticParams() {
  return CONDITIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const c = bySlug[slug];
  if (!c) return {};
  const title = `${tr(c.name, locale)} (${tr(CROPS[c.crop], locale)})`;
  return share({
    title,
    description: tr(c.summary, locale),
    alternates: { canonical: `/diseases/${slug}` },
    openGraph: { images: [{ url: c.sample, alt: title }] },
  });
}

export default async function Disease({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const c = bySlug[slug];
  if (!c) notFound();
  const t = await getTranslations("tool");
  const td = await getTranslations("diseases");
  const ts = await getTranslations("severity");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: tr(c.name, locale),
    about: { "@type": "Thing", name: c.scientific },
    inLanguage: locale,
    image: `${SITE.url}${c.sample}`,
    publisher: { "@type": "Organization", name: SITE.name },
    citation: c.sources.map((s) => s.url),
  };
  const list = (title: string, items: string[], dot = "bg-[var(--color-leaf)]") => (
    <section>
      <h2 className="title t-h3">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((x, i) => (
          <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-3">
            <span aria-hidden="true" className={`mt-[0.55em] h-2.5 w-2.5 rounded-full ${dot}`} />
            <span className="prose-measure">{tr(x, locale)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <article className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/diseases" className="link text-[var(--muted)]">← {td("title")}</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="viewfinder overflow-hidden rounded-[var(--radius-frame)]">
            <span className="vf-b" />
            <ViewTransition name={`leaf-${c.slug}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.sample} alt={tr(c.name, locale)} className="aspect-square w-full object-cover" />
            </ViewTransition>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">Field photo from the LeafCheckup training datasets (CC BY 4.0).</p>
          <Link href="/diagnose" className="btn btn-primary mt-6 w-full sm:w-auto">{td("diagnose")}</Link>
        </div>
        <div className="space-y-10">
          <header>
            <p className="font-[600] text-[var(--muted)]">{tr(CROPS[c.crop], locale)} · {ts(c.severity)}</p>
            <h1 className="display t-h1 mt-2">{tr(c.name, locale)}</h1>
            <p className="mt-2 italic text-[var(--muted)]">{c.scientific}</p>
            <p className="mt-6 text-[1.2rem] prose-measure">{tr(c.summary, locale)}</p>
          </header>
          <dl className="grid gap-6 rounded-3xl bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)] sm:grid-cols-2">
            <div><dt className="text-[var(--muted)]">{td("cause")}</dt><dd className="title mt-1 text-xl">{tr(c.kind, locale)}</dd></div>
            <div><dt className="text-[var(--muted)]">{td("spread")}</dt><dd className="mt-1">{tr(c.spread, locale)}</dd></div>
          </dl>
          {list(t("symptoms"), c.symptoms)}
          {list(t("whatToDo"), c.act.now, "bg-[var(--color-bloom)]")}
          {list(t("prevent"), c.act.prevent)}
          {c.act.chemical && (
            <section className="rounded-3xl bg-[var(--color-bloom-soft)] p-6 text-[var(--color-ink)]">
              <h2 className="title t-h4">{t("chemical")}</h2>
              <ul className="mt-3 space-y-2">{c.act.chemical.map((x, i) => <li key={i}>{tr(x, locale)}</li>)}</ul>
              <p className="mt-3 text-sm">{t("chemicalNote")}</p>
            </section>
          )}
          {list(t("lookalikes"), c.lookalikes)}
          <section>
            <h2 className="title t-h4">{td("sources")}</h2>
            <ul className="mt-2 space-y-1">
              {c.sources.map((s) => <li key={s.url}><a className="link" href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}
            </ul>
          </section>
          <p className="text-sm text-[var(--muted)]">{t("disclaimer")}</p>
        </div>
      </div>
    </article>
  );
}
