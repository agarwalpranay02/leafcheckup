import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/lib/site";
import { Wordmark } from "./Logo";

export async function SiteFooter() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "footer" });
  const tt = await getTranslations({ locale, namespace: "tools" });
  const n = await getTranslations({ locale, namespace: "nav" });
  const l = await getTranslations({ locale, namespace: "legal" });

  const col = (title: string, links: { href: string; label: string; ext?: boolean }[]) => (
    <div>
      <h2 className="title text-[1.05rem]">{title}</h2>
      <ul className="mt-3 space-y-2 text-[0.98rem] text-[var(--muted)]">
        {links.map((x) => (
          <li key={x.href}>
            {x.ext ? (
              <a className="hover:text-[var(--fg)]" href={x.href} rel="noopener noreferrer" target="_blank">
                {x.label}
              </a>
            ) : (
              <Link className="hover:text-[var(--fg)]" href={x.href}>
                {x.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="mt-24 border-t border-[var(--rule)] bg-[var(--tint)]/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-4 text-[var(--muted)]">{t("about")}</p>
        </div>
        {col(t("product"), [
          { href: "/diagnose", label: tt("diagnose.name") },
          { href: "/batch", label: tt("batch.name") },
          { href: "/scout", label: tt("scout.name") },
          { href: "/risk", label: tt("risk.name") },
          { href: "/calculator", label: tt("calculator.name") },
          { href: "/developers", label: tt("api.name") },
        ])}
        {col(t("company"), [
          { href: "/research", label: n("research") },
          { href: "/research/model-card", label: n("modelCard") },
          { href: "/diseases", label: n("diseases") },
          { href: "/about", label: n("about") },
          { href: `mailto:${SITE.email}`, label: SITE.email, ext: true },
          { href: SITE.github, label: "GitHub", ext: true },
        ])}
        {col(t("legal"), [
          { href: "/legal/privacy", label: l("privacy") },
          { href: "/legal/terms", label: l("terms") },
          { href: "/legal/disclaimer", label: l("disclaimer") },
          { href: "/legal/licenses", label: l("licenses") },
        ])}
      </div>
      <div className="border-t border-[var(--rule)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-[var(--muted)] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <p className="font-[600] text-[var(--fg)]">{t("rights", { year: new Date().getFullYear() })}</p>
          <p>{t("credit")}</p>
          <p>
            {t("datasetsCredit")}{" "}
            <Link className="link" href="/research#datasets">{t("datasetsLink")}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
