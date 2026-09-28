import type { Metadata } from "next";
import { Fragment, type ComponentType, type ReactNode } from "react";
import { BookOpenIcon, BotIcon, ChevronDownIcon, FlameIcon, KeyRoundIcon, PuzzleIcon, ShieldCheckIcon, TerminalIcon } from "lucide-react";
import { FhirLink } from "@/components/fhir-link";
import { LiveExamples, StandardsTip } from "@/components/standards/live-examples";
import { T } from "@/components/t";
import { API_URL, FHIR_URL, MCP_URL, REPO_URL } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Standards",
  description: "How Stream-to-Clinic uses HL7 FHIR R4 and the OneAquaHealth Implementation Guide.",
};

// The OAH IG commit that CI builds and validates against (validation/build-ig.sh).
const OAH_COMMIT = "b907cf0869b59d82d9138b3d147fca66f333d911";
const OAH_SHORT = OAH_COMMIT.slice(0, 7);
const OAH_SOURCE = `https://github.com/hl7-eu/oah/blob/${OAH_COMMIT}/input/fsh/profiles`;
const VALIDATE_WORKFLOW = `${REPO_URL}/actions/workflows/validate-fhir.yml`;
const OAH = "http://hl7.eu/fhir/ig/oah/StructureDefinition";
// Our own profiles (ig/ in the repo, built with SUSHI on top of the OAH IG), loaded into the public FHIR server.
const STC_SOURCE = `${REPO_URL}/tree/main/ig/input/fsh`;
const oah = (name: string, file: string) => ({ name, href: `${OAH_SOURCE}/${file}` });
const stc = (name: string, id: string) => ({ name, href: `${FHIR_URL}/StructureDefinition/${id}`, ours: true });

// The standards in use, one card each: a name, a few words on what for, and where to see it live.
const CARDS: { icon: ComponentType<{ className?: string }>; tone: string; name: ReactNode; use: MessageKey; info?: MessageKey; link: ReactNode }[] = [
  {
    icon: FlameIcon,
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    name: "HL7 FHIR R4",
    use: "standards.card.fhir.use",
    link: <FhirLink href={`${FHIR_URL}/metadata`}>CapabilityStatement</FhirLink>,
  },
  {
    icon: BookOpenIcon,
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    name: "OneAquaHealth IG",
    use: "standards.card.oah.use",
    link: <FhirLink href="https://github.com/hl7-eu/oah">hl7-eu/oah</FhirLink>,
  },
  {
    icon: PuzzleIcon,
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    name: <T k="standards.card.stc.name" />,
    use: "standards.card.stc.use",
    info: "standards.profiles.info",
    link: (
      <FhirLink href={STC_SOURCE}>
        <T k="standards.card.stc.link" />
      </FhirLink>
    ),
  },
  {
    icon: ShieldCheckIcon,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    name: "HL7 FHIR Validator",
    use: "standards.card.validator.use",
    info: "standards.conformance.step4Info",
    link: <FhirLink href={VALIDATE_WORKFLOW}>validate-fhir.yml</FhirLink>,
  },
  {
    icon: KeyRoundIcon,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    name: "SMART App Launch 2.0",
    use: "standards.card.smart.use",
    info: "standards.card.smart.info",
    link: <FhirLink href={`${FHIR_URL}/.well-known/smart-configuration`}>smart-configuration</FhirLink>,
  },
  {
    icon: BotIcon,
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    name: "Model Context Protocol",
    use: "standards.card.mcp.use",
    info: "standards.card.mcp.info",
    link: <Code>POST {MCP_URL}</Code>,
  },
];

const MAPPING: { concept: MessageKey; info?: MessageKey; resource: string; profile?: { name: string; href: string; ours?: boolean } }[] = [
  { concept: "standards.concept.site", resource: "Location", profile: oah("LocationOah", "location-oah.fsh") },
  {
    concept: "standards.concept.report",
    info: "standards.concept.reportInfo",
    resource: "Observation",
    profile: oah("ObservationIndicatorsOah", "observation-indicators-oah.fsh"),
  },
  { concept: "standards.concept.photo", resource: "Media + Binary" },
  { concept: "standards.concept.provenance", resource: "Provenance", profile: stc("StcReportProvenance", "stc-report-provenance") },
  { concept: "standards.concept.cohort", resource: "Group", profile: oah("GroupOah", "group-oah.fsh") },
  {
    concept: "standards.concept.baseline",
    resource: "Observation",
    profile: oah("ObservationHealthMeasureOah", "observation-health-measure-oah.fsh"),
  },
  { concept: "standards.concept.clinic", resource: "Organization + HealthcareService" },
  { concept: "standards.concept.alert", resource: "DetectedIssue", profile: stc("StcStreamRiskAlert", "stc-stream-risk-alert") },
  { concept: "standards.concept.clinicAlert", resource: "Communication", profile: stc("StcClinicAlert", "stc-clinic-alert") },
  { concept: "standards.concept.reply", resource: "Communication (inResponseTo)", profile: stc("StcClinicResponse", "stc-clinic-response") },
  {
    concept: "standards.concept.advisory",
    resource: "Communication (sender Device) + Provenance",
    profile: stc("StcClinicAdvisory", "stc-clinic-advisory"),
  },
  { concept: "standards.concept.trigger", resource: "Subscription (rest-hook)" },
];

// Our profiles; the short label and the full "what it pins down" text both live in the messages, keyed by id.
const STC_PROFILES: { name: string; id: string; resource: string }[] = [
  { name: "StcStreamRiskAlert", id: "stc-stream-risk-alert", resource: "DetectedIssue" },
  { name: "StcClinicAlert", id: "stc-clinic-alert", resource: "Communication" },
  { name: "StcClinicResponse", id: "stc-clinic-response", resource: "Communication" },
  { name: "StcClinicAdvisory", id: "stc-clinic-advisory", resource: "Communication" },
  { name: "StcAdvisorDevice", id: "stc-advisor-device", resource: "Device" },
  { name: "StcReportProvenance", id: "stc-report-provenance", resource: "Provenance" },
  { name: "StcAdvisoryProvenance", id: "stc-advisory-provenance", resource: "Provenance" },
];

const CONFORMANCE: { label: MessageKey; info: MessageKey; extra?: ReactNode }[] = [
  { label: "standards.conformance.step1", info: "standards.conformance.step1Info", extra: <Code>{OAH_SHORT}</Code> },
  { label: "standards.conformance.step2", info: "standards.conformance.step2Info" },
  { label: "standards.conformance.step3", info: "standards.conformance.step3Info" },
  { label: "standards.conformance.step4", info: "standards.conformance.step4Info", extra: <Code>validator_cli</Code> },
];

const INTEGRATION: { label: MessageKey; info: MessageKey; extra?: ReactNode }[] = [
  { label: "standards.integration.step1", info: "standards.integration.step1Info", extra: <Code>ObservationIndicatorsOah</Code> },
  {
    label: "standards.integration.step2",
    info: "standards.integration.step2Info",
    extra: <FhirLink href={`${FHIR_URL}/Subscription/citizen-observations`}>citizen-observations</FhirLink>,
  },
  { label: "standards.integration.step3", info: "standards.integration.step3Info" },
  { label: "standards.integration.step4", info: "standards.integration.step4Info", extra: <Code>DetectedIssue + Communication</Code> },
  { label: "standards.integration.step5", info: "standards.integration.step5Info", extra: <Code>inResponseTo</Code> },
  { label: "standards.integration.step6", info: "standards.integration.step6Info", extra: <Code>sender: Device + Provenance</Code> },
];

// Example searches against the public server; each comment line is translated, the commands are not.
const CURL: { comment: MessageKey; lines: string[] }[] = [
  { comment: "standards.curl.metadata", lines: [`curl -s ${FHIR_URL}/metadata`] },
  { comment: "standards.curl.sites", lines: [`curl -s "${FHIR_URL}/Location?_profile=${OAH}/location-oah"`] },
  { comment: "standards.curl.latest", lines: [`curl -s "${FHIR_URL}/Observation?subject=Location/Loc-Almyros&_sort=-date&_count=5"`] },
  {
    comment: "standards.curl.alerts",
    lines: [`curl -s "${FHIR_URL}/DetectedIssue?_sort=-_lastUpdated"`, `curl -s "${FHIR_URL}/Communication?category=alert"`],
  },
  {
    comment: "standards.curl.replies",
    lines: [`curl -s "${FHIR_URL}/Communication?_profile=${FHIR_URL}/StructureDefinition/stc-clinic-response"`],
  },
  { comment: "standards.curl.bundle", lines: [`curl -s ${API_URL}/sites/Loc-Almyros/bundle`] },
];

function Section({ id, title, tip, lead, children }: { id: string; title: MessageKey; tip?: MessageKey; lead?: MessageKey; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <h2 id={id} className="text-lg font-semibold">
            <T k={title} />
          </h2>
          {tip && <StandardsTip k={tip} />}
        </div>
        {lead && (
          <p className="text-sm text-muted-foreground">
            <T k={lead} />
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em] break-all text-foreground">{children}</code>;
}

// A numbered step: a short label, an optional fact or link, and the detail behind the info icon.
function Step({ n, label, info, extra, vars }: { n: number; label: MessageKey; info: MessageKey; extra?: ReactNode; vars?: Record<string, string> }) {
  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className="flex items-start gap-1 text-sm leading-snug font-medium">
          <span>
            <T k={label} />
          </span>
          <StandardsTip k={info} vars={vars} />
        </p>
        {extra && <div className="text-xs">{extra}</div>}
      </div>
    </li>
  );
}

export default function StandardsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          <T k="standards.title" />
        </h1>
        <p className="flex items-start gap-1 text-muted-foreground">
          <span>
            <T k="standards.subtitle" />
          </span>
          <StandardsTip k="standards.subtitleInfo" />
        </p>
      </div>

      <section aria-labelledby="glance-heading">
        <h2 id="glance-heading" className="sr-only">
          <T k="standards.glance" />
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <li key={card.use} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-start gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", card.tone)} aria-hidden>
                  <card.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 leading-tight font-semibold">
                    <span>{card.name}</span>
                    {card.info && <StandardsTip k={card.info} />}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <T k={card.use} />
                  </p>
                </div>
              </div>
              <div className="mt-auto min-w-0 text-sm">{card.link}</div>
            </li>
          ))}
        </ul>
      </section>

      <Section id="mapping-heading" title="standards.mapping.title" tip="standards.mapping.info">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              <T k="standards.mapping.caption" />
            </caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  <T k="standards.mapping.concept" />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <T k="standards.mapping.resource" />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <T k="standards.mapping.profile" />
                </th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map((row) => (
                <tr key={row.concept} className="border-t align-top">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      <T k={row.concept} />
                      {row.info && <StandardsTip k={row.info} />}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.resource}</td>
                  <td className="px-3 py-2">
                    {row.profile ? (
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <FhirLink href={row.profile.href}>{row.profile.name}</FhirLink>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px text-[0.7rem] font-medium",
                            row.profile.ours
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                          )}
                        >
                          {row.profile.ours ? <T k="standards.tag.ours" /> : "OAH"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        <T k="standards.coreR4" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="profiles-heading" title="standards.profiles.title" tip="standards.profiles.info" lead="standards.profiles.lead">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {STC_PROFILES.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 rounded-lg border bg-card px-3.5 py-3 sm:last:odd:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <FhirLink href={`${FHIR_URL}/StructureDefinition/${p.id}`}>{p.name}</FhirLink>
                <span className="font-mono text-[0.7rem] text-muted-foreground">{p.resource}</span>
              </div>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <T k={`standards.profile.${p.id}` as MessageKey} />
                <StandardsTip k={`standards.profile.${p.id}.info` as MessageKey} />
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="examples-heading" title="standards.examples.title" lead="standards.examples.lead">
        <LiveExamples />
      </Section>

      <Section id="conformance-heading" title="standards.conformance.title">
        <ol className="grid gap-2.5 sm:grid-cols-2">
          {CONFORMANCE.map((s, i) => (
            <Step key={s.label} n={i + 1} label={s.label} info={s.info} extra={s.extra} vars={{ commit: OAH_SHORT }} />
          ))}
        </ol>
        <a href={VALIDATE_WORKFLOW} className="inline-flex items-center gap-2 rounded focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- external SVG status badge */}
          <img src={`${VALIDATE_WORKFLOW}/badge.svg`} alt="" height={20} />
          <span className="sr-only">
            <T k="standards.conformance.badge" />
          </span>
        </a>
      </Section>

      <Section id="integration-heading" title="standards.integration.title" lead="standards.integration.lead">
        <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATION.map((s, i) => (
            <Step key={s.label} n={i + 1} label={s.label} info={s.info} extra={s.extra} />
          ))}
        </ol>
      </Section>

      <Section id="curl-heading" title="standards.curl.title">
        <details className="group rounded-lg border bg-muted/30">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <TerminalIcon className="size-4 text-muted-foreground" aria-hidden />
            <T k="standards.curl.show" />
            <ChevronDownIcon className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <pre className="overflow-x-auto border-t p-4 font-mono text-xs leading-relaxed" tabIndex={0} aria-labelledby="curl-heading">
            {CURL.map((block, i) => (
              <Fragment key={block.comment}>
                {i > 0 && "\n\n"}
                {"# "}
                <T k={block.comment} />
                {"\n"}
                {block.lines.join("\n")}
              </Fragment>
            ))}
          </pre>
        </details>
      </Section>
    </div>
  );
}
