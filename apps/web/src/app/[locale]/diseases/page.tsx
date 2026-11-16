import { ViewTransition } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { CONDITIONS, CROP_IDS, CROPS, t as tr } from "@/lib/diseases";
import { share } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "diseases" });
  return share({ title: t("title"), description: t("sub"), alternates: { canonical: "/diseases" } });
}

export default async function Diseases({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("diseases");
  const ts = await getTranslations("severity");
  return (
    <>
      <PageHeader title={t("title")} sub={t("sub")} />
      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6">
        {CROP_IDS.map((crop) => (
          <section key={crop} aria-labelledby={`crop-${crop}`}>
            <h2 id={`crop-${crop}`} className="display border-b border-[var(--rule)] pb-3 text-[2.8rem]">
              {tr(CROPS[crop], locale)} <span className="title text-[1.2rem] italic text-[var(--muted)]">{CROPS[crop].scientific}</span>
            </h2>
            <ul className="mt-6 grid gap-8 md:grid-cols-3">
              {CONDITIONS.filter((c) => c.crop === crop).map((c) => (
                <li key={c.id}>
                  <Link href={`/diseases/${c.slug}`} className="group block">
                    <ViewTransition name={`leaf-${c.slug}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.sample} alt={tr(c.name, locale)} loading="lazy" className="aspect-square w-full rounded-[22px] object-cover ring-1 ring-[var(--rule)]" />
                    </ViewTransition>
                    <p className="mt-3 text-sm font-[620] text-[var(--muted)]">{ts(c.severity)} · {tr(c.kind, locale)}</p>
                    <p className="title t-h3 group-hover:underline">{tr(c.name, locale)}</p>
                    <p className="mt-1 text-[var(--muted)]">{tr(c.summary, locale)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
