import type { Metadata } from "next";
import Link from "next/link";
import { CloudOffIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

// Served by the service worker for pages that were never opened while online.
export default function OfflinePage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
      <CloudOffIcon className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="text-muted-foreground">
        This page has not been saved on your device yet. The report form works offline once you have opened it with a
        connection: reports are kept on the device and sent when you are back online.
      </p>
      <Link href="/report" className={buttonVariants({ size: "lg" })}>
        Open the report form
      </Link>
    </div>
  );
}
