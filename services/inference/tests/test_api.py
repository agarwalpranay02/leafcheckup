import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
os.environ.setdefault("INFERENCE_TOKEN", "test-token-0123456789")
os.environ.setdefault("MODEL_DIR", str(ROOT / "apps/web/public/models/effb0-2026.11"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
SAMPLES = ROOT / "apps/web/public/samples"
H = {"x-internal-token": os.environ["INFERENCE_TOKEN"]}


def test_health():
    assert client.get("/healthz").json()["status"] == "ok"


def test_requires_token():
    assert client.post("/v1/predict", content=b"x").status_code == 401


def test_all_sample_classes_correct():
    for f in SAMPLES.glob("*.jpg"):
        r = client.post("/v1/predict", content=f.read_bytes(), headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["supported"] is True
        assert d["prediction"]["id"] == f.stem, (f.stem, d["prediction"])
        assert abs(sum(p["p"] for p in d["probabilities"]) - 1) < 1e-3


def test_rejects_non_image_and_garbage():
    r = client.post("/v1/predict", content=b"%PDF-1.7 not an image", headers=H)
    assert r.status_code == 422


def test_rejects_non_leaf():
    from io import BytesIO
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (400, 400), "white")
    ImageDraw.Draw(im).text((20, 20), "GST INVOICE TOTAL 4,290.00", fill="black")
    buf = BytesIO(); im.save(buf, "PNG")
    d = client.post("/v1/predict", content=buf.getvalue(), headers=H).json()
    assert d["supported"] is False


def test_too_large():
    r = client.post("/v1/predict", content=b"\xff\xd8\xff" + b"0" * (8 * 1024 * 1024 + 10), headers=H)
    assert r.status_code == 413


def test_metrics_exposed_and_counting():
    body = client.get("/metrics").text
    assert "leafcheckup_predictions_total" in body and "leafcheckup_inference_seconds" in body
