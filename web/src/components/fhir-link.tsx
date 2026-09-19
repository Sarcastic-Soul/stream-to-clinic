import type { ReactNode } from "react";
import { ExternalLinkIcon } from "lucide-react";

// Link to a FHIR resource or other external page, opened in a new tab.
export function FhirLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm underline underline-offset-2">
      {children}
      <ExternalLinkIcon className="size-3.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
