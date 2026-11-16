"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const I = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-7.5Z",
  guide: "M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5ZM5 16a3 3 0 0 1 3-3h10",
  scans: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.7M4 4v3h3",
  tools: "M4 6h7v7H4zM13 6h7v7h-7zM4 15h7v5H4zM13 15h7v5h-7z",
};

/** App-style bottom navigation on phones and tablets, with a central camera button. */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const tab = (href: string, label: string, d: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.72rem] font-[600] text-[var(--muted)] aria-[current=page]:text-[var(--color-leaf)] dark:aria-[current=page]:text-[var(--color-sprout)]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="App" className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[var(--rule)] bg-[color-mix(in_oklab,var(--bg)_90%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-xl items-end px-2">
        {tab("/", "Home", I.home)}
        {tab("/diseases", t("diseases"), I.guide)}
        <div className="flex flex-1 justify-center">
          <Link
            href={{ pathname: "/diagnose", query: { camera: "1" } }}
            aria-label="Scan a leaf with the camera"
            className="-mt-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-bloom)] text-[var(--color-ink)] shadow-[0_10px_24px_-8px_rgb(19_35_27/0.55)] ring-4 ring-[var(--bg)] transition-transform active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </Link>
        </div>
        {tab("/history", t("history"), I.scans)}
        {tab("/tools", t("tools"), I.tools)}
      </div>
    </nav>
  );
}
