import type { Metadata } from "next";
import { LiveLoop } from "@/components/loop/live-loop";

export const metadata: Metadata = { title: "Live loop" };

export default async function LoopPage({ searchParams }: PageProps<"/loop">) {
  const { site, clinic } = await searchParams;

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-sky-200)_55%,transparent),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-sky-900)_45%,transparent),transparent_65%)]"
        aria-hidden
      />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase dark:text-sky-300">The One Health loop, live</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">One report at the stream. Seconds later, the clinic knows.</h1>
          <p className="text-muted-foreground text-pretty">
            Both phones are real: the report is stored as FHIR, the risk engine checks it against recent readings and the weather, and
            the clinic&apos;s app hears about the alert over a live stream, with no refresh.
          </p>
        </div>
        <LiveLoop siteId={typeof site === "string" ? site : "Loc-Almyros"} clinicId={typeof clinic === "string" ? clinic : undefined} />
      </div>
    </div>
  );
}
