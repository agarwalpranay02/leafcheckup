"""LeafCheckup inference service. Internal only: the web app's API gateway handles
API keys, quotas and rate limits, and calls this service with a shared token."""
from __future__ import annotations

import hmac
import logging
import os
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.concurrency import run_in_threadpool

from .model import ImageError, Model

MAX_BYTES = 8 * 1024 * 1024
TOKEN = os.environ.get("INFERENCE_TOKEN", "")
PUBLIC_SITE = os.environ.get("PUBLIC_SITE_URL", "https://leafcheckup.com")
if len(TOKEN) < 16:
    raise RuntimeError("INFERENCE_TOKEN must be set (>= 16 chars)")

logging.basicConfig(level=logging.INFO, format='{"t":"%(asctime)s","lvl":"%(levelname)s","msg":%(message)s}')
log = logging.getLogger("inference")
model = Model.load(os.environ.get("MODEL_DIR", "/models"))
app = FastAPI(title="LeafCheckup inference", docs_url=None, redoc_url=None, openapi_url=None)

# Prometheus metrics (scraped on the internal network only; Caddy never exposes this service)
PREDICTIONS = Counter("leafcheckup_predictions_total", "Diagnoses served", ["prediction", "supported"])
ERRORS = Counter("leafcheckup_prediction_errors_total", "Rejected or failed requests", ["code"])
LATENCY = Histogram("leafcheckup_inference_seconds", "Model latency", buckets=(0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2))


def err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


@app.middleware("http")
async def security(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    log.info('"%s %s %s %.1fms"', request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
    return response


@app.get("/healthz")
def healthz():
    return {"status": "ok", "model": model.version}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/v1/predict")
async def predict(request: Request):
    if not hmac.compare_digest(request.headers.get("x-internal-token", ""), TOKEN):
        raise HTTPException(status_code=401)
    if int(request.headers.get("content-length") or 0) > MAX_BYTES:
        ERRORS.labels("too_large").inc()
        return err(413, "too_large", "Image must be 8 MB or smaller.")
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_BYTES:
            ERRORS.labels("too_large").inc()
            return err(413, "too_large", "Image must be 8 MB or smaller.")
    try:
        with LATENCY.time():
            out = await run_in_threadpool(model.predict, bytes(body))
    except ImageError as e:
        ERRORS.labels("undecodable_image").inc()
        return err(422, "undecodable_image", str(e))
    PREDICTIONS.labels(out["prediction"]["id"], str(out["supported"]).lower()).inc()
    out["guide_url"] = f"{PUBLIC_SITE}/diseases/{out.pop('guide_slug')}"
    return out
