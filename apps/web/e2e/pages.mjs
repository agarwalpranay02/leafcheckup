import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const shots = [["/research", "research"], ["/about", "about"], ["/diseases/brinjal-phomopsis-blight", "disease"], ["/developers", "developers"], ["/research/model-card", "modelcard"], ["/scout", "scout"], ["/calculator", "calc"]];
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
const p = await ctx.newPage();
for (const [u, n] of shots) { await p.goto("http://localhost:3000" + u, { waitUntil: "networkidle" }); await p.screenshot({ path: `/home/claude/shots/p-${n}.png` }); }
const d = await b.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: "dark" });
const q = await d.newPage(); await q.goto("http://localhost:3000/", { waitUntil: "networkidle" }); await q.screenshot({ path: "/home/claude/shots/p-dark.png" });
await q.evaluate(() => window.scrollTo(0, 900)); await q.waitForTimeout(200); await q.screenshot({ path: "/home/claude/shots/p-dark2.png" });
await b.close();
