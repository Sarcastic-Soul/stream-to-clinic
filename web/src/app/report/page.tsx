import type { Metadata } from "next";
import { ReportForm } from "@/components/report/report-form";
import { ReportIntro } from "@/components/report/report-intro";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const { site } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
      <ReportIntro />
      <ReportForm initialSiteId={typeof site === "string" ? site : undefined} />
    </div>
  );
}
