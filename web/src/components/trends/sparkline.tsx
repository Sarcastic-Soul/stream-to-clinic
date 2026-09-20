import type { TrendPoint } from "@/lib/types";

const WIDTH = 120;
const HEIGHT = 32;
const PAD = 3;

/**
 * A line through the daily values. Decorative on its own — every caller states the same movement
 * in words next to it — so the SVG is hidden from assistive technology.
 */
export function Sparkline({ points, color }: { points: TrendPoint[]; color: string }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => PAD + (index * (WIDTH - 2 * PAD)) / (points.length - 1);
  const y = (value: number) => HEIGHT - PAD - ((value - min) / span) * (HEIGHT - 2 * PAD);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-8 w-30 shrink-0 overflow-visible" aria-hidden focusable="false">
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="2.5" fill={color} />
    </svg>
  );
}
