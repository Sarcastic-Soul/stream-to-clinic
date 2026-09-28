import type { Metadata } from "next";
import { SmartLaunch } from "@/components/smart/smart-flow";

export const metadata: Metadata = { title: "Launching" };

// SMART App Launch: an EHR opens this page with ?iss=<FHIR base>&launch=<opaque launch token>.
export default async function SmartLaunchPage({ searchParams }: PageProps<"/smart/launch">) {
  const { iss, launch } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <SmartLaunch iss={typeof iss === "string" ? iss : undefined} launch={typeof launch === "string" ? launch : undefined} />
    </div>
  );
}
