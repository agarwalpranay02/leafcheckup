import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Batch } from "@/components/Batch";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "batch" });
  return { title: t("title"), description: t("sub"), alternates: { canonical: "/batch" } };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("batch");
  return (
    <>
      <PageHeader title={t("title")} sub={t("sub")} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Batch />
      </div>
    </>
  );
}
