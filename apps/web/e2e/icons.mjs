import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icons/icon.svg", "utf8");
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
async function render(size, file, pad = 0, bg = "transparent", radius = true) {
  await p.setViewportSize({ width: size, height: size });
  const inner = radius ? svg : svg.replace('rx="10"', 'rx="0"');
  await p.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size - 2 * pad}px;height:${size - 2 * pad}px">${inner.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`);
  await p.screenshot({ path: file, omitBackground: bg === "transparent" });
}
await render(192, "public/icons/icon-192.png");
await render(512, "public/icons/icon-512.png");
await render(512, "public/icons/icon-maskable-512.png", 72, "#1d4231", false);
await render(180, "public/icons/apple-touch-icon.png", 0, "#1d4231", false);
await render(48, "/tmp/fav48.png");
await b.close();
