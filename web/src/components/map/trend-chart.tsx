"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime, formatShortDate } from "@/lib/format";
import type { Indicator, ObservationSummary } from "@/lib/types";

interface Props {
  indicator: Indicator;
  observations: ObservationSummary[];
}

export function TrendChart({ indicator, observations }: Props) {
  const data = observations
    .filter((o): o is ObservationSummary & { value: number } => typeof o.value === "number")
    .map((o) => ({ t: Date.parse(o.observedAt), value: o.value }))
    .sort((a, b) => a.t - b.t);
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const unit = indicator.unitLabel ?? indicator.unit ?? "";
  const summary = `${indicator.display}: ${data.length} readings from ${Math.min(...values)} to ${Math.max(...values)} ${unit}, latest ${values.at(-1)} ${unit}.`;

  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-medium">
        {indicator.display} <span className="font-normal text-muted-foreground">({unit})</span>
      </figcaption>
      <p className="sr-only">{summary}</p>
      <div className="h-32 w-full text-muted-foreground" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart accessibilityLayer={false} data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.2} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatShortDate}
              tick={{ fontSize: 11, fill: "currentColor" }}
              stroke="currentColor"
              minTickGap={24}
            />
            <YAxis
              domain={[(min: number) => Math.floor(min), (max: number) => Math.ceil(max)]}
              tickCount={4}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "currentColor" }}
              stroke="currentColor"
              width={48}
            />
            <Tooltip
              labelFormatter={(t) => formatDateTime(new Date(Number(t)).toISOString())}
              formatter={(value) => [`${value} ${unit}`, indicator.display]}
              contentStyle={{
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="value" stroke="#0284c7" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
