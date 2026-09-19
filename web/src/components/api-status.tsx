"use client";

import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";

export function ApiStatus() {
  const { data, error } = useApi(api.getHealth);
  const [dot, text] = data
    ? ["bg-green-500", `Backend online · FHIR ${data.fhir}`]
    : error
      ? ["bg-red-500", "Backend unreachable"]
      : ["bg-muted-foreground", "Checking backend…"];

  return (
    <p className="flex items-center gap-2" role="status">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {text}
    </p>
  );
}
