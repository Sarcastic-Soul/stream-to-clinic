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
      <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-12">
        <LiveLoop siteId={typeof site === "string" ? site : "Loc-Almyros"} clinicId={typeof clinic === "string" ? clinic : undefined} />
      </div>
    </div>
  );
}
