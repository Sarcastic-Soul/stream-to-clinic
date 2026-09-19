# OneAquaHealth IEEE Global Hackathon

Source: https://oneaquahealth-ieee-hackathon.devpost.com/ (+ /rules, /updates)
Fetched: 2026-09-18, re-verified 2026-09-19

## Overview
**Full name:** OneAquaHealth IEEE Global Hackathon: Healthy Waters, Healthy Ecosystems, Healthy Communities

**Theme:** Urban freshwater ecosystem monitoring using the One Health approach — citizen science + technology + environmental data for ecosystem sustainability and human well-being.

**Format:** Online, public. Global (all countries/territories except standard Devpost exceptions).

**Participants:** 891 registered (as of 2026-09-19; was 836 on 2026-09-18)

**Contact:** oneaquahealth@ieee.org

## Dates / Timeline
The main page, rules page and updates page disagree on several dates. All versions are kept below; the submission deadline is consistent everywhere and is the one that matters.

- **Submission deadline: September 30, 2026, 9:00 PM PDT** (consistent on all pages)
- Hackathon period:
  - Rules page: September 16 – September 30, 2026
  - Updates page ("Starts Tomorrow" reminder): September 14 – 30, 2026
  - Main page shows "October 01 at 12:00am EDT to deadline" — this is after the deadline, so it is almost certainly a Devpost misconfiguration. Ignore it.
- Registration:
  - Rules page: opens May 1, 2026, closes August 31, 2026
  - Main page: registration still open through Sep 30, 2026
- Judging: October 1 – October 15, 2026
- Winners announced: October 24, 2026, at the IEEE iGET Conference
- Certificates distributed within 60 days, expected by December 31, 2026

## Eligibility
The main page and rules page differ here too.

- Main page: above legal age of majority in country of residence; **students only**; **team required**; companies/professional organizations excluded; all countries/territories except standard exceptions.
- Rules page: legal age requirement in country of residence; open to **individuals or teams**; each participant can join only one team; no student-only restriction stated.
- Both: organizers and judges cannot compete; must register on Devpost before the deadline; project must be original and developed during the hackathon period.
- No team size minimum or maximum stated on either page.
- Safest reading: be a team of students.

## Prizes
Main page (pool $3,500+, prizes are overall, not per track):
- Winner: $1,500 (1)
- Runner-up: $1,000 (1)
- Second runner-up: $500 (1)
- Special Mention: $250 each (2) — "for who didnt finish in top 3 but very close"
- IEEE Certificate of Merit: top 3 teams
- IEEE Certificate of Participation: 100 participants
- IEEE Senior Member nomination eligibility: 5 winners
- Winning solutions showcased on the OneAquaHealth Open Information Hub

Rules page differences:
- Lists "5000$ Cash/InKind Prize TBD" (amount and split not final) — conflicts with the $3,500 on the main page
- Top 3 may receive a 1-year IEEE Basic Membership
- Certificate of Participation for all eligible participants (main page says 100)
- Tie-break: tied teams both receive the higher prize and the lower prize is not awarded; score ties are broken by overall impact and innovation

## Seven Tracks
| # | Track | Goal | Problem | What to build |
|---|---|---|---|---|
| 1 | Citizen Science UX | Simplify stream assessment tools and workflows | Complex tools, confusing terminology, low participation | Guided workflows, simplified ecological terms, improved data accuracy, repeat engagement features |
| 2 | Data-to-Insight | Dashboards and actionable stream health summaries | Stream data is hard to interpret | Dashboards, maps, trend analysis, One Health insight summaries |
| 3 | AI-Supported Assessment | Human-centered AI validation of observations | Citizen observations can be inconsistent | AI prompts, validation checks, explainable AI, human-in-the-loop workflows |
| 4 | Awareness & Storytelling | Engaging One Health educational content | Low awareness, lack of engaging formats | Educational modules, storytelling, personalized insights |
| 5 | Community & Gamification | Features that drive sustained participation | Low repeat engagement | Gamification, dashboards, challenges, social features |
| 6 | Resilience Informatics | Predictive alerts, early warning | Lack of predictive environmental tools | Predictive dashboards, alerts, resilience tools |
| 7 | Digital Health Standards | Enable interoperability across systems | Fragmented data and lack of standards | **FHIR models, AI agents, and integration frameworks** |

## Submission Requirements (main page)
- **Track alignment:** state the chosen track and how the project addresses its challenge
- **Project description:** problem, solution, target users, expected impact on ecosystem and human health
- **Demo video: 3–5 minutes**, showing the project in action
- **Code repository:** public GitHub (or equivalent) with source code and documentation
- **Prototype / demo:** working prototype, mockup, or proof-of-concept
- Submit before the deadline

The rules page additionally requires: original work developed during the hackathon period, and no violation of copyright, licensing, or third-party IP rights. It sets no video length, language, or license, and does not restrict use of third-party, open-source, or AI tools.

## Judging Criteria
Rules page (weighted, each scored 1–10, highest weighted total wins):
1. Impact & Alignment with OneAquaHealth Project Mission — 30%
2. Innovation & Creativity — 20%
3. Technical Implementation — 20%
4. Usability & User Experience — 15%
5. Feasibility & Scalability — 15%

Main page lists the same five with shorter names and no weights: Impact & Alignment, Innovation & Creativity, Architecture, UX, Scale.

## Judging Panel (10 judges)
- Alexander Nikolov — SYNYO GmbH
- Maria João Feio, PhD — OneAquaHealth Program Coordinator
- Pradyumna Kodgi — Oracle / IEEE
- Gora Datta — FHL7, SMIEEE, SMACM
- David E. González — IEEE Blockchain
- Vinay Sharma — Persistent Systems
- Sreekanth Reddy Panyam — IEEE Senior Member
- George Koutalieris — ENORA Innovation
- Harm op den Akker — SHINE 2Europe
- Ângela Freitas — SHINE 2Europe

## Sponsors / Partners
- OneAquaHealth (EU-funded project)
- EFMI (European Federation for Medical Informatics) and HL7 — shown together as one logo
- IEEE EMBS Orange County, IEEE Computer Society OC, IEEE Blockchain Committee, IEEE Orange County Section, IEEE Southern California Council
- ISO
- European Union

## Resources
- OneAquaHealth Citizen Science App: https://apps.oneaquahealth.eu/login
- OneAquaHealth Community (domain expertise): https://www.oneaquahealth.eu/community/
- OneAquaHealth Open Information Hub: https://www.oneaquahealth.eu/
- OneAquaHealth **OAH-FHIR Implementation Guide** — presented in Session 4; no direct link on Devpost. Found separately (2026-09-19):
  - Source: https://github.com/hl7-eu/oah — package `hl7.eu.fhir.oah`, version `0.1.0-ci-build`, FHIR 4.0.1 (R4), draft, canonical `http://hl7.eu/fhir/ig/oah`
  - Not on packages.fhir.org, and the build.fhir.org CI page currently returns 404, so build it from source with SUSHI
  - Profiles: GroupOah (cohort), LibraryOah, LocationOah, ObservationHealthMeasureOah, ObservationIndicatorsOah, ObservationWithCompOah, SpecimenOah
  - Value sets for health indicators, OAH indicators, macrophytes, riparian vegetation, specimen type, cohort characteristics; a temporary OAH CodeSystem
- Citizen Science App is also reachable at https://app.enora-oah.eu/login (installable web app; photos, videos, structured scoring of water and habitat conditions)
- OneAquaHealth Field Sampling Protocols for Urban Stream Ecosystems (CC-BY-4.0): https://zenodo.org/records/20344421
- FHIR API sandbox — demonstrated in Session 4; no direct link on Devpost
- Learning Series webinars (see Updates below)
- Social: LinkedIn, X, Facebook

---

## Updates / Announcements Timeline (newest first)

1. **Help Us Grow the OneAquaHealth Hackathon** (2026-09-19) — recruitment post noting 800+ applicants; asks participants to invite students and researchers interested in AI, data science, citizen science, digital health and freshwater ecosystems.
2. **Reminder: OneAquaHealth Hackathon Starts Tomorrow** (~2026-09-13) — competition runs Sep 14–30, 2026; submissions due Sep 30, 9:00 PM PDT. Pick one of the 7 tracks and define the problem and impact clearly. Prize pool $3,500+.
3. **Reminder: Session 4** (~2026-08-26) — "Informatics, Technology & Standards", Aug 27, 2026, 5:00–6:30 PM CET / 8:00–9:30 AM PT. Covers digital health informatics, HL7 FHIR, the OAH-FHIR Implementation Guide, and a hands-on FHIR API sandbox demo. Speakers: Alexander Nikolov, Gora Datta, Stratos Kokolakis, Giorgio Cangioli, Pradyumna Kodgi.
4. **Register Now – Session 4** (~2026-08-21) — registration notice; practical interoperability and FHIR implementation details.
5. **Join Us – Session 4** (~2026-08-18) — moves from "One Digital Health and FAIR data" to practical interoperability: how environmental observations, citizen-generated data and health data integrate.
6. **Join Session 2: Nature as Blueprint** (~June 2026) — June 30, 2026, 8:00–9:30 AM PDT / 5:00–6:30 PM CEST; "Planetary Intelligence and Human Innovation", biomimicry and biological engineering principles.
7. **Thank You for Registering – Project Introduction Session** (~June 2026) — points registrants to Session 1 on June 12, 2026.
8. **Join Us on June 12: Introduction to IEEE OneAquaHealth Project** (~May 2026) — June 12, 2026, 7:00–9:00 AM PDT / 4:00–6:00 PM CEST; introduction to the project and hackathon framework.

Not found on Devpost: a "Session 5" update. The earlier version of this file listed "Session 5: Build with OneAquaHealth (Sep 16, 2026)"; that could not be re-confirmed on the updates page and has been removed.
