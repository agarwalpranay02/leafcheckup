import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { DiagnoseTool } from "@/components/DiagnoseTool";
import { PageHeader } from "@/components/PageHeader";
import { share } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tool" });
  return share({ title: t("title"), alternates: { canonical: "/diagnose" } });
}

export default async function DiagnosePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tool");
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <DiagnoseTool variant="full" />
      </div>
    </>
  );
}
