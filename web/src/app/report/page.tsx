import type { Metadata } from "next";
import { ReportForm } from "@/components/report/report-form";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const { site } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Report a stream observation</h1>
        <p className="text-muted-foreground">
          Pick a site, say what you saw, and send. It takes less than a minute and helps warn nearby clinics early.
        </p>
      </div>
      <ReportForm initialSiteId={typeof site === "string" ? site : undefined} />
    </div>
  );
}
