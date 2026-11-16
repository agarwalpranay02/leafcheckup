"""Fit the out-of-distribution detector shipped with the model.

Class-conditional Mahalanobis distance with a shared covariance, in a 128-d PCA
subspace of the pooled CNN features (AUROC 0.993 vs 0.970 for prototype cosine
on our synthetic non-leaf set; see ood_eval.py). For cheap on-device scoring the
whitening is folded into one matrix:  d_k(f) = || A f - o_k ||^2,
A = L^T P (L: Cholesky of the precision), o_k = L^T (m_k + P mu).
Writes ood.bin (float32: A row-major, then o) and updates head.json.
"""
import json
import numpy as np
from sklearn.metrics import roc_auc_score

K = 128
d = np.load("artifacts/feats.npz")
Ftr, ytr, Fva, Fte, Fo = d["Ftr"], d["ytr"], d["Fva"], d["Fte"], d["Fo"]
mu = Ftr.mean(0)
_, _, Vt = np.linalg.svd(Ftr - mu, full_matrices=False)
P = Vt[:K]
Z = (Ftr - mu) @ P.T
cm = np.stack([Z[ytr == c].mean(0) for c in range(6)])
cov = sum((Z[ytr == c] - cm[c]).T @ (Z[ytr == c] - cm[c]) for c in range(6)) / len(Z)
prec = np.linalg.inv(cov + 1e-3 * np.eye(K))
L = np.linalg.cholesky(prec)  # prec = L L^T
A = (L.T @ P).astype(np.float32)
o = (L.T @ (cm + P @ mu).T).T.astype(np.float32)  # (6, K)

def score(F):
    AF = F.astype(np.float32) @ A.T
    dist = ((AF[:, None, :] - o[None]) ** 2).sum(-1)
    return -dist.min(1)

sv, st, so = score(Fva), score(Fte), score(Fo)
thr = float(np.quantile(sv, 0.01))
y = np.r_[np.ones(len(st)), np.zeros(len(so))]
ev = {
    "method": "mahalanobis-pca128",
    "auroc_synthetic": float(roc_auc_score(y, np.r_[st, so])),
    "ood_synthetic_rejection": float(np.mean(so < thr)),
    "ood_synthetic_n": int(len(so)),
    "id_test_kept": float(np.mean(st >= thr)),
}
with open("artifacts/export/ood.bin", "wb") as f:
    f.write(A.tobytes(order="C"))
    f.write(o.tobytes(order="C"))
head = json.load(open("artifacts/export/head.json"))
head.pop("prototypes", None)
head["ood"] = {"method": ev["method"], "dim": K, "classes": 6, "file": "ood.bin", "threshold": thr}
head["evaluation"].update(ev)
json.dump(head, open("artifacts/export/head.json", "w"), separators=(",", ":"))
print(json.dumps(ev, indent=1), "threshold", thr)
