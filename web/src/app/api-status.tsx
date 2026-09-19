"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://oneaquahealth.duckdns.org";

type Status = { state: "loading" } | { state: "ok"; fhir: string } | { state: "error" };

export function ApiStatus() {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { fhir: string }) => setStatus({ state: "ok", fhir: body.fhir }))
      .catch(() => setStatus({ state: "error" }));
  }, []);

  const label =
    status.state === "loading"
      ? "Checking backend…"
      : status.state === "ok"
        ? `Backend online · FHIR server ${status.fhir}`
        : "Backend unreachable";

  return (
    <p className="rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
      {label}
    </p>
  );
}
