import type { MetadataRoute } from "next";
import { CONDITIONS } from "@/lib/diseases";
import { SITE } from "@/lib/site";

const PATHS = ["", "/diagnose", "/tools", "/batch", "/scout", "/risk", "/calculator", "/diseases", "/research", "/research/model-card", "/developers", "/about", "/legal/privacy", "/legal/terms", "/legal/disclaimer", "/legal/licenses", ...CONDITIONS.map((c) => `/diseases/${c.slug}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PATHS.map((p) => ({
    url: `${SITE.url}${p}`,
    lastModified: now,
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p.startsWith("/diseases") || p === "/diagnose" ? 0.8 : 0.5,
  }));
}
