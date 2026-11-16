// Site audit: every route x 5 widths. Reports overflow, console errors, broken links/images,
// leftover placeholder text, and undersized tap targets on phones.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const ROUTES = ["/", "/diagnose", "/tools", "/batch", "/scout", "/risk", "/calculator", "/history", "/diseases",
  "/diseases/ridge-gourd-healthy", "/diseases/ridge-gourd-leaf-miner", "/diseases/ridge-gourd-mosaic-virus",
  "/diseases/brinjal-healthy", "/diseases/brinjal-little-leaf", "/diseases/brinjal-phomopsis-blight",
  "/research", "/research/model-card", "/developers", "/about", "/account", "/legal/privacy", "/legal/terms",
  "/legal/disclaimer", "/legal/licenses", "/offline"];
const WIDTHS = [320, 390, 768, 1024, 1440];
const BAD = /\b(lorem|todo|tbd|undefined|NaN|\[object|placeholder text|localhost)\b/i;
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const issues = [];
const links = new Set();
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
  const p = await ctx.newPage();
  let errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(e.message));
  for (const r of ROUTES) {
    errs = [];
    const res = await p.goto(BASE + r, { waitUntil: "load" });
    if (!res || res.status() !== 200) issues.push(`${w} ${r} status ${res?.status()}`);
    await p.waitForTimeout(700);
    const a = await p.evaluate((BADsrc) => {
      const BAD = new RegExp(BADsrc, "i");
      const out = {};
      out.overflow = document.documentElement.scrollWidth - window.innerWidth;
      out.wide = [...document.querySelectorAll("main *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 && getComputedStyle(e).position !== "fixed" && !e.closest(".overflow-x-auto,.overflow-hidden,pre"); }).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 50));
      out.bad = (document.body.innerText.match(BAD) || [])[0] || null;
      out.brokenImgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy").map((i) => i.src);
      out.links = [...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href"));
      out.smallTargets = window.innerWidth < 768 ? [...document.querySelectorAll("main a, main button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 32 && !e.closest("p,li p,td,footer,dd,figcaption") && getComputedStyle(e).display !== "inline"; }).slice(0, 4).map((e) => (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30) + `(${Math.round(e.getBoundingClientRect().height)}px)`) : [];
      out.h1 = document.querySelectorAll("h1").length;
      return out;
    }, BAD.source);
    a.links.forEach((l) => links.add(l.split("#")[0]));
    if (a.overflow > 1) issues.push(`${w} ${r} horizontal overflow ${a.overflow}px ${a.wide.join(" ")}`);
    if (a.bad) issues.push(`${w} ${r} suspicious text "${a.bad}"`);
    if (a.brokenImgs.length) issues.push(`${w} ${r} broken images ${a.brokenImgs.join(",")}`);
    if (a.smallTargets.length) issues.push(`${w} ${r} small tap targets ${a.smallTargets.join(", ")}`);
    if (a.h1 !== 1) issues.push(`${w} ${r} has ${a.h1} h1`);
    if (errs.length) issues.push(`${w} ${r} console: ${errs.slice(0, 2).join(" | ")}`);
  }
  await ctx.close();
}
const ctx = await b.newContext();
for (const l of links) {
  const r = await ctx.request.get(BASE + l, { maxRedirects: 5 });
  if (r.status() >= 400) issues.push(`broken link ${l} -> ${r.status()}`);
}
console.log(`checked ${ROUTES.length} routes x ${WIDTHS.length} widths, ${links.size} internal links`);
console.log(issues.length ? issues.join("\n") : "NO ISSUES");
await b.close();
