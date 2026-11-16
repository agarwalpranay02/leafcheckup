import { NextResponse } from "next/server";
import { MODEL_VERSION } from "@/lib/model/model-version";
import { env } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let inference: "up" | "down" | "not_configured" = "not_configured";
  if (env.INFERENCE_URL) {
    try {
      const r = await fetch(`${env.INFERENCE_URL}/healthz`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
      inference = r.ok ? "up" : "down";
    } catch {
      inference = "down";
    }
  }
  return NextResponse.json({ status: "ok", model: MODEL_VERSION, inference }, { headers: { "Cache-Control": "no-store" } });
}
