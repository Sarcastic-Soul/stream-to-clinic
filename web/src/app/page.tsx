import { Suspense } from "react";
import { MapDashboard } from "@/components/map/map-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  return (
    // The dashboard reads ?site= from the URL, so it renders on the client.
    <Suspense fallback={<Skeleton className="h-[55dvh] rounded-none lg:h-[calc(100dvh-3.5rem)]" />}>
      <MapDashboard />
    </Suspense>
  );
}
