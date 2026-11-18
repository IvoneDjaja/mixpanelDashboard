# Progress

AI usage for each task is logged in [AI_USAGE.md](AI_USAGE.md). Link the entry when a task is done.

Built from `git log` (2026-11-07 to 2026-11-18). Items are checked only when a commit shows the work; nothing here has been confirmed against live data.

## Planning and requirements

- [x] Review PRD.md (see AI_USAGE.md, 2026-11-07)
- [x] Set up AI usage log
- [x] Rewrite PRD.md into clean requirements with acceptance criteria
- [x] Inspect the events export and map events/properties to requirements
- [x] Define data source: Mixpanel API by default, local JSON files as an option (`MIXPANEL_DATA_SOURCE`)
- [ ] Resolve PRD open questions (latency property, capability mapping)
- [ ] Break down implementation tasks

## What the app does now

Next.js + TypeScript + Jest. Server-side Mixpanel client; every view is scoped by Environment and LBU.

- [x] **Events**: most/least visited pages, time on page, paginated raw events table with expandable properties and a time-spent column
- [x] **Users**: most recent users, with a per-user events table and that user's most/least visited pages
- [x] **Time range**: Last hour, Last 24 hours, or a single UTC day with a date picker and prev/next arrows
- [x] **Filters**: Environment dropdown, free-text LBU, Apply button (red); edits never fetch until Apply
- [x] **Freshness**: "Data as of" timestamp and a Refresh button that bypasses the cache
- [x] **Login / logout**: service account credentials, project ID and region; server-side session
- [x] **Left pane** navigation with Sign out

## Work log

### 2026-11-07: Foundation
- `709b163`, `47fb3e6`, `0a4bb40` Init Claude project; add AI_USAGE.md, progress.md and a clean PRD
- `c7f680f` Next.js dashboard with Mixpanel Export client and analytics (sessions, page visits, time on page)

### 2026-11-09: Data sources and login
- `e7cf3cf` Login by API (service account config)
- `bd1198b` Load events from local JSON files (`MIXPANEL_EVENTS_FILE`)
- `ff44817` Add screenshot to the docs
- `4aeebfc` Flag to switch between API and file

### 2026-11-16: Performance and filters
- `ad7c8ae` Server-side filters and one export request per day, to fix slow responses
- `66c543a` Pagination
- `cedc7ce` Apply button
- `99e73ee` `npm run debug` script
- `5f630d0` Per-day in-memory cache (12h for finished days, 60s for today)
- `f3de4f2`, `b286f03`, `117f20d` Environment and LBU filters (added, reverted and re-added)

### 2026-11-17: Users and event detail
- `cd67857` Left pane
- `7aba4e4` Users dashboard
- `619e0de` Filter fix
- `361659f` User events
- `e3a1931` Remove function and login mode columns
- `f804431` Hide the user column in the user events table
- `846803c` Event properties
- `069ffd6` Time spent column
- `d6cef28` Most/least visited pages in user events

### 2026-11-18: Rate limits, cleanup, login
- `5f81016` Login page, `/api/login` and `/api/logout`
- `ab34ed9` Replace "Last 30 days" with a day selector (Mixpanel allows 60 export calls/hour; 30 days cost about 31)
- `7eefd28` Remove the login mode, top journey paths and page performance/latency sections
- `b339f06` Red Apply button
- `fc73da9` Refresh button and "Data as of" timestamp
- `e30239c` LBU as a text input instead of a dropdown

## Open items

- [ ] Add service account credentials to `.env.local` and verify with live UAT data
- [ ] Confirm the project id / region is the Pruservices UAT project (the project is in the EU region)
- [ ] Check the Mixpanel project timezone: Mixpanel reads dates in project time, the app uses UTC days
- [ ] FR-4 latency: no latency property in events, and the section was removed from the UI
- [ ] Hourly Mixpanel call counter (60/hour) with a friendly error before hitting the limit, if wanted
- [ ] Extras: funnel/drop-off, platform/browser filters
- [ ] Remove the temporary `logScopeDiagnostics` in `src/lib/dashboardRequest.ts`
