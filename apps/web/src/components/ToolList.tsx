import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const TOOLS = [
  { key: "diagnose", href: "/diagnose", icon: "M12 3c5 2 8 6 7 12-5 1-10-2-11-7M8 21c1-6 4-10 9-13" },
  { key: "batch", href: "/batch", icon: "M4 6h12v12H4zM8 3h12v12" },
  { key: "scout", href: "/scout", icon: "M3 19l5-14 4 10 3-6 6 10" },
  { key: "risk", href: "/risk", icon: "M7 16a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3.5 3.5 0 0 1-1 7H7zM9 19l-1 2M13 19l-1 2M17 19l-1 2" },
  { key: "calculator", href: "/calculator", icon: "M6 3h12v18H6zM9 7h6M9 12h1M14 12h1M9 16h1M14 16h1" },
  { key: "history", href: "/history", icon: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.7M4 4v3h3" },
  { key: "report", href: "/history", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 17h5" },
  { key: "api", href: "/developers", icon: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" },
] as const;

export async function ToolList({ exclude }: { exclude?: string } = {}) {
  const t = await getTranslations("tools");
  return (
    <ul className="mt-10 grid gap-x-10 sm:grid-cols-2">
      {TOOLS.filter((x) => x.key !== exclude).map((x) => (
        <li key={x.key} className="border-t border-[var(--rule)]">
          <Link href={x.href} className="group grid grid-cols-[2.75rem_1fr] items-start gap-4 py-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--tint)] text-[var(--color-leaf)] transition-colors group-hover:bg-[var(--color-bloom)] group-hover:text-[var(--color-ink)] dark:text-[var(--color-sprout)]">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path d={x.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <span className="title block text-[1.35rem] group-hover:underline">{t(`${x.key}.name`)}</span>
              <span className="mt-1 block text-[var(--muted)]">{t(`${x.key}.desc`)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
