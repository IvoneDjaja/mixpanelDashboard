# Progress

AI usage for each task is logged in [AI_USAGE.md](AI_USAGE.md). Link the entry when a task is done.

## Tasks

- [x] Review PRD.md (see AI_USAGE.md, 2026-11-07)
- [x] Set up AI usage log
- [x] Rewrite PRD.md into clean requirements with acceptance criteria
- [x] Inspect the events export and map events/properties to requirements
- [ ] Resolve PRD open questions (latency property, capability mapping, data source)
- [ ] Define data source (export file vs Mixpanel API)
- [ ] Break down implementation tasks

## App build (see AI_USAGE.md, 2026-11-07 – App scaffold)

- [x] Scaffold Next.js + TypeScript + Jest
- [x] Mixpanel Export API client (server-side service account, EU region)
- [x] Analytics: sessions, page visits, time on page, journey paths, login modes
- [x] API route `/api/dashboard` with validation and error mapping
- [x] Dashboard UI (24h / 30d, function filter, loading/empty/error states)
- [ ] Add service account credentials to `.env.local` and verify with live UAT data
- [ ] Confirm project id / region is the Pruservices UAT project
- [ ] FR-4 latency (blocked: no latency property in events)
- [ ] Extras: funnel/drop-off, platform/browser filters
