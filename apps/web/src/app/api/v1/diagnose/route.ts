import { NextResponse } from "next/server";
import { countCall, MONTHLY_QUOTA, PER_MINUTE, verifyKey } from "@/lib/server/apikeys";
import { env } from "@/lib/server/env";
import { clientIp, problem } from "@/lib/server/http";
import { limitHeaders, rateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

/** Detects real image types from magic bytes instead of trusting Content-Type. */
function sniff(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  // Coarse per-IP shield before touching the database
  const ipLimit = await rateLimit(`ip:${clientIp(req)}`, 120, 60);
  if (!ipLimit.ok) return problem(429, "rate_limited", "Too many requests from this address.", { ...CORS, ...limitHeaders(ipLimit) });

  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const owner = key ? await verifyKey(key) : null;
  if (!owner) return problem(401, "invalid_api_key", "Send a valid API key as 'Authorization: Bearer lc_live_…'.", CORS);

  const rpm = await rateLimit(`key:${owner.id}`, PER_MINUTE, 60);
  if (!rpm.ok) return problem(429, "rate_limited", "Per-minute limit reached for this key.", { ...CORS, ...limitHeaders(rpm) });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 64 * 1024) return problem(413, "too_large", "Image must be 8 MB or smaller.", CORS);

  let bytes: Uint8Array;
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const f = form.get("image");
      if (!(f instanceof Blob)) return problem(400, "missing_image", "Send the photo in a form field named 'image'.", CORS);
      bytes = new Uint8Array(await f.arrayBuffer());
    } else if (type.startsWith("application/json")) {
      const body = (await req.json()) as { image_base64?: string };
      if (typeof body.image_base64 !== "string") return problem(400, "missing_image", "Send { \"image_base64\": \"…\" }.", CORS);
      bytes = new Uint8Array(Buffer.from(body.image_base64.replace(/^data:[^,]+,/, ""), "base64"));
    } else if (type.startsWith("image/")) {
      bytes = new Uint8Array(await req.arrayBuffer());
    } else {
      return problem(415, "unsupported_media_type", "Use multipart/form-data, application/json or a raw image body.", CORS);
    }
  } catch {
    return problem(400, "bad_request", "The request body could not be read.", CORS);
  }
  if (bytes.byteLength > MAX_BYTES) return problem(413, "too_large", "Image must be 8 MB or smaller.", CORS);
  const mime = sniff(bytes);
  if (!mime) return problem(415, "unsupported_image", "Only JPEG, PNG and WebP images are accepted.", CORS);

  const calls = await countCall(owner.id);
  const quota = MONTHLY_QUOTA;
  if (calls > quota) return problem(429, "quota_exceeded", `Fair-use limit of ${quota} calls this month reached. It resets on the 1st; write to us if you need more.`, CORS);

  if (!env.INFERENCE_URL || !env.INFERENCE_TOKEN) return problem(503, "inference_unavailable", "The inference service is not configured.", CORS);
  try {
    const r = await fetch(`${env.INFERENCE_URL}/v1/predict`, {
      method: "POST",
      headers: { "Content-Type": mime, "X-Internal-Token": env.INFERENCE_TOKEN },
      body: Buffer.from(bytes),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const data = await r.json();
    if (!r.ok) return problem(r.status === 422 ? 422 : 502, data?.error?.code ?? "inference_error", data?.error?.message ?? "Inference failed.", CORS);
    return NextResponse.json(data, {
      headers: { ...CORS, ...limitHeaders(rpm), "X-Quota-Used": String(calls), "X-Quota-Limit": String(quota), "Cache-Control": "no-store" },
    });
  } catch {
    return problem(504, "inference_timeout", "The inference service did not respond in time.", CORS);
  }
}
