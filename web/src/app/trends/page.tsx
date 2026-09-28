import type { Metadata } from "next";
import { TrendsDashboard } from "@/components/trends/trends-dashboard";

export const metadata: Metadata = { title: "Catchment trends" };

// The heading lives in the dashboard, a client component, so it follows the chosen language.
export default function TrendsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <TrendsDashboard />
    </div>
  );
}
