# AI Usage Log

Developer: Ivone Djaja (front-end engineer)
Tool: Claude Code (Sonnet 5.5)

This log records where AI assisted development and what I contributed myself.
Do not paste secrets or real customer data (PII) into prompts or this file.

Entries from 2026-11-09 onwards were reconstructed from `git log` on 2026-11-19. Only three commits
(`0a4bb40`, `c7f680f`, `bd1198b`) carry a Claude `Co-Authored-By` trailer, so for the other commits the
history does not show who wrote what. Fields marked _not recorded_ need to be filled in by the developer.

## Summary

| Area | AI-assisted | Written by me |
|------|-------------|---------------|
| Coding | _TBD_ | _TBD_ |
| Testing | _TBD_ | _TBD_ |
| Debugging | _TBD_ | _TBD_ |
| Documentation | PRD review, this log, progress.md | _TBD_ |
| Refactoring | _TBD_ | _TBD_ |

## Entry format

```markdown
## YYYY-MM-DD – Task title
- Tool: Claude Code (Sonnet 5.5)
- Prompt: one-line intent
- AI output: what it produced
- My changes: what I edited, rejected or added
- Verification: tests / lint / manual check
- Commit: <hash>
```

## Entries

## 2026-11-07 – PRD review and AI usage documentation setup
- Tool: Claude Code (Sonnet 5.5)
- Prompt: "Review PRD.md" and "how do I document use of AI"
- AI output: review of PRD.md (ambiguities, missing acceptance criteria) and this log template
- My changes: _TBD_
- Verification: manual read-through
- Commit: _TBD_

## 2026-11-07 – App scaffold (Next.js dashboard + Mixpanel client)
- Tool: Claude Code (Sonnet 5.5), Mixpanel MCP for project discovery
- Prompt: "Create app to authenticate and get dashboard data from mixpanel"
- AI output: Next.js scaffold, Mixpanel Export API client, analytics modules, `/api/dashboard` route, dashboard UI, 24 unit tests
- My changes: _TBD_
- Verification: `npm test` (24 pass), `npm run lint`, `tsc --noEmit`, `npm run build`, curl smoke test (400 on bad window, handled 500 without credentials). Not yet verified against live Mixpanel data.
- Commit: _TBD_

## 2026-11-09 – Data sources and login (`e7cf3cf`, `bd1198b`, `ff44817`, `4aeebfc`)
- Tool: Claude Code (Sonnet 5.5) for `bd1198b` (trailer in the commit); others _not recorded_
- Prompt: _not recorded_
- AI output: `MIXPANEL_EVENTS_FILE` loader for local JSON/JSONL exports (`fixture.ts`) with tests, taking precedence over API credentials; later a flag to switch between API and file (`MIXPANEL_DATA_SOURCE`). Login by API added service account config (`e7cf3cf`).
- My changes: _not recorded_
- Verification: unit tests added with each commit (`fixture.test.ts`, `client.test.ts`); live data not checked
- Commit: `e7cf3cf`, `bd1198b`, `ff44817`, `4aeebfc`

## 2026-11-16 – Slow responses: filters, pagination, cache (`ad7c8ae` … `117f20d`)
- Tool: Claude Code (Sonnet 5.5) _assumed; not recorded in the commits_
- Prompt: _not recorded_ (commit message: "Add filters to fix slow response")
- AI output: server-side `where` filters and one export request per day (`ad7c8ae`), pagination (`66c543a`), Apply button (`cedc7ce`), `npm run debug` script (`99e73ee`), per-day in-memory cache with a 12h TTL for finished days and 60s for today (`5f630d0`), Environment and LBU filters (`f3de4f2`)
- My changes: _not recorded_. The history shows the filter commits added, reverted and re-added (`f3de4f2`, `b286f03`, `117f20d`), which suggests the first attempt was rejected.
- Verification: tests added with each commit (`dayCache.test.ts`, `client.test.ts`, `validation.test.ts`)
- Commit: `ad7c8ae`, `66c543a`, `cedc7ce`, `99e73ee`, `5f630d0`, `f3de4f2`, `b286f03`, `117f20d`

## 2026-11-17 – Left pane, Users and user events (`cd67857` … `d6cef28`)
- Tool: Claude Code (Sonnet 5.5) _assumed; not recorded in the commits_
- Prompt: _not recorded_
- AI output: left navigation pane, Users dashboard and `/api/users`, user events table with expandable event properties and a time-spent column, most/least visited pages per user. Removed the function and login mode columns (`e3a1931`) and hid the user column in the user events table (`f804431`). A further filter fix (`619e0de`).
- My changes: _not recorded_
- Verification: tests added with each commit (`LeftPane.test.tsx`, `users.test.ts`, `UsersTable.test.tsx`, `DashboardView.test.tsx`)
- Commit: `cd67857`, `7aba4e4`, `619e0de`, `361659f`, `e3a1931`, `f804431`, `846803c`, `069ffd6`, `d6cef28`

## 2026-11-18 – Login page and sessions (`5f81016`)
- Tool: Claude Code (Sonnet 5.5) _assumed; not recorded in the commit_
- Prompt: _not recorded_
- AI output: login form (service account user, secret, project ID, region), `/api/login` and `/api/logout`, server-side session store, a Sign out button in the left pane
- My changes: _not recorded_
- Verification: `LoginForm.test.tsx`, `sessionStore.test.ts`, updated route and view tests
- Commit: `5f81016`

## 2026-11-18 – Replace "Last 30 days" with a day selector
- Tool: Claude Code (Sonnet 5.5), planned first in plan mode
- Prompt: "mixpanel only has limit of 60 api calls per hour, having last 30 days option will hit this limit quickly, should we remove last 30 days and add day by day option instead?"
- AI output: the cost analysis (about 31 export calls for a cold 30-day load), then a "Day" window with a date input and prev/next arrows. The server validates the date (real calendar day, not in the future). Last hour and Last 24 hours were kept.
- My changes: chose the options in the plan (keep 1h and 24h, native date input plus arrows). Reviewed and approved the plan before implementation.
- Verification: `npm test` (196 pass), `npm run lint`, `tsc --noEmit`. Not run against live Mixpanel.
- Commit: `ab34ed9`

## 2026-11-18 – Remove dashboard sections and a column (`7eefd28`)
- Tool: Claude Code (Sonnet 5.5)
- Prompt: "Remove login mode and top journey paths from events dashboard", "Remove page performance and latenc", "Remove login mode column in user events table"
- AI output: removed the Login mode and Top journey paths sections, the Page performance and latency section and the Users table login mode column, plus the data fields and the unused `journeys.ts` module with its tests
- My changes: asked for each removal. The user events table never had a login mode column; it was in the Users table, and the AI said so and removed it there.
- Verification: `npm test` (194 pass), `npm run lint`, `tsc --noEmit`
- Commit: `7eefd28`

## 2026-11-18 – Red Apply button (`b339f06`)
- Tool: Claude Code (Sonnet 5.5)
- Prompt: "make apply button red"
- AI output: `apply-button` class using the app's existing red (`#ed1b2e`)
- My changes: _not recorded_
- Verification: lint and tests; not checked in a browser
- Commit: `b339f06`

## 2026-11-18 – Cached data: Refresh button and "Data as of" (`fc73da9`)
- Tool: Claude Code (Sonnet 5.5), planned first in plan mode
- Prompt: "I am getting data from cache, what if data is updated in mixpanel"
- AI output: a `fetchedAt` time on every cached day, a `refresh=1` parameter that bypasses the cache for one request (a failed forced reload keeps the old entry), and a `DataFreshness` component with the timestamp and a Refresh button
- My changes: chose "add refresh button and show the user how old the data is" over shortening the cache lifetime, and approved the plan.
- Verification: `npm test` (212 pass), `npm run lint`, `tsc --noEmit`. Not run against live Mixpanel.
- Commit: `fc73da9`

## 2026-11-18 – LBU as a text input (`e30239c`)
- Tool: Claude Code (Sonnet 5.5)
- Prompt: "can we get value of mixpanel filter", then "change lbu to be a text input instead of selection"
- AI output: first a plan to load dropdown options from Mixpanel; after the developer chose that it was built but is not in the committed history. Then LBU became a free-text input: the server accepts any 1-50 character value (letters, digits, space, `_`, `.`, `-`) and rejects quotes and control characters, and Apply is disabled for an invalid value.
- My changes: chose the text input. The Mixpanel-backed dropdown lookup was not kept.
- Verification: `npm test` (222 pass), `npm run lint`, `tsc --noEmit`
- Commit: `e30239c`

## 2026-11-19 – Page summary from one Query API call (`2fb8c65`)
- Tool: Claude Code (Sonnet 5.5); the Mixpanel MCP was tried for verification
- Prompt: "Is there a way we can check most and least visited pages in the last 30 days with minimum api call"
- AI output: a "Page summary" item that counts `page_viewed` per `page_name` over 30 days with one Segmentation API call (cached 3 hours), plus a route, cache, summary builder and tests. It shows views only, since unique visitors cannot be counted across a range.
- My changes: chose to build it from the API documentation without a live test. The MCP check was not possible because the project is in the EU region and the connected MCP server was the US one.
- Verification: `npm test` (249 pass), `npm run lint`, `tsc --noEmit`. **Not verified against the real project**; the request shape comes from documentation.
- Commit: `2fb8c65`

## 2026-11-19 – progress.md and this log
- Tool: Claude Code (Sonnet 5.5)
- Prompt: "Add progress.md based on commits history", "Add AI_USAGE.md based on commit history"
- AI output: rewrote `progress.md` and filled in this log from `git log`
- My changes: _not recorded_
- Verification: commit hashes and dates checked against `git log`
- Commit: _not committed yet_
