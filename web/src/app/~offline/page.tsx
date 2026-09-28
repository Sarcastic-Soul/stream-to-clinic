import type { Metadata } from "next";
import Link from "next/link";
import { CloudOffIcon } from "lucide-react";
import { T } from "@/components/t";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

// Served by the service worker for pages that were never opened while online.
export default function OfflinePage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
      <CloudOffIcon className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">
        <T k="common.offline.title" />
      </h1>
      <p className="text-muted-foreground">
        <T k="common.offline.body" />
      </p>
      <Link href="/report" className={buttonVariants({ size: "lg" })}>
        <T k="common.offline.cta" />
      </Link>
    </div>
  );
}
