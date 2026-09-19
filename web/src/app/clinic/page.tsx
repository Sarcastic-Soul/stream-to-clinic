import type { Metadata } from "next";
import { ClinicDashboard } from "@/components/clinic/clinic-dashboard";

export const metadata: Metadata = { title: "Clinic alerts" };

export default async function ClinicPage({ searchParams }: PageProps<"/clinic">) {
  const { clinic } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Clinic alerts</h1>
        <p className="text-muted-foreground">
          Early warnings for the streams near your clinic, raised from citizen reports and weather, with the reasons behind
          each one.
        </p>
      </div>
      <ClinicDashboard clinicId={typeof clinic === "string" ? clinic : undefined} />
    </div>
  );
}
