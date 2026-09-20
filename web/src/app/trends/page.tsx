import type { Metadata } from "next";
import { TrendsDashboard } from "@/components/trends/trends-dashboard";

export const metadata: Metadata = { title: "Catchment trends" };

export default function TrendsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Catchment trends</h1>
        <p className="text-muted-foreground">
          One report tells a clinic what to watch for today. Weeks of reports tell a health authority which stream is
          drifting, and where to look first.
        </p>
      </div>
      <TrendsDashboard />
    </div>
  );
}
