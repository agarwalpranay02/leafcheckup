import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Calculator } from "@/components/Calculator";
import { share } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calc" });
  return share({ title: t("title"), description: t("sub"), alternates: { canonical: "/calculator" } });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("calc");
  return (
    <>
      <PageHeader title={t("title")} sub={t("sub")} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Calculator />
      </div>
    </>
  );
}
