# Stream-to-Clinic

Entry for the OneAquaHealth IEEE Global Hackathon (Track 7, Digital Health Standards). Submission deadline: Sep 30, 2026, 9:00 PM PDT.

Read these before starting work:
- `docs/PLAN.md`: goal, scope, stages with checkboxes, and the **Current status** section (what is done, what is next).
- `docs/ARCHITECTURE.md`: tech stack with versions, hosting, deploy pipeline, repository layout.
- `HACKATHON_DETAILS.md`: rules, judging criteria and dates.

Working rules:
- Keep `docs/PLAN.md` current: tick stage items as they land and update **Current status** at the end of each work session.
- Record any tech stack or infrastructure change in `docs/ARCHITECTURE.md`.
- Use latest stable versions (LTS where it exists); do not adopt brand-new major versions whose tooling is not ready.
- No paid services. The backend host runs on a limited AWS credit.
- Use only the European OAH sites from the IG examples for seed and demo data.
- `web/` has its own `AGENTS.md`: this Next.js version differs from older ones, so read the docs in `web/node_modules/next/dist/docs/` before writing frontend code.
- Pushing to `main` deploys: Vercel for `web/`, and the EC2 host for `api/`, `fhir/` and `deploy/` changes.
- Never commit secrets. Server secrets live on the host, workflow settings are GitHub repository variables.
