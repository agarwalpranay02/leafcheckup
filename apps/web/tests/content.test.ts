import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONDITIONS } from "@/lib/diseases";
import { MODEL_VERSION } from "@/lib/model/model-version";
import en from "@/messages/en.json";

const keys = (o: Record<string, unknown>, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));

const modelDir = path.join(__dirname, "..", "public", "models", MODEL_VERSION);
const head = JSON.parse(readFileSync(path.join(modelDir, "head.json"), "utf8"));

describe("copy", () => {
  it("has no empty strings, TODOs or leftover placeholder text", () => {
    const flat = keys(en).map((k) => [k, k.split(".").reduce<unknown>((a, x) => (a as Record<string, unknown>)[x], en)] as const);
    for (const [k, v] of flat) {
      if (typeof v !== "string") continue;
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(v, k).not.toMatch(/lorem|todo|tbd|xxx|placeholder/i);
    }
  });
});

describe("field guide", () => {
  it("covers every class the model predicts, once", () => {
    expect(CONDITIONS.map((c) => c.id).sort()).toEqual([...head.classes].sort());
  });
  it("has unique slugs, bilingual text, https sources and existing sample photos", () => {
    expect(new Set(CONDITIONS.map((c) => c.slug)).size).toBe(CONDITIONS.length);
    for (const c of CONDITIONS) {
      for (const l of [c.name, c.summary, c.kind, c.spread, ...c.symptoms, ...c.act.now, ...c.act.prevent]) {
        expect(l.length).toBeGreaterThan(2);
      }
      expect(c.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
      expect(existsSync(path.join(__dirname, "..", "public", c.sample))).toBe(true);
    }
  });
});

describe("model artifacts", () => {
  it("head and OOD file are consistent", () => {
    const C = head.output.channels;
    expect(head.weights).toHaveLength(head.classes.length);
    expect(head.weights[0]).toHaveLength(C);
    const bytes = statSync(path.join(modelDir, head.ood.file)).size;
    expect(bytes).toBe(4 * (head.ood.dim * C + head.classes.length * head.ood.dim));
    expect(head.evaluation.test_accuracy).toBeGreaterThan(0.9);
  });
});

describe("crop coverage", () => {
  it("fills every crop token and names every crop", async () => {
    const { withCoverage } = await import("@/i18n/coverage");
    const { CROP_IDS, CROPS, COVERAGE } = await import("@/lib/diseases");
    const filled = JSON.stringify(withCoverage(en));
    for (const k of Object.keys(COVERAGE)) expect(filled, k).not.toContain(`{${k}}`);
    for (const c of CROP_IDS) expect(filled.toLowerCase()).toContain(CROPS[c].en.toLowerCase());
    expect(COVERAGE.crops).toBe("ridge gourd and brinjal");
    expect(COVERAGE.coverageDetail).toBe("Ridge gourd: healthy, leaf miner and yellow mosaic virus. Brinjal: healthy, little leaf and Phomopsis blight.");
  });
  it("every condition belongs to a registered crop", async () => {
    const { CROP_IDS } = await import("@/lib/diseases");
    for (const c of CONDITIONS) expect(CROP_IDS).toContain(c.crop);
  });
});
