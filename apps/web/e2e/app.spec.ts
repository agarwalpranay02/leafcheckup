import { expect, test } from "@playwright/test";
import { CONDITIONS } from "../src/lib/diseases";

// Every class in the field guide, so a newly added crop is tested automatically.
const CLASSES: Record<string, string> = Object.fromEntries(CONDITIONS.map((c) => [c.id, c.name]));

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  (page as unknown as { errors: string[] }).errors = errors;
});
test.afterEach(async ({ page }, info) => {
  const errors = (page as unknown as { errors: string[] }).errors;
  // The 404 test intentionally loads a missing page; Chrome logs that response itself.
  const relevant = info.title.includes("404") ? errors.filter((e) => !e.includes("status of 404")) : errors;
  expect(relevant, "console / page errors").toEqual([]);
});

test("home renders with security headers and cross-origin isolation", async ({ page }) => {
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["strict-transport-security"]).toContain("max-age=63072000");
  expect(h["cross-origin-embedder-policy"]).toBe("credentialless");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Point at a leaf");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});

test("about page tells the project story", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About LeafCheckup");
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByText("98.9%").first()).toBeVisible();
});

test("live camera mode streams, diagnoses and captures", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.goto("/diagnose?camera=1");
  await expect(page.getByLabel("Live camera preview")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Diagnose this leaf" }).click();
  // Chrome's fake camera shows a test pattern, which must be rejected as not-a-leaf
  await expect(page.getByText("doesn't look like a supported leaf")).toBeVisible({ timeout: 60_000 });
});

test("share target hands off to the diagnosis page", async ({ request }) => {
  const r = await request.post("/share-target", { multipart: { title: "x" }, maxRedirects: 0 });
  expect(r.status()).toBe(303);
  expect(r.headers()["location"]).toContain("/diagnose");
});

for (const [cls, name] of Object.entries(CLASSES)) {
  test(`diagnoses ${cls} on-device`, async ({ page }) => {
    await page.goto("/diagnose");
    await page.setInputFiles('input[type=file][accept^="image/jpeg"]', `public/samples/${cls}.jpg`);
    await expect(page.locator("article h2")).toHaveText(name, { timeout: 60_000 });
  });
}

test("rejects a photo that is not a leaf", async ({ page }) => {
  await page.goto("/diagnose");
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = c.height = 400;
    const x = c.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, 400, 400); x.fillStyle = "#000"; x.font = "20px sans-serif";
    for (let y = 30; y < 400; y += 30) x.fillText("Invoice total 4,290.00 GST 18%", 20, y);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.setInputFiles('input[type=file][accept^="image/jpeg"]', { name: "doc.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.getByText("doesn't look like a supported leaf")).toBeVisible({ timeout: 60_000 });
});

test("saves scans to on-device history", async ({ page }) => {
  await page.goto("/diagnose");
  await page.setInputFiles('input[type=file][accept^="image/jpeg"]', "public/samples/brinjal__little_leaf.jpg");
  await expect(page.locator("article h2")).toHaveText("Little leaf", { timeout: 60_000 });
  await page.goto("/history");
  await expect(page.locator("li p.title", { hasText: "Little leaf" }).first()).toBeVisible();
});

test("spray calculator computes per-tank dose", async ({ page }) => {
  await page.goto("/calculator");
  await expect(page.locator("dl dd").first()).toHaveText("32 ml");
});

test("unknown pages return 404", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res!.status()).toBe(404);
});

test("API rejects missing keys", async ({ request }) => {
  const r = await request.post("/api/v1/diagnose", { data: { image_base64: "x" } });
  expect(r.status()).toBe(401);
});
