"use client";

import { useTranslate } from "@/hooks/use-locale";

// The heading lives in a client component so it follows the language toggle like the form does.
export function ReportIntro() {
  const t = useTranslate();
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{t("report.title")}</h1>
      <p className="text-muted-foreground">{t("report.intro")}</p>
    </div>
  );
}
