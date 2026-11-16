"""Server-side inference that mirrors the browser engine exactly.

Same preprocessing (EXIF-aware decode, centred square crop, 224 px, ImageNet
normalisation), same test-time flip, same classifier head, temperature and
out-of-distribution score, so the API and the app give the same answer.
"""
from __future__ import annotations

import io
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs (~40 MP)
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

SLUGS = {
    "ridge_gourd__healthy": "ridge-gourd-healthy",
    "ridge_gourd__leaf_miner": "ridge-gourd-leaf-miner",
    "ridge_gourd__mosaic_virus": "ridge-gourd-mosaic-virus",
    "brinjal__healthy": "brinjal-healthy",
    "brinjal__little_leaf": "brinjal-little-leaf",
    "brinjal__phomopsis_blight": "brinjal-phomopsis-blight",
}


class ImageError(ValueError):
    pass


@dataclass
class Model:
    session: ort.InferenceSession
    head: dict
    W: np.ndarray
    b: np.ndarray
    A: np.ndarray
    o: np.ndarray

    @classmethod
    def load(cls, model_dir: str | os.PathLike) -> "Model":
        d = Path(model_dir)
        head = json.loads((d / "head.json").read_text())
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "2"))
        opts.inter_op_num_threads = 1
        sess = ort.InferenceSession(str(d / "model.onnx"), sess_options=opts, providers=["CPUExecutionProvider"])
        C, K, dim = head["output"]["channels"], len(head["classes"]), head["ood"]["dim"]
        buf = np.fromfile(d / head["ood"]["file"], dtype=np.float32)
        assert buf.size == dim * C + K * dim, "ood.bin size mismatch"
        return cls(sess, head, np.asarray(head["weights"], np.float32), np.asarray(head["bias"], np.float32),
                   buf[: dim * C].reshape(dim, C), buf[dim * C:].reshape(K, dim))

    @property
    def version(self) -> str:
        return self.head["version"]

    def _decode(self, data: bytes) -> Image.Image:
        try:
            im = Image.open(io.BytesIO(data))
            if im.format not in ALLOWED_FORMATS:
                raise ImageError(f"unsupported format {im.format}")
            im.draft("RGB", (1024, 1024))  # fast JPEG downscale on decode
            im = ImageOps.exif_transpose(im).convert("RGB")
        except ImageError:
            raise
        except Exception as e:  # PIL raises many types; normalise them
            raise ImageError("could not decode image") from e
        w, h = im.size
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
        size = self.head["input"]["size"]
        return im.resize((size, size), Image.BILINEAR, reducing_gap=3.0)

    @staticmethod
    def _quality(arr: np.ndarray) -> dict:
        r, g, b = arr[..., 0].astype(np.float32), arr[..., 1].astype(np.float32), arr[..., 2].astype(np.float32)
        luma = 0.299 * r + 0.587 * g + 0.114 * b
        lap = 4 * luma[1:-1, 1:-1] - luma[:-2, 1:-1] - luma[2:, 1:-1] - luma[1:-1, :-2] - luma[1:-1, 2:]
        blur = float(lap.var())
        exg = 2 * g - r - b
        yellow = (r > 90) & (g > 80) & (b < 0.75 * g) & (np.abs(r - g) < 70)
        cover = float(((exg > 18) | yellow).mean())
        bright = float(luma.mean())
        issues = [k for k, bad in (("blurry", blur < 60), ("dark", bright < 45), ("bright", bright > 225), ("no_leaf", cover < 0.12)) if bad]
        return {"blur": round(blur, 1), "brightness": round(bright, 1), "plant_cover": round(cover, 3), "issues": issues}

    def predict(self, data: bytes) -> dict:
        t0 = time.perf_counter()
        im = self._decode(data)
        arr = np.asarray(im)
        mean = np.asarray(self.head["input"]["mean"], np.float32)
        std = np.asarray(self.head["input"]["std"], np.float32)
        x = ((arr.astype(np.float32) / 255.0 - mean) / std).transpose(2, 0, 1)[None]
        x = np.ascontiguousarray(np.concatenate([x, x[..., ::-1]]))
        f = self.session.run(None, {"image": x})[0].mean(axis=(2, 3)).mean(axis=0)
        logits = self.W @ f + self.b
        z = (logits - logits.max()) / self.head["temperature"]
        p = np.exp(z) / np.exp(z).sum()
        order = np.argsort(-p)
        af = self.A @ f
        score = float(-((af[None, :] - self.o) ** 2).sum(1).min())
        quality = self._quality(arr)
        supported = score >= self.head["ood"]["threshold"] and "no_leaf" not in quality["issues"]
        top = self.head["classes"][order[0]]
        crop, cond = top.split("__")
        return {
            "model": self.version,
            "supported": bool(supported),
            "prediction": {"id": top, "crop": crop, "condition": cond, "confidence": round(float(p[order[0]]), 4)},
            "probabilities": [{"id": self.head["classes"][i], "p": round(float(p[i]), 4)} for i in order],
            "ood": {"score": round(score, 2), "threshold": round(self.head["ood"]["threshold"], 2)},
            "quality": quality,
            "guide_slug": SLUGS[top],
            "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
        }
