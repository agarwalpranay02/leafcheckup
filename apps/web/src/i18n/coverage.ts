import { COVERAGE } from "@/lib/diseases";

/**
 * Copy that names the supported crops ({crops}, {cropsLocal}, {Count}, {detail}, …)
 * is filled in here from the crop registry in lib/diseases.ts, once, when the
 * messages load. Adding a crop there updates every sentence on the site.
 */
const TOKENS = new RegExp(`\\{(${Object.keys(COVERAGE).join("|")})\\}`, "g");

export function withCoverage<T>(messages: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(TOKENS, (_, k: keyof typeof COVERAGE) => COVERAGE[k]);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(messages) as T;
}
