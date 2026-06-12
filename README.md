# Equinox India Team Portal

A lightweight full-stack web app for a small dev team to submit weekly
**Sprint Reports** and **Vacation Plans**. No login/password — users type their
name to enter. Admins get full team visibility and `.xlsx` download access;
members only see and edit their own data.

## Stack

- **Frontend:** React + Tailwind CSS (Vite)
- **Backend:** Express.js (Node.js)
- **Storage:** structured JSON files on disk under `/data` (no database)
- **Excel export:** [`exceljs`](https://www.npmjs.com/package/exceljs)

## Team & roles

| Name | Role | Notes |
|------|------|-------|
| Anmol | Admin (editing) | Full team view + his own data row |
| Julien | Admin (view-only) | Views team data + downloads, no data row, blocked from all writes |
| Vinay, Roshan, Chandrakesh, Pawan, Harit, Sushobhita, Divya | Member | Own data only |

## Getting started

```bash
# Install server + client dependencies
npm run install:all

# Dev mode — Express on :3001, Vite on :5173 (proxies /api)
npm run dev
```

Then open http://localhost:5173 and enter a name (e.g. `anmol`, `Sushobhita`,
`julien`). Name matching is case-insensitive, trimmed, and fuzzy.

### Production

```bash
npm run build      # builds the client into client/dist
npm start          # Express serves the API + built client on :3001
```

## Deploying to Vercel

The app is configured for Vercel: the React client is built to static files
(served by Vercel's CDN) and the Express backend runs as a single serverless
function (`api/index.js`, fed by `vercel.json` rewrites). Because Vercel's
filesystem is read-only/ephemeral, data is stored in **Vercel KV** in
production instead of JSON files.

**One-time setup:**

1. Import the repo into Vercel (no framework preset needed — `vercel.json`
   defines the build).
2. In the project's **Storage** tab, create a **KV** store (Upstash Redis)
   and **connect it** to the project. Vercel injects `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` automatically.
3. Deploy. That's it — the build command and routing come from `vercel.json`.

The storage layer auto-detects KV: if those env vars are present it uses KV,
otherwise it falls back to JSON files (so local `npm run dev` needs no KV).
No other configuration is required.

## Data layout (local / file mode)

```
/data/
  sprints/    2026-W22.json   # weekly hours per member
  vacations/  2026-06.json    # monthly V/H/WFH cells per member
  projects/   2026-W22.json   # per-member project breakdowns + compiled summary
```

Files auto-create with empty rows for all dev members on first access.

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/validate-name?name=` | Resolve a typed name to canonical name + role |
| GET | `/api/sprint/:weekId` | Full team (admin) or own row (member) |
| PUT | `/api/sprint/:weekId/:member` | Update one member's sprint row |
| GET | `/api/vacation/:month` | Full month (admin) or own entries (member) |
| PUT | `/api/vacation/:month/:member` | Update one member's vacation entries |
| GET | `/api/projects/:weekId` | Project breakdowns |
| PUT | `/api/projects/:weekId/:member` | Update one member's project list |
| PUT | `/api/projects/:weekId/compiled` | Anmol-only: curate the compiled summary |
| GET | `/api/download/sprint/:weekId` | Single-week sprint `.xlsx` |
| GET | `/api/download/sprint-range?from=W19&to=W22` | Multi-week `.xlsx` |
| GET | `/api/download/vacation?start=&end=` | Vacation planner `.xlsx` |
| GET | `/api/download/combined?week=&vacStart=&vacEnd=` | Combined 3-sheet `.xlsx` |

### Access rules

- Callers are identified by an `x-user-name` header (re-resolved canonically server-side).
- PUT endpoints only allow modifying the named member's own data.
- Julien is blocked from all writes (read-only admin).
- Admin GETs return full team data; member GETs return only their own.
