import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FhirLink } from "@/components/fhir-link";
import { LiveExamples } from "@/components/standards/live-examples";
import { API_URL, FHIR_URL, REPO_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Standards",
  description: "How Stream-to-Clinic uses HL7 FHIR R4 and the OneAquaHealth Implementation Guide.",
};

// The OAH IG commit that CI builds and validates against (validation/build-ig.sh).
const OAH_COMMIT = "b907cf0869b59d82d9138b3d147fca66f333d911";
const OAH_SOURCE = `https://github.com/hl7-eu/oah/blob/${OAH_COMMIT}/input/fsh/profiles`;
const VALIDATE_WORKFLOW = `${REPO_URL}/actions/workflows/validate-fhir.yml`;
const OAH = "http://hl7.eu/fhir/ig/oah/StructureDefinition";
// Our own profiles (ig/ in the repo, built with SUSHI on top of the OAH IG), loaded into the public FHIR server.
const STC_SOURCE = `${REPO_URL}/tree/main/ig/input/fsh`;
const oah = (name: string, file: string) => ({ name, href: `${OAH_SOURCE}/${file}` });
const stc = (name: string, id: string) => ({ name, href: `${FHIR_URL}/StructureDefinition/${id}`, ours: true });

const MAPPING: { concept: string; resource: string; profile?: { name: string; href: string; ours?: boolean } }[] = [
  { concept: "Stream site", resource: "Location", profile: oah("LocationOah", "location-oah.fsh") },
  {
    concept: "Citizen report (temperature, pH, oxygen, conductivity, foam, algae, larvae)",
    resource: "Observation",
    profile: oah("ObservationIndicatorsOah", "observation-indicators-oah.fsh"),
  },
  { concept: "Report photo", resource: "Media + Binary" },
  { concept: "Who reported it and when it was recorded", resource: "Provenance", profile: stc("StcReportProvenance", "stc-report-provenance") },
  { concept: "District cohort near a stream", resource: "Group", profile: oah("GroupOah", "group-oah.fsh") },
  {
    concept: "Baseline disease prevalence",
    resource: "Observation",
    profile: oah("ObservationHealthMeasureOah", "observation-health-measure-oah.fsh"),
  },
  { concept: "Clinic and the streams it serves", resource: "Organization + HealthcareService" },
  {
    concept: "Health alert with its evidence and reasoning",
    resource: "DetectedIssue",
    profile: stc("StcStreamRiskAlert", "stc-stream-risk-alert"),
  },
  { concept: "Alert sent to a clinic", resource: "Communication", profile: stc("StcClinicAlert", "stc-clinic-alert") },
  {
    concept: "Clinic's reply: what it did about the alert",
    resource: "Communication (inResponseTo)",
    profile: stc("StcClinicResponse", "stc-clinic-response"),
  },
  {
    concept: "Plain-language notice drafted by a model",
    resource: "Communication (sender Device) + Provenance",
    profile: stc("StcClinicAdvisory", "stc-clinic-advisory"),
  },
  { concept: "Trigger for observations from other systems", resource: "Subscription (rest-hook)" },
];

// What each of our profiles pins down, beyond core R4.
const STC_PROFILES: { name: string; id: string; resource: string; what: string }[] = [
  {
    name: "StcStreamRiskAlert",
    id: "stc-stream-risk-alert",
    resource: "DetectedIssue",
    what: "Risk code from our value set, the stream site as a LocationOah, one evidence entry per condition met, the decision narrative.",
  },
  {
    name: "StcClinicAlert",
    id: "stc-clinic-alert",
    resource: "Communication",
    what: "Category alert, about a StcStreamRiskAlert, one clinic as recipient, the GroupOah cohort as subject.",
  },
  {
    name: "StcClinicResponse",
    id: "stc-clinic-response",
    resource: "Communication",
    what: "A reply to a StcClinicAlert (inResponseTo) with a coded action from the alert-response value set.",
  },
  {
    name: "StcClinicAdvisory",
    id: "stc-clinic-advisory",
    resource: "Communication",
    what: "Category instruction, sent by the StcAdvisorDevice, so model-written text is marked as such.",
  },
  { name: "StcAdvisorDevice", id: "stc-advisor-device", resource: "Device", what: "The language model as a named Device." },
  {
    name: "StcReportProvenance",
    id: "stc-report-provenance",
    resource: "Provenance",
    what: "A citizen report and its photo as targets, with the reporter as author and the app as assembler.",
  },
  {
    name: "StcAdvisoryProvenance",
    id: "stc-advisory-provenance",
    resource: "Provenance",
    what: "The advisory model as author and the alert it was drafted from as the source.",
  },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground text-[0.85em]">{children}</code>;
}

export default function StandardsPage() {
  const curl = [
    "# What the server supports",
    `curl -s ${FHIR_URL}/metadata`,
    "",
    "# Stream sites conforming to LocationOah",
    `curl -s "${FHIR_URL}/Location?_profile=${OAH}/location-oah"`,
    "",
    "# Latest citizen reports at one site",
    `curl -s "${FHIR_URL}/Observation?subject=Location/Loc-Almyros&_sort=-date&_count=5"`,
    "",
    "# Health alerts and the messages sent to clinics",
    `curl -s "${FHIR_URL}/DetectedIssue?_sort=-_lastUpdated"`,
    `curl -s "${FHIR_URL}/Communication?category=alert"`,
    "",
    "# Clinic replies, found by our profile",
    `curl -s "${FHIR_URL}/Communication?_profile=${FHIR_URL}/StructureDefinition/stc-clinic-response"`,
    "",
    "# Everything about one site as a single Bundle",
    `curl -s ${API_URL}/sites/Loc-Almyros/bundle`,
  ].join("\n");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Standards</h1>
        <p className="text-muted-foreground">
          Every citizen report, district baseline and health alert in Stream-to-Clinic is an HL7 FHIR R4 resource, profiled
          with the{" "}
          <a href="https://github.com/hl7-eu/oah" className="underline underline-offset-2">
            OneAquaHealth Implementation Guide
          </a>
          . The FHIR server is public and read-only, so anything shown in the app can be checked at the source.
        </p>
      </div>

      <Section id="mapping-heading" title="How each concept maps to FHIR">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Stream-to-Clinic concepts and the FHIR resources and profiles that carry them</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Concept
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  FHIR resource
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Profile
                </th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map((row) => (
                <tr key={row.concept} className="border-t align-top">
                  <td className="px-3 py-2">{row.concept}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.resource}</td>
                  <td className="px-3 py-2">
                    {row.profile ? (
                      <span className="space-x-1.5">
                        <FhirLink href={row.profile.href}>{row.profile.name}</FhirLink>
                        <span className="text-xs text-muted-foreground">{row.profile.ours ? "ours" : "OAH"}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Core R4</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Indicators use codes from the OAH code system (<Code>temporarySystem-oah-eu</Code>) and UCUM units. Presence
          readings (absent, present, abundant), risk types and clinic responses use three small code systems of ours,
          published on the same server with a value set each. Demo clinics, cohorts and health figures carry the HL7{" "}
          <Code>HTEST</Code> tag for synthetic data.
        </p>
      </Section>

      <Section id="profiles-heading" title="Our own profiles, built on the OAH IG">
        <p>
          The OAH Implementation Guide covers the stream: sites, citizen indicators, cohorts and health measures. It has
          nothing yet for what happens next, so Stream-to-Clinic adds seven profiles for the alert, the messages to and from
          clinics, the model-drafted advisory and data lineage. They are written in{" "}
          <FhirLink href={STC_SOURCE}>FSH</FhirLink>, built with SUSHI with the OAH IG as a dependency (the alert&apos;s site
          must be a <Code>LocationOah</Code>, the cohort a <Code>GroupOah</Code>), and loaded into the public FHIR server, so
          each canonical URL below resolves.
        </p>
        <ul className="divide-y rounded-lg border">
          {STC_PROFILES.map((p) => (
            <li key={p.id} className="space-y-1 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <FhirLink href={`${FHIR_URL}/StructureDefinition/${p.id}`}>{p.name}</FhirLink>
                <span className="font-mono text-xs text-muted-foreground">{p.resource}</span>
              </div>
              <p className="text-sm text-muted-foreground">{p.what}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Every alert, clinic message, reply, advisory and report lineage the API writes declares its profile in{" "}
          <Code>meta.profile</Code>, so a partner can find them with <Code>_profile</Code> searches, as below.
        </p>
      </Section>

      <Section id="examples-heading" title="Live examples">
        <p className="text-sm text-muted-foreground">Real resources on the public FHIR server right now.</p>
        <LiveExamples />
      </Section>

      <Section id="conformance-heading" title="Conformance, checked on every change">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            The OAH Implementation Guide is still a draft and not published as a package, so CI builds it from source with SUSHI
            at a pinned commit (<Code>{OAH_COMMIT.slice(0, 7)}</Code>).
          </li>
          <li>
            Sample resources are generated by the app&apos;s own mapping, seed and alert code, not written by hand: a report
            for every indicator and value, the sites, cohorts, baselines, clinics, a photo, an alert, a clinic message and a
            site Bundle.
          </li>
          <li>
            Our own profiles are built from FSH on top of that, and CI checks that the definitions the server is seeded with
            match a fresh build.
          </li>
          <li>
            The official HL7 <Code>validator_cli</Code> checks the samples against FHIR 4.0.1, the OAH profiles and ours. Any
            error fails the build.
          </li>
        </ol>
        <a href={VALIDATE_WORKFLOW} className="inline-block rounded focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- external SVG status badge */}
          <img src={`${VALIDATE_WORKFLOW}/badge.svg`} alt="Validate FHIR workflow status" height={20} />
        </a>
      </Section>

      <Section id="integration-heading" title="Plugging in another system">
        <p>
          The app is one client of the FHIR server, not the only way in. Any system that can write an{" "}
          <Code>ObservationIndicatorsOah</Code> Observation gets the same assessment:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            The system creates the Observation on the FHIR server, with the stream site as <Code>subject</Code>. (The public
            endpoint is read-only in this demo; a partner would be given write access.)
          </li>
          <li>
            The server matches it against the{" "}
            <FhirLink href={`${FHIR_URL}/Subscription/citizen-observations`}>citizen-observations</FhirLink> Subscription
            and delivers it to the risk engine over a rest-hook.
          </li>
          <li>The risk engine re-checks the site with recent reports and live rainfall from Open-Meteo.</li>
          <li>
            If a rule fires, a <Code>DetectedIssue</Code> and one <Code>Communication</Code> per serving clinic appear on the
            FHIR server, where a clinic system can read them, for example with <Code>Communication?recipient=Organization/…</Code>.
            When a clinic answers, its reply is another <Code>Communication</Code> whose <Code>inResponseTo</Code> points at the
            one we sent, so the loop closes in standard resources rather than in a private status column.
          </li>
          <li>
            A clinic can ask for the alert in plainer words. A language model rewrites the engine&apos;s own reasons — it is
            given nothing else, and it changes no risk or level — and the draft is stored as a <Code>Communication</Code> whose{" "}
            <Code>sender</Code> is a <Code>Device</Code>, with a <Code>Provenance</Code> naming that device as the author. Any
            reader can tell machine-written text from a clinician&apos;s, which is the part that matters for governance.
          </li>
        </ol>
      </Section>

      <Section id="curl-heading" title="Try it with curl">
        <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-xs leading-relaxed" tabIndex={0} aria-label="Example curl commands">
          {curl}
        </pre>
      </Section>
    </div>
  );
}
