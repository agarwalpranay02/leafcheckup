import { chromium } from "playwright";
const base = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
async function page(vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text()}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  return p;
}
const p = await page({ width: 1440, height: 900 });
await p.goto(`${base}/en`, { waitUntil: "networkidle" });
await p.screenshot({ path: "/home/claude/shots/home-desktop.png" });
await p.screenshot({ path: "/home/claude/shots/home-desktop-full.png", fullPage: true });
// Diagnose via file upload on the tool page
await p.goto(`${base}/en/diagnose`, { waitUntil: "networkidle" });
const results = {};
for (const cls of ["ridge_gourd__leaf_miner", "ridge_gourd__mosaic_virus", "ridge_gourd__healthy", "brinjal__healthy", "brinjal__little_leaf", "brinjal__phomopsis_blight"]) {
  await p.goto(`${base}/en/diagnose`, { waitUntil: "networkidle" });
  const t0 = Date.now();
  await p.setInputFiles('input[type=file][accept^="image/jpeg"]', `public/samples/${cls}.jpg`);
  await p.waitForSelector("article h2", { timeout: 60000 });
  results[cls] = { got: await p.textContent("article h2"), ms: Date.now() - t0 };
  if (cls === "ridge_gourd__leaf_miner") await p.screenshot({ path: "/home/claude/shots/diagnose-result.png", fullPage: true });
}
console.log(JSON.stringify(results, null, 1));
await p.goto(`${base}/en/research`, { waitUntil: "networkidle" });
await p.screenshot({ path: "/home/claude/shots/research.png", fullPage: true });
const m = await page({ width: 390, height: 844 });
await m.goto(`${base}/hi`, { waitUntil: "networkidle" });
await m.screenshot({ path: "/home/claude/shots/home-mobile-hi.png", fullPage: true });
await m.goto(`${base}/en`, { waitUntil: "networkidle" });
await m.screenshot({ path: "/home/claude/shots/home-mobile.png" });
console.log("ERRORS", errors.length, errors.slice(0, 10));
await browser.close();
