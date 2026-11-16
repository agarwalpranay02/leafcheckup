"""Compare out-of-distribution detectors on pooled features (ID: val/test leaves; OOD: synthetic non-leaf images)."""
import json, numpy as np, onnxruntime as ort, torch
from PIL import Image
from sklearn.metrics import roc_auc_score
from export import preprocess, synthetic_ood

split = json.load(open("artifacts/split.json"))["splits"]
head = json.load(open("artifacts/export/head.json"))
W, b, T = np.array(head["weights"]), np.array(head["bias"]), head["temperature"]
s = ort.InferenceSession("artifacts/export/model.onnx")

def feats(imgs):
    out = []
    for im in imgs:
        x = preprocess(im)
        x = np.concatenate([x, x[..., ::-1]])
        out.append(s.run(None, {"image": np.ascontiguousarray(x)})[0].mean((2, 3)).mean(0))
    return np.array(out)

rng = np.random.default_rng(1)
base = synthetic_ood(rng)
ood_imgs = []
for im in base:
    ood_imgs.append(im)
    w, h = im.size
    for _ in range(3):
        sz = int(min(w, h) * rng.uniform(0.4, 0.9))
        x0, y0 = rng.integers(0, w - sz + 1), rng.integers(0, h - sz + 1)
        ood_imgs.append(im.crop((x0, y0, x0 + sz, y0 + sz)))
load = lambda items: [Image.open(i["path"]).convert("RGB") for i in items]
Ftr = feats(load(split["train"])); ytr = np.array([i["label"] for i in split["train"]])
Fva = feats(load(split["val"])); Fte = feats(load(split["test"])); Fo = feats(ood_imgs)
np.savez("artifacts/feats.npz", Ftr=Ftr, ytr=ytr, Fva=Fva, Fte=Fte, Fo=Fo)

def msp(F):
    lg = F @ W.T + b; lg = lg / T; lg -= lg.max(1, keepdims=True); p = np.exp(lg); return (p / p.sum(1, keepdims=True)).max(1)
def energy(F):
    lg = F @ W.T + b; m = lg.max(1); return m + np.log(np.exp(lg - m[:, None]).sum(1))
nrm = lambda F: F / np.linalg.norm(F, axis=1, keepdims=True)
protos = nrm(np.stack([nrm(Ftr)[ytr == c].mean(0) for c in range(6)]))
def cos(F): return (nrm(F) @ protos.T).max(1)

mu = Ftr.mean(0)
U, S, Vt = np.linalg.svd(Ftr - mu, full_matrices=False)
res = {}
for k in [16, 32, 64, 128]:
    P = Vt[:k]
    Ztr = (Ftr - mu) @ P.T
    cm = np.stack([Ztr[ytr == c].mean(0) for c in range(6)])
    cov = sum(((Ztr[ytr == c] - cm[c]).T @ (Ztr[ytr == c] - cm[c])) for c in range(6)) / len(Ztr)
    prec = np.linalg.inv(cov + 1e-3 * np.eye(k))
    def maha(F, P=P, cm=cm, prec=prec):
        Z = (F - mu) @ P.T
        d = np.stack([np.einsum("ij,jk,ik->i", Z - cm[c], prec, Z - cm[c]) for c in range(6)], 1)
        return -d.min(1)
    res[f"maha{k}"] = maha
for name, fn in {"msp": msp, "energy": energy, "cos": cos, **res}.items():
    sv, st, so = fn(Fva), fn(Fte), fn(Fo)
    thr = np.quantile(sv, 0.01)
    y = np.r_[np.ones(len(st)), np.zeros(len(so))]
    print(f"{name:8s} AUROC={roc_auc_score(y, np.r_[st, so]):.3f}  OOD rejected@1%={np.mean(so < thr):.2f}  ID test kept={np.mean(st >= thr):.3f}")
print("n_ood", len(Fo))
