"use client";

import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useTranslate } from "@/hooks/use-locale";

export function ApiStatus() {
  const t = useTranslate();
  const { data, error } = useApi(api.getHealth);
  const [dot, text] = data
    ? ["bg-green-500", t("common.backendOnline", { version: data.fhir })]
    : error
      ? ["bg-red-500", t("common.backendDown")]
      : ["bg-muted-foreground", t("common.backendChecking")];

  return (
    <p className="flex items-center gap-2" role="status">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {text}
    </p>
  );
}
