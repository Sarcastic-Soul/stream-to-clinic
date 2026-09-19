import { ApiStatus } from "./api-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-sky-700 dark:text-sky-400">
        OneAquaHealth IEEE Hackathon · Track 7
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">Stream-to-Clinic</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Citizen observations of urban streams, turned into HL7 FHIR resources and early health
        alerts for the clinics that serve the surrounding community.
      </p>
      <ApiStatus />
    </main>
  );
}
