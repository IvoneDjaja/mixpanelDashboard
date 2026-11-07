# AI Usage Log

Developer: Ivone Djaja (front-end engineer)
Tool: Claude Code (Sonnet 5.5)

This log records where AI assisted development and what I contributed myself.
Do not paste secrets or real customer data (PII) into prompts or this file.

## Summary

| Area | AI-assisted | Written by me |
|------|-------------|---------------|
| Coding | _TBD_ | _TBD_ |
| Testing | _TBD_ | _TBD_ |
| Debugging | _TBD_ | _TBD_ |
| Documentation | PRD review, this log | _TBD_ |
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
