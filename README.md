# Mixpanel Dashboard

A web dashboard that shows how customers use the Pruservices self-service portal, using page-view events from Mixpanel. It is built with Next.js, React and TypeScript.

## What it shows

- **Events:** most and least visited pages, time on page, and a table of raw events with their properties.
- **Users:** the most recently seen users, with each user's events and most and least visited pages.

In both events tables, clicking a row shows all of its properties in a panel beside the table, clicking a user opens that user's page, an "Event type" box filters rows by event name (case-insensitive, applied with Enter or its Apply button), and `error_encountered` rows are shaded light red.

Every view can be scoped by Environment and LBU, and by a time range: last hour, last 24 hours or one chosen day. Each page shows when its data was fetched, and a Refresh button reloads it.

## Getting started

You need Node.js and a Mixpanel service account (user, secret and project ID).

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the service account, project ID and region. Credentials are kept in server memory for the session and are never stored in the browser.

## Scripts

| Command                       | What it does                 |
| ----------------------------- | ---------------------------- |
| `npm run dev`                 | Start the development server |
| `npm run build` / `npm start` | Build and run for production |
| `npm test`                    | Run the unit tests           |
| `npm run lint`                | Run ESLint                   |

## Mixpanel limits

Mixpanel allows only 60 export calls per hour, and the dashboard makes one per day of data it loads. Finished days are cached for 12 hours, so repeat views are free. This is why there is no "last 30 days" time range.

## Learn more

- [ARCHITECTURE.md](ARCHITECTURE.md): how the app is put together
- [PRD.md](PRD.md): requirements
- [progress.md](progress.md): what is done and what is open
- [AI_USAGE.md](AI_USAGE.md): where AI assisted development
