# FHIR profile validation

Checks that the resources the API produces conform to the OneAquaHealth (OAH) IG profiles, using the official HL7 validator. CI runs it on every push or pull request that touches `api/` or `validation/` (`.github/workflows/validate-fhir.yml`) and fails on any validation error.

## What it does

1. `build-ig.sh` downloads the OAH IG source ([hl7-eu/oah](https://github.com/hl7-eu/oah)) at a pinned commit and builds it with SUSHI. The IG is a draft and is not published as a package, so it is built from source.
2. `generate-samples.ts` runs the API's real code and writes the resources to `samples/generated/`:
   - `api/src/mapping.ts`: a citizen report Observation (`ObservationIndicatorsOah`) for every indicator, one per presence value for presence indicators. New indicators in `api/src/oah.ts` are picked up automatically.
   - `api/src/seed.ts`: every resource in the seed transaction (`LocationOah` sites and parent Locations, `Organization`, `HealthcareService`, `GroupOah`, `ObservationHealthMeasureOah`, `CodeSystem`), with the synthetic citizen history cut down to one Observation per indicator.
   - `api/src/alerts.ts`: the `DetectedIssue` and `Communication` for a raised algal-bloom alert (core R4 only; no OAH profile applies).
3. `validate.sh` runs `validator_cli` against FHIR 4.0.1 with the built IG on `samples/generated/` (and `samples/baseline/`, if present). The API's CodeSystems are loaded as definitions too, so presence and risk codes are checked. It prints each file's errors and warnings and exits non-zero if there is any error.

## Run locally

Requires Node.js 22+, Java 21 (Temurin in CI) and about 1.5 GB of free memory.

```bash
cd validation
npm install
npm test          # build-ig + generate + validate
```

The first run downloads the IG, its FHIR packages (into `~/.fhir/packages`) and the validator jar (~200 MB, into `.work/`); later runs reuse them. Run the steps on their own with `./build-ig.sh`, `npm run generate` and `./validate.sh`. The full validator output is in `.work/validation.log`.

Settings (environment variables):

| Variable | Default | Purpose |
|---|---|---|
| `OAH_COMMIT` | `b907cf0869b59d82d9138b3d147fca66f333d911` | hl7-eu/oah commit to build |
| `SUSHI_VERSION` | `3.20.1` | `fsh-sushi` version |
| `VALIDATOR_VERSION` | `6.10.4` | `validator_cli` release |
| `JAVA_XMX` | `1536m` | Validator heap size |
| `TX` | `n/a` | Terminology server; `n/a` is offline. `TX=https://tx.fhir.org` also checks UCUM units and external code systems |

## Pinned versions

- OAH IG: `hl7-eu/oah@b907cf0869b59d82d9138b3d147fca66f333d911` (package `hl7.eu.fhir.oah` 0.1.0-ci-build, FHIR 4.0.1)
- SUSHI 3.20.1, HL7 validator 6.10.4

To move to a newer IG commit, change `OAH_COMMIT` in `build-ig.sh`. This also invalidates the CI cache.

## Adding samples

- Another API builder: call it from `generate-samples.ts` and add its resources to the list written out.
- A fixed, hand-written resource: create `samples/baseline/` and drop a JSON file there. Only do this when the API cannot produce the resource.

The validator only checks the profiles a resource declares in `meta.profile`, so API code must set it.

## Known limitations

- Offline terminology (default): UCUM units and SNOMED/LOINC codes are not checked and show up as warnings. Codes from the OAH code system are checked, because that code system is part of the IG.
- References are not resolved. The validator checks that `Observation.subject` points to a `Location`, but not that the Location exists or conforms to `LocationOah`.
- Every sample gets a `dom-6` warning (no narrative `text`). This is a best-practice warning, not an error.
- The seeded health-measure baselines warn that an Observation should have a performer. `ObservationHealthMeasureOah` does not require one.
- `hl7.fhir.r4.core` is seeded from hl7.org because SUSHI's registry download of it often fails.
