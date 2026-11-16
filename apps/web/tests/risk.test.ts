import { describe, expect, it } from "vitest";
import { level, scoreDay } from "@/lib/risk";

describe("weather risk heuristics", () => {
  it("hot dry days favour whitefly, not blight", () => {
    const s = scoreDay({ date: "2026-05-01", tmax: 36, tmin: 24, rh: 35, rain: 0 });
    expect(level(s.whitefly)).toBe("high");
    expect(level(s.blight)).toBe("low");
  });
  it("warm wet humid days favour Phomopsis blight and suppress whitefly", () => {
    const s = scoreDay({ date: "2026-08-01", tmax: 31, tmin: 24, rh: 90, rain: 22 });
    expect(level(s.blight)).toBe("high");
    expect(s.whitefly).toBeLessThan(0.33);
  });
  it("cold days are low risk for all", () => {
    const s = scoreDay({ date: "2026-01-05", tmax: 14, tmin: 4, rh: 60, rain: 0 });
    expect(Object.values(s).every((v) => v < 0.33)).toBe(true);
  });
});
