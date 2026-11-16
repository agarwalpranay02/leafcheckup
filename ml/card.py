"""Assemble card.json (evaluation facts shown on the research and model-card pages)."""
import json
from pathlib import Path

rep = json.load(open("artifacts/report.json"))
sp = json.load(open("artifacts/split.json"))
head = json.load(open("artifacts/export/head.json"))
bench = json.load(open("artifacts/baseline_paper.json")) if Path("artifacts/baseline_paper.json").exists() else None
card = {
    "version": head["version"],
    "classes": head["classes"],
    "split": {"near_duplicates_merged": sp["near_duplicates_merged"], "label_conflicts_removed": sp["label_conflicts_removed"], "counts": sp["counts"]},
    "per_class": {k: v for k, v in rep["test"]["per_class"].items() if k in head["classes"]},
    "confusion": rep["test"]["confusion_matrix"],
    "train_log": rep["train_log"],
    "bench": bench,
    "evaluation": head["evaluation"],
}
out = Path("../apps/web/public/models") / head["version"] / "card.json"
out.write_text(json.dumps(card, indent=1))
print("wrote", out)
