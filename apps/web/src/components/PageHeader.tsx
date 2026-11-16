import type { ReactNode } from "react";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:pt-16">
      <h1 className="display t-h1 max-w-[16ch] text-[var(--color-leaf-deep)] dark:text-[var(--color-sprout)]">{title}</h1>
      {sub && <p className="mt-5 max-w-[60ch] t-lead muted">{sub}</p>}
      {children}
    </div>
  );
}
