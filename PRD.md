# PRD: Pruservices Customer Journey Dashboard

## 1. Goal

Pruservices is Prudential's customer-centric self-service portal. As technical owner, we want to trace how customers use the application. This dashboard turns Mixpanel UAT event data into journey, usage and performance insights.

## 2. Users

- **Primary:** Pruservices technical owner (product/engineering).
- **Secondary:** product and UX stakeholders reviewing usage patterns.

## 3. Scope

**Mandatory**
- A usable front-end interface or workflow.
- A new or enhanced backend API with business logic.
- Data retrieval, persistence or integration.
- A working end-to-end flow with validation and error handling.
- The technology and delivery standards of the supported system (Next.js, React, TypeScript).
- AI used during development, documented in `AI_USAGE.md`.
- Individual contribution must be identifiable (see `AI_USAGE.md` and git history).

**Role-relevant stretch (front-end engineer):** personally build the backend/API and data components.

A safe prototype or isolated branch is acceptable. Production deployment is not required.

## 4. Data source

- **Environment:** UAT data only (`Environment` property).
- **Source:** Mixpanel. Sample export: `events-export-3293176-1793696354441.json`.
- **Access:** Mixpanel access is requested from Anchal.

### Observed event schema (from sample export, 4 events)

| Item | Observed |
|------|----------|
| Event names | `page_viewed` only |
| Page / function | `page_name`, `capability`, `widget`, `source_screen` (some events), `$current_url` |
| Login mode | `sign_in_type` (some events, e.g. `PRUServices`) |
| User / session | `distinct_id`, `$user_id` (hashed), `$device_id` |
| Context | `Platform`, `Region`, `Lbu`, `Product`, `Environment`, `$browser`, `$os`, `$screen_width/height` |
| Timestamp | `time` (epoch seconds) |

### Data gaps

- No page load time, latency or duration property exists in the sample.
- No explicit events for login, profile change or claims submission. They would have to be inferred from `capability` / `page_name`.
- No session ID. Sessions must be derived (see FR-1).

## 5. Functional requirements

### FR-1 Customer journey paths
Show the navigation paths customers take for key functions: login mode, customer profile changes, claims submission.
- A **session** is a sequence of events from one `distinct_id` with no gap longer than 30 minutes (assumption, configurable).
- Display the most common ordered page sequences per function (`capability`).
- Display the split of login modes by `sign_in_type`.
- **Acceptance:** selecting a function shows its top paths with counts and percentages. Sessions with a single event are handled.

### FR-2 Time spent per page
- Time on page is the gap between a page view and the next event in the same session.
- The last page of a session has no duration and is excluded from averages.
- Show average and median time per `page_name`.
- **Acceptance:** durations are computed per page and the exclusion rule is applied. Pages with no valid duration show "n/a".

### FR-3 Most and least visited pages
- Rank pages by view count for the **last 24 hours** and the **last 30 days**.
- Also show unique visitors per page.
- **Acceptance:** the user can toggle between windows. Ties are broken alphabetically. An empty window shows an empty state.

### FR-4 Page performance and latency
- Show load time or latency per page along the journey, with a slow-page highlight.
- **Blocked:** the sample data has no performance property (see Open Questions). Until one is confirmed, this requirement is not implementable as written.
- **Acceptance (once data exists):** per-page p50 and p95 values, with a configurable threshold marking slow pages.

### FR-5 Additional views (own additions)
Candidates, in priority order:
1. Filters: date range, `Platform`, `Region`, `$browser`.
2. Drop-off or funnel for claims submission.
3. Traffic by hour of day.
4. Device and browser breakdown.

### FR-6 Validation and error handling
- API validates query parameters (date range, function, window) and returns 400 with a clear message on invalid input.
- The UI shows loading, empty and error states for every widget.
- Mixpanel failures or timeouts return a handled error, not a crash.

## 6. Non-functional requirements

- **Stack:** Next.js, React, TypeScript, Mixpanel library.
- **Security:** Mixpanel credentials stay server-side in environment variables and are never committed or sent to the client. Only UAT data is used. IDs are already hashed. Do not display raw user identifiers.
- **Privacy:** no real customer data in prompts, logs or commits.
- **Display:** works at desktop widths.
- **Quality:** JSDoc on all new functions, unit tests that pass, no lint errors (see CLAUDE.md Definition of Done).

## 7. Out of scope

- Production deployment.
- Authentication and role management for dashboard users.
- Real-time streaming.
- Data from non-UAT environments.

## 8. Open questions

1. Is there a Mixpanel property or event for page load time or latency? If not, can it be added, or should FR-4 use a proxy (for example the gap between `time` and `$mp_api_timestamp_ms`, which measures ingestion delay, not page performance)?
2. Which `capability` / `page_name` values correspond to login, profile change and claims submission?
3. Is a full UAT export available, or will the app call the Mixpanel API live? Which credentials and project?
4. Confirm the 30-minute session gap.
5. Is persistence required (for example caching aggregates), or is querying on demand enough?
