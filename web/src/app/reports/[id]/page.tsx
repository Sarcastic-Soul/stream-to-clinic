import type { Metadata } from "next";
import { MyReports } from "@/components/report/my-reports";
import { ReportJourneyView } from "@/components/report/report-journey";

export const metadata: Metadata = { title: "Your report" };

export default async function ReportJourneyPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-6">
      <ReportJourneyView id={id} />
      <MyReports exclude={id} />
    </div>
  );
}
