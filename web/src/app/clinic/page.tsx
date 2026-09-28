import type { Metadata } from "next";
import { ClinicDashboard, ClinicHeader } from "@/components/clinic/clinic-dashboard";

export const metadata: Metadata = { title: "Clinic alerts" };

export default async function ClinicPage({ searchParams }: PageProps<"/clinic">) {
  const { clinic } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <ClinicHeader />
      <ClinicDashboard clinicId={typeof clinic === "string" ? clinic : undefined} />
    </div>
  );
}
