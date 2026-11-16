"""Export the trained model for on-device (browser) and server inference.

Outputs (in --out):
  model.onnx      fp32 feature extractor:  image[N,3,224,224] -> features[N,C,7,7]
  model.int8.onnx static-quantised (QDQ) variant, kept only if test accuracy holds
  head.json       classifier weights, temperature, class prototypes, OOD threshold,
                  normalisation constants and evaluation summary

The classifier is applied outside the graph so the client can compute a class
activation map (CAM) for the predicted class from the same features.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import timm
import torch
import torch.nn.functional as F
from PIL import Image, ImageDraw

from data import CLASSES
from train import MEAN, STD, SIZE, eval_tf


class Features(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, x):
        return self.m.forward_features(x)


def load(arch, path):
    m = timm.create_model(arch, pretrained=False, num_classes=len(CLASSES))
    m.load_state_dict(torch.load(path, map_location="cpu"))
    return m.eval()


def preprocess(img: Image.Image) -> np.ndarray:
    return eval_tf()(img.convert("RGB")).unsqueeze(0).numpy()


def synthetic_ood(rng) -> list[Image.Image]:
    """Non-leaf images to calibrate the 'this is not a supported leaf' threshold."""
    import skimage.data as d

    imgs = []
    for name in ["astronaut", "coffee", "chelsea", "rocket", "camera", "brick", "grass", "gravel", "moon", "page",
                 "horse", "clock", "coins", "colorwheel", "logo", "hubble_deep_field", "immunohistochemistry", "skin",
                 "retina", "cat", "eagle", "lily", "stereo_motorcycle"]:
        try:
            a = getattr(d, name)()
            if isinstance(a, tuple):
                a = a[0]
            a = np.asarray(a)
            if a.ndim == 2:
                a = np.stack([a] * 3, -1)
            if a.dtype != np.uint8:
                a = (255 * (a - a.min()) / (np.ptp(a) + 1e-6)).astype(np.uint8)
            imgs.append(Image.fromarray(a[..., :3]))
        except Exception:
            pass
    for _ in range(12):
        imgs.append(Image.fromarray(rng.integers(0, 255, (224, 224, 3), dtype=np.uint8)))
    for c in [(255, 255, 255), (0, 0, 0), (40, 120, 40), (200, 180, 140), (90, 60, 40), (30, 90, 200)]:
        imgs.append(Image.new("RGB", (224, 224), c))
    for i in range(6):
        im = Image.new("RGB", (224, 224), "white")
        dr = ImageDraw.Draw(im)
        for y in range(10, 220, 18):
            dr.text((8, y), "Invoice total 4,290.00 GST 18% item qty rate" * 2, fill=(0, 0, 0))
        imgs.append(im.rotate(i * 7))
    return imgs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arch", default="efficientnet_b0")
    ap.add_argument("--artifacts", default="artifacts")
    ap.add_argument("--out", default="artifacts/export")
    ap.add_argument("--version", required=True)
    a = ap.parse_args()
    art, out = Path(a.artifacts), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    model = load(a.arch, art / "model.pt")
    calib = torch.load(art / "calib.pt")
    report = json.loads((art / "report.json").read_text())
    split = json.loads((art / "split.json").read_text())["splits"]

    # ---- ONNX export (fp32) ----
    dummy = torch.randn(1, 3, SIZE, SIZE)
    onnx_path = out / "model.onnx"
    torch.onnx.export(Features(model).eval(), dummy, str(onnx_path), input_names=["image"], output_names=["features"],
                      dynamic_axes={"image": {0: "n"}, "features": {0: "n"}}, opset_version=17, dynamo=False)
    onnx.checker.check_model(str(onnx_path))
    model.eval()  # the exporter restores the wrapper's train flag recursively

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    with torch.no_grad():
        ref = model.forward_features(dummy).numpy()
    got = sess.run(None, {"image": dummy.numpy()})[0]
    max_err = float(np.abs(ref - got).max())
    assert max_err < 1e-3, max_err

    clf = model.get_classifier()
    W = clf.weight.detach().numpy()
    b = clf.bias.detach().numpy()
    T = float(calib["temperature"])
    protos = calib["protos"].numpy()

    def run(session, items, flip=True):
        P, Y, S = [], [], []
        for it in items:
            x = preprocess(Image.open(it["path"]) if isinstance(it, dict) else it)
            if flip:
                x = np.concatenate([x, x[..., ::-1]])
            f = session.run(None, {"image": np.ascontiguousarray(x)})[0].mean((2, 3)).mean(0)
            lg = W @ f + b
            p = np.exp((lg - lg.max()) / T)
            P.append(p / p.sum())
            fn = f / np.linalg.norm(f)
            S.append(float((protos @ fn).max()))
            if isinstance(it, dict):
                Y.append(it["label"])
        return np.array(P), np.array(Y), np.array(S)

    P_te, Y_te, S_te = run(sess, split["test"])
    acc_fp32 = float((P_te.argmax(1) == Y_te).mean())
    _, _, S_va = run(sess, split["val"])
    rng = np.random.default_rng(0)
    ood = synthetic_ood(rng)
    _, _, S_ood = run(sess, ood)

    # Threshold: keep 99% of in-distribution validation leaves
    thr = float(np.quantile(S_va, 0.01))
    ood_reject = float((S_ood < thr).mean())
    id_keep_test = float((S_te >= thr).mean())

    # ---- Static INT8 quantisation (QDQ), kept only if accuracy holds ----
    int8_info = None
    try:
        from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static
        from onnxruntime.quantization.shape_inference import quant_pre_process

        class Reader(CalibrationDataReader):
            def __init__(self):
                idx = rng.choice(len(split["train"]), 160, replace=False)
                self.data = iter([{"image": preprocess(Image.open(split["train"][i]["path"]))} for i in idx])

            def get_next(self):
                return next(self.data, None)

        pre = out / "model.pre.onnx"
        quant_pre_process(str(onnx_path), str(pre))
        q_path = out / "model.int8.onnx"
        quantize_static(str(pre), str(q_path), Reader(), quant_format=QuantFormat.QDQ, per_channel=True,
                        activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8)
        pre.unlink(missing_ok=True)
        qs = ort.InferenceSession(str(q_path), providers=["CPUExecutionProvider"])
        Pq, Yq, _ = run(qs, split["test"])
        acc_int8 = float((Pq.argmax(1) == Yq).mean())
        int8_info = {"accuracy": acc_int8, "bytes": q_path.stat().st_size, "kept": acc_int8 >= acc_fp32 - 0.01}
        if not int8_info["kept"]:
            q_path.unlink()
    except Exception as e:  # quantisation is an optimisation, never a blocker
        int8_info = {"error": str(e)}

    files = {}
    for f in ["model.onnx", "model.int8.onnx"]:
        p = out / f
        if p.exists():
            files[f] = {"bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}

    head = {
        "version": a.version,
        "arch": a.arch,
        "input": {"size": SIZE, "mean": MEAN, "std": STD, "layout": "NCHW", "name": "image"},
        "output": {"name": "features", "channels": int(W.shape[1]), "grid": int(ref.shape[-1])},
        "classes": CLASSES,
        "temperature": round(T, 5),
        "ood_threshold": round(thr, 5),
        "weights": [[round(float(v), 6) for v in row] for row in W],
        "bias": [round(float(v), 6) for v in b],
        "prototypes": [[round(float(v), 6) for v in row] for row in protos],
        "files": files,
        "evaluation": {
            "protocol": "Leak-free group split by source leaf (70/15/15), originals only, near-duplicates grouped, label conflicts removed",
            "test_images": int(len(Y_te)),
            "test_accuracy": report["test"]["accuracy"],
            "test_accuracy_ci95": report["test"]["accuracy_ci95"],
            "test_macro_f1": report["test"]["macro_f1"],
            "test_ece_calibrated": report["test"]["ece"],
            "onnx_fp32_test_accuracy": acc_fp32,
            "int8": int8_info,
            "ood_synthetic_rejection": ood_reject,
            "ood_synthetic_n": len(ood),
            "id_test_kept": id_keep_test,
            "onnx_max_abs_err": max_err,
        },
    }
    (out / "head.json").write_text(json.dumps(head, separators=(",", ":")))
    print(json.dumps(head["evaluation"], indent=1))


if __name__ == "__main__":
    main()
