import { ImageResponse } from "next/og";
import { COVERAGE } from "@/lib/diseases";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LeafCheckup: point at a leaf, know what's wrong";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1d4231", color: "#eef4ea", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "#f3c11b" }} />
          LeafCheckup
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>Point at a leaf.</div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, letterSpacing: -2, color: "#f3c11b" }}>Know what&apos;s wrong.</div>
        </div>
        <div style={{ fontSize: 30, color: "#cfe0c9" }}>{`Free, offline crop disease diagnosis for ${COVERAGE.crops} · leafcheckup.com`}</div>
      </div>
    ),
    size,
  );
}
