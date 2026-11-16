import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Report } from "@/components/Report";

export const metadata = { title: "Report", robots: { index: false } };

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <Report />
    </Suspense>
  );
}
