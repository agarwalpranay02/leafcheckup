import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ToolList } from "@/components/ToolList";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("toolsTitle"), alternates: { canonical: "/tools" } };
}

export default async function ToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  return (
    <>
      <PageHeader title={t("toolsTitle")} sub={t("toolsSub")} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6"><ToolList /></div>
    </>
  );
}
