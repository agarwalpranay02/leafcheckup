import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MODEL_VERSION } from "./model-version";

export type ModelFacts = {
  version: string;
  testAccuracy: number; // 0..1
  ci: [number, number];
  macroF1: number;
  testImages: number;
  modelMB: number;
  oodRejection: number;
  evaluation: Record<string, unknown>;
  bench?: { paper_protocol: { accuracy: number; macro_f1: number; test_leaves_also_in_train?: string }; leak_free_protocol: { accuracy: number; macro_f1: number; n_test: number }; leafcheckup_ridge_gourd_subset?: { accuracy: number; macro_f1: number; n_test: number } };
  split?: { near_duplicates_merged: number; label_conflicts_removed: string[][] };
  perClass?: Record<string, { precision: number; recall: number; "f1-score": number; support: number }>;
  confusion?: number[][];
};

let cached: Promise<ModelFacts> | null = null;

export function getModelFacts(): Promise<ModelFacts> {
  cached ??= (async () => {
    const dir = path.join(process.cwd(), "public", "models", MODEL_VERSION);
    const head = JSON.parse(await readFile(path.join(dir, "head.json"), "utf8"));
    const card = JSON.parse(await readFile(path.join(dir, "card.json"), "utf8").catch(() => "{}"));
    const ev = head.evaluation;
    const file = head.files["model.int8.onnx"] ?? head.files["model.onnx"];
    return {
      version: head.version,
      testAccuracy: ev.test_accuracy,
      ci: ev.test_accuracy_ci95,
      macroF1: ev.test_macro_f1,
      testImages: ev.test_images,
      modelMB: Math.round((file?.bytes ?? 0) / 1e5) / 10,
      oodRejection: ev.ood_synthetic_rejection,
      evaluation: ev,
      bench: card.bench,
      split: card.split,
      perClass: card.per_class,
      confusion: card.confusion,
    };
  })();
  return cached;
}
