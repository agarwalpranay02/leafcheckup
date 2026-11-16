"""Fine-tune an edge-sized CNN on the leak-free split and export it for the browser.

Design notes
- Backbone: EfficientNet-B0 (5.3M params). Small enough to run on a phone in the
  browser via ONNX Runtime Web, strong enough to beat the frozen DenseNet121
  feature extractor used in the MIND-2025 paper.
- Online augmentation replaces offline variants (thresholding/edge maps are not
  what a farmer's camera produces; colour is diagnostic for mosaic & blight).
- Class-weighted loss + label smoothing for the imbalanced classes.
- Temperature scaling on the validation split so displayed confidence is calibrated.
- The exported ONNX graph returns the final feature map; the browser computes
  pooled features, logits, a class-activation map ("where the model looked") and
  an out-of-distribution score from it.
"""
from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms as T

from data import CLASSES

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)
SIZE = 224


class LeafDS(Dataset):
    def __init__(self, items, tf):
        self.items, self.tf = items, tf

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        it = self.items[i]
        return self.tf(Image.open(it["path"]).convert("RGB")), it["label"]


def train_tf():
    return T.Compose([
        T.RandomResizedCrop(SIZE, scale=(0.55, 1.0), ratio=(0.8, 1.25)),
        T.RandomHorizontalFlip(),
        T.RandomVerticalFlip(),
        T.RandomApply([T.RandomRotation(25)], p=0.5),
        T.RandomApply([T.ColorJitter(0.35, 0.35, 0.25, 0.02)], p=0.8),
        T.RandomApply([T.GaussianBlur(5, sigma=(0.1, 1.6))], p=0.25),
        T.ToTensor(),
        T.Normalize(MEAN, STD),
        T.RandomErasing(p=0.2, scale=(0.02, 0.12)),
    ])


def eval_tf():
    return T.Compose([T.Resize((SIZE, SIZE)), T.ToTensor(), T.Normalize(MEAN, STD)])


def build_model(arch: str, weights: str, n_classes: int):
    m = timm.create_model(arch, pretrained=False, num_classes=n_classes, drop_rate=0.3, drop_path_rate=0.1)
    sd = torch.load(weights, map_location="cpu")
    sd = {k: v for k, v in sd.items() if not k.startswith(("classifier.", "fc."))}
    missing, unexpected = m.load_state_dict(sd, strict=False)
    assert all(k.startswith(("classifier", "fc")) for k in missing), missing
    return m


@torch.no_grad()
def predict(model, loader, tta=True):
    model.eval()
    logits, labels, feats = [], [], []
    for x, y in loader:
        fm = model.forward_features(x)
        pooled = fm.mean((2, 3))
        lg = model.get_classifier()(pooled)
        if tta:
            fm2 = model.forward_features(torch.flip(x, dims=[3]))
            p2 = fm2.mean((2, 3))
            lg = (lg + model.get_classifier()(p2)) / 2
            pooled = (pooled + p2) / 2
        logits.append(lg)
        labels.append(y)
        feats.append(pooled)
    return torch.cat(logits), torch.cat(labels), torch.cat(feats)


def fit_temperature(logits, labels):
    t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([t], lr=0.05, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = F.cross_entropy(logits / t.exp(), labels)
        loss.backward()
        return loss

    opt.step(closure)
    return float(t.exp())


def ece(probs, labels, bins=10):
    conf, pred = probs.max(1)
    acc = pred.eq(labels).float()
    e = torch.zeros(1)
    edges = torch.linspace(0, 1, bins + 1)
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            e += m.float().mean() * (conf[m].mean() - acc[m].mean()).abs()
    return float(e)


def metrics(logits, labels, temperature=1.0):
    from sklearn.metrics import classification_report, confusion_matrix, f1_score

    probs = F.softmax(logits / temperature, 1)
    pred = probs.argmax(1)
    y, p = labels.numpy(), pred.numpy()
    rng = np.random.default_rng(0)
    boots = []
    for _ in range(2000):
        idx = rng.integers(0, len(y), len(y))
        boots.append((y[idx] == p[idx]).mean())
    return {
        "accuracy": float((y == p).mean()),
        "accuracy_ci95": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))],
        "macro_f1": float(f1_score(y, p, average="macro")),
        "ece": ece(probs, labels),
        "per_class": classification_report(y, p, target_names=CLASSES, output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(y, p, labels=list(range(len(CLASSES)))).tolist(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="artifacts/split.json")
    ap.add_argument("--arch", default="efficientnet_b0")
    ap.add_argument("--weights", required=True)
    ap.add_argument("--epochs", type=int, default=14)
    ap.add_argument("--bs", type=int, default=32)
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--out", default="artifacts")
    a = ap.parse_args()

    torch.manual_seed(0)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    out = Path(a.out)
    out.mkdir(exist_ok=True, parents=True)
    split = json.loads(Path(a.split).read_text())
    tr, va, te = split["splits"]["train"], split["splits"]["val"], split["splits"]["test"]

    dl_tr = DataLoader(LeafDS(tr, train_tf()), batch_size=a.bs, shuffle=True, num_workers=2, drop_last=True, persistent_workers=True)
    dl_va = DataLoader(LeafDS(va, eval_tf()), batch_size=64, num_workers=2)
    dl_te = DataLoader(LeafDS(te, eval_tf()), batch_size=64, num_workers=2)

    model = build_model(a.arch, a.weights, len(CLASSES))
    counts = np.bincount([s["label"] for s in tr], minlength=len(CLASSES))
    w = torch.tensor((counts.sum() / (len(CLASSES) * counts)) ** 0.5, dtype=torch.float32)
    crit = nn.CrossEntropyLoss(weight=w, label_smoothing=0.1)

    head = list(model.get_classifier().parameters())
    head_ids = {id(p) for p in head}
    body = [p for p in model.parameters() if id(p) not in head_ids]
    opt = torch.optim.AdamW([{"params": body, "lr": a.lr}, {"params": head, "lr": a.lr * 5}], weight_decay=0.02)
    steps = a.epochs * len(dl_tr)
    warm = len(dl_tr)
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1.0, s / steps))))

    best, best_state, log = -1, None, []
    for ep in range(a.epochs):
        model.train()
        t0, tot, n = time.time(), 0.0, 0
        for x, y in dl_tr:
            opt.zero_grad(set_to_none=True)
            loss = crit(model(x), y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            opt.step()
            sched.step()
            tot += loss.item() * len(y)
            n += len(y)
        lg, lb, _ = predict(model, dl_va, tta=False)
        from sklearn.metrics import f1_score
        f1 = f1_score(lb.numpy(), lg.argmax(1).numpy(), average="macro")
        acc = float((lg.argmax(1) == lb).float().mean())
        log.append({"epoch": ep + 1, "train_loss": tot / n, "val_acc": acc, "val_macro_f1": f1, "sec": time.time() - t0})
        print(json.dumps(log[-1]), flush=True)
        if f1 > best:
            best, best_state = f1, {k: v.clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    lg_va, lb_va, f_va = predict(model, dl_va)
    temp = fit_temperature(lg_va, lb_va)
    lg_te, lb_te, f_te = predict(model, dl_te)
    test = metrics(lg_te, lb_te, temp)
    val = metrics(lg_va, lb_va, temp)

    # Prototype-based OOD score on L2-normalised pooled features
    dl_tr_eval = DataLoader(LeafDS(tr, eval_tf()), batch_size=64, num_workers=2)
    _, lb_tr, f_tr = predict(model, dl_tr_eval)
    fn = F.normalize(f_tr, dim=1)
    protos = torch.stack([F.normalize(fn[lb_tr == c].mean(0), dim=0) for c in range(len(CLASSES))])
    sim_va = (F.normalize(f_va, dim=1) @ protos.T).max(1).values
    sim_te = (F.normalize(f_te, dim=1) @ protos.T).max(1).values

    torch.save(model.state_dict(), out / "model.pt")
    report = {
        "arch": a.arch, "epochs": a.epochs, "temperature": temp, "train_log": log,
        "val": val, "test": test,
        "ood": {"val_sim_p1": float(torch.quantile(sim_va, 0.01)), "val_sim_p5": float(torch.quantile(sim_va, 0.05)),
                 "test_sim_min": float(sim_te.min())},
    }
    (out / "report.json").write_text(json.dumps(report, indent=1))
    torch.save({"protos": protos, "temperature": temp}, out / "calib.pt")
    print("TEST", json.dumps({k: test[k] for k in ("accuracy", "accuracy_ci95", "macro_f1", "ece")}))


if __name__ == "__main__":
    main()
