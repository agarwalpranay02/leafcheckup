import { NextResponse } from "next/server";

// Fallback when the service worker is not active yet: just open the tool.
export function POST(req: Request) {
  return NextResponse.redirect(new URL("/diagnose", req.url), 303);
}
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/diagnose", req.url), 307);
}
