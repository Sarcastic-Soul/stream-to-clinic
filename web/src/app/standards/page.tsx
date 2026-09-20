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

const MAPPING: { concept: string; resource: string; profile?: { name: string; file: string } }[] = [
  { concept: "Stream site", resource: "Location", profile: { name: "LocationOah", file: "location-oah.fsh" } },
  {
    concept: "Citizen report (temperature, pH, oxygen, conductivity, foam, algae, larvae)",
    resource: "Observation",
    profile: { name: "ObservationIndicatorsOah", file: "observation-indicators-oah.fsh" },
  },
  { concept: "Report photo", resource: "Media + Binary" },
  { concept: "Who reported it and when it was recorded", resource: "Provenance" },
  { concept: "District cohort near a stream", resource: "Group", profile: { name: "GroupOah", file: "group-oah.fsh" } },
  {
    concept: "Baseline disease prevalence",
    resource: "Observation",
    profile: { name: "ObservationHealthMeasureOah", file: "observation-health-measure-oah.fsh" },
  },
  { concept: "Clinic and the streams it serves", resource: "Organization + HealthcareService" },
  { concept: "Health alert with its evidence and reasoning", resource: "DetectedIssue" },
  { concept: "Alert sent to a clinic", resource: "Communication" },
  { concept: "Clinic's reply: what it did about the alert", resource: "Communication (inResponseTo)" },
  { concept: "Trigger for observations from other systems", resource: "Subscription (rest-hook)" },
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
                      <FhirLink href={`${OAH_SOURCE}/${row.profile.file}`}>{row.profile.name}</FhirLink>
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
          readings (absent, present, abundant) and risk types use two small code systems published on the same server. Demo
          clinics, cohorts and health figures carry the HL7 <Code>HTEST</Code> tag for synthetic data.
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
            The official HL7 <Code>validator_cli</Code> checks them against FHIR 4.0.1 and the OAH profiles. Any error fails
            the build.
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
