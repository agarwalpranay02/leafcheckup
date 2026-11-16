import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
const reqs = {};
p.on("request", (r) => { const u = r.url().replace("http://localhost:3000", ""); reqs[u] = (reqs[u] || 0) + 1; });
p.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 200)));
p.on("response", (r) => r.status() >= 400 && console.log("HTTP", r.status(), r.url()));
p.on("requestfinished", () => {});
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto("http://localhost:3000/diagnose", { waitUntil: "load" });
const t0=Date.now(); try { await p.waitForLoadState("networkidle", { timeout: 20000 }); console.log("idle after", Date.now()-t0); } catch { console.log("never idle"); }
const pend = await p.evaluate(() => performance.getEntriesByType("resource").filter(e => e.responseEnd === 0).map(e => e.name));
console.log("pending", pend);
console.log(await p.evaluate(() => ({ coi: crossOriginIsolated })));
console.log(Object.entries(reqs).filter(([, n]) => n > 1).slice(0, 20), Object.keys(reqs).length);
await b.close();
