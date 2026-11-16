"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { InstallButton } from "./InstallButton";
import { Wordmark } from "./Logo";

const NAV = [
  { href: "/diagnose", key: "diagnose" },
  { href: "/tools", key: "tools" },
  { href: "/diseases", key: "diseases" },
  { href: "/research", key: "research" },
  { href: "/developers", key: "developers" },
  { href: "/about", key: "about" },
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className={`sticky top-0 z-40 transition-[background-color,box-shadow] duration-300 ${scrolled || open ? "bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] shadow-[0_1px_0_var(--rule)] backdrop-blur-md" : "bg-transparent"}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[var(--color-bloom)] focus:px-4 focus:py-2 focus:text-[var(--color-ink)]">
        {t("skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:h-[4.5rem]">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="LeafCheckup home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="hidden flex-1 items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className="relative rounded-full px-3.5 py-2 text-[1rem] font-[560] text-[var(--muted)] transition-colors hover:text-[var(--fg)] aria-[current=page]:text-[var(--fg)] aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3.5 aria-[current=page]:after:-bottom-0.5 aria-[current=page]:after:h-[3px] aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-[var(--color-bloom)]"
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <InstallButton className="hidden min-h-10 items-center gap-2 rounded-full px-3.5 text-[0.95rem] font-[600] text-[var(--muted)] hover:text-[var(--fg)] lg:inline-flex" />
          <Link href="/history" className="hidden min-h-10 items-center rounded-full px-3.5 text-[0.98rem] font-[560] text-[var(--muted)] hover:text-[var(--fg)] lg:inline-flex">
            {t("history")}
          </Link>
          <Link href="/account" className="btn btn-leaf hidden min-h-10 px-4 text-[0.95rem] lg:inline-flex">
            {t("signIn")}
          </Link>
          <button
            type="button"
            className="btn btn-ghost min-h-11 w-11 p-0 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t("close") : t("menu")}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-[var(--bg)] px-4 pb-32 pt-2 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {[...NAV, { href: "/history", key: "history" as const }, { href: "/account", key: "account" as const }].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className="display flex items-center justify-between border-b border-[var(--rule)] py-4 text-[2.3rem] aria-[current=page]:text-[var(--color-leaf)]"
              >
                {t(n.key)}
                <span aria-hidden="true" className="text-xl text-[var(--muted)]">›</span>
              </Link>
            ))}
          </nav>
          <InstallButton className="btn btn-primary mt-8 w-full" />
        </div>
      )}
    </header>
  );
}
