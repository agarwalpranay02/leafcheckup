/**
 * Heuristic daily risk scores from a weather forecast. These encode broad
 * agronomic rules of thumb (see the risk page's method note). Each score is 0..1.
 */
export type Day = { date: string; tmax: number; tmin: number; rh: number; rain: number };
export type RiskKey = "whitefly" | "leafminer" | "blight" | "leafhopper";

const tri = (x: number, lo: number, peakLo: number, peakHi: number, hi: number) =>
  x <= lo || x >= hi ? 0 : x < peakLo ? (x - lo) / (peakLo - lo) : x <= peakHi ? 1 : (hi - x) / (hi - peakHi);

export function scoreDay(d: Day): Record<RiskKey, number> {
  const tmean = (d.tmax + d.tmin) / 2;
  const dry = d.rain < 2 ? 1 : d.rain < 10 ? 0.5 : 0.15; // heavy rain knocks down small insects
  const humid = d.rh >= 85 ? 1 : d.rh >= 75 ? 0.7 : d.rh >= 65 ? 0.35 : 0.1;
  const wet = d.rain >= 5 ? 1 : d.rain >= 1 ? 0.6 : 0;
  return {
    whitefly: tri(tmean, 18, 26, 33, 40) * dry * (d.rh < 85 ? 1 : 0.7),
    leafminer: tri(tmean, 15, 24, 31, 38) * dry,
    blight: tri(tmean, 18, 25, 32, 37) * Math.max(humid, wet),
    leafhopper: tri(d.tmax, 24, 32, 40, 46) * (d.rain < 10 ? 1 : 0.5),
  };
}

export const level = (s: number): "low" | "moderate" | "high" => (s >= 0.66 ? "high" : s >= 0.33 ? "moderate" : "low");
