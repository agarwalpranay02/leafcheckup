"""Re-run the MIND-2025 hybrid (frozen DenseNet121 features + XGBoost) under two protocols:

1. "paper" protocol  – augment first, then random 70/15/15 split over all 9,000 variants
                       (variants of one leaf can sit in both train and test).
2. "leak-free"       – the same group split used for LeafCheckup's model (originals only,
                       split by source leaf).

The gap between the two shows how much of the reported accuracy came from leakage.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
import timm
import torch
import xgboost as xgb
from PIL import Image
from sklearn.metrics import accuracy_score, f1_score
from torchvision import transforms as T

RG = {"Healthy": ("healthy", 0), "Disease/Leaf_Minor_Infestation": ("LMI", 1), "Disease/Mosaic_Virus": ("MV", 2)}
TF = T.Compose([T.Resize((224, 224)), T.ToTensor(), T.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))])


@torch.no_grad()
def featurize(model, paths, bs=64):
    out = []
    for i in range(0, len(paths), bs):
        x = torch.stack([TF(Image.open(p).convert("RGB")) for p in paths[i:i + bs]])
        out.append(model(x).numpy())
    return np.concatenate(out)


def fit_eval(Xtr, ytr, Xte, yte):
    clf = xgb.XGBClassifier(objective="multi:softprob", num_class=3, eval_metric="mlogloss", n_estimators=300,
                            max_depth=6, learning_rate=0.1, subsample=0.9, colsample_bytree=0.5, n_jobs=2)
    clf.fit(Xtr, ytr)
    p = clf.predict(Xte)
    return {"accuracy": float(accuracy_score(yte, p)), "macro_f1": float(f1_score(yte, p, average="macro")), "n_test": int(len(yte))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rg", required=True)
    ap.add_argument("--weights", required=True)
    ap.add_argument("--split", default="artifacts/split.json")
    ap.add_argument("--out", default="artifacts/baseline_paper.json")
    a = ap.parse_args()
    torch.manual_seed(0)
    model = timm.create_model("densenet121", pretrained=False, num_classes=0)
    model.load_state_dict({k: v for k, v in torch.load(a.weights, map_location="cpu").items() if not k.startswith("classifier")}, strict=False)
    model.eval()

    # All 9,000 variants, with source-leaf id
    items = []
    for sub, (prefix, label) in RG.items():
        for p in sorted((Path(a.rg) / sub).glob(f"{prefix}_*_v*.jpg")):
            leaf = re.match(rf"{prefix}_(\d+)_v(\d+)", p.stem)
            items.append((str(p), label, f"{prefix}/{leaf.group(1)}", int(leaf.group(2))))
    paths = [i[0] for i in items]
    y = np.array([i[1] for i in items])
    print(f"featurizing {len(paths)} images…", flush=True)
    X = featurize(model, paths)

    # Protocol 1: paper (random split over variants)
    rng = np.random.default_rng(42)
    idx = rng.permutation(len(y))
    n_tr = int(0.70 * len(y))
    n_va = int(0.15 * len(y))
    paper = fit_eval(X[idx[:n_tr]], y[idx[:n_tr]], X[idx[n_tr + n_va:]], y[idx[n_tr + n_va:]])
    te_groups = {items[i][2] for i in idx[n_tr + n_va:]}
    tr_groups = {items[i][2] for i in idx[:n_tr]}
    paper["test_leaves_also_in_train"] = f"{len(te_groups & tr_groups)}/{len(te_groups)}"

    # Protocol 2: leak-free (originals only, group split shared with LeafCheckup)
    split = json.loads(Path(a.split).read_text())["splits"]
    name = lambda s: Path(s["path"]).name
    tr_names = {name(s) for s in split["train"] if s["label"] < 3} | {name(s) for s in split["val"] if s["label"] < 3}
    te_names = {name(s) for s in split["test"] if s["label"] < 3}
    tr_i = [k for k, it in enumerate(items) if Path(it[0]).name in tr_names]
    te_i = [k for k, it in enumerate(items) if Path(it[0]).name in te_names]
    leakfree = fit_eval(X[tr_i], y[tr_i], X[te_i], y[te_i])

    res = {"paper_protocol": paper, "leak_free_protocol": leakfree}
    Path(a.out).write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
