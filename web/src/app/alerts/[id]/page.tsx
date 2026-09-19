import type { Metadata } from "next";
import { AlertDetail } from "@/components/clinic/alert-detail";

export const metadata: Metadata = { title: "Alert" };

export default async function AlertPage({ params }: PageProps<"/alerts/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <AlertDetail id={id} />
    </div>
  );
}
