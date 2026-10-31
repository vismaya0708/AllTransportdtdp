# All Transport Service · JNAFAU DTDP

A React application with an Express Node.js API and Supabase Auth/PostgreSQL.
Students can find bus, Metro and MMTS routes, manage their profile, and save
bus routes. HOD accounts have a protected student directory and locality overview.

**Transport data is unverified sample information**, preserved from the original
prototype. Confirm routes and times with official providers before travel.

## Run locally

Requires Node.js **26 or newer**, npm, and a Supabase development project.

```powershell
npm ci
Copy-Item .env.example .env
```

1. In `.env`, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` to the same project's
   URL and public publishable/anon key. No service-role key is needed.
2. Run `supabase/migrations/202610310001_initial.sql` once in a new Supabase
   project's SQL editor. It creates three tables, RLS policies, the signup
   trigger, and the restricted HOD read function. See [Supabase setup](docs/SUPABASE.md).
3. Set Supabase Auth Site URL to `http://localhost:5173`; allowlist that URL
   and `http://localhost:5173/?recovery=1` for confirmation and password recovery.
4. Start both applications:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Node on port 3000. Register
with a real email address and confirm your email if confirmation is enabled.
Supabase manages passwords and session refresh. Accounts and bookmarks persist
in Supabase, rather than in hardcoded accounts or local bookmark storage.

Without project credentials, the frontend shows setup guidance. The API health
endpoint still works; protected endpoints return a setup error when called with
a token. This repository supplies configuration templates, not a hosted project.

## HOD access

Register and confirm an account with complete student profile metadata first.
Then, as a trusted database administrator, promote exactly that account:

```sql
update public.user_roles set role = 'hod'
where user_id = '<verified-auth-user-uuid>'::uuid;
```

Reload the app. User-editable metadata cannot grant HOD access. HOD can read
student profiles, but not Auth passwords or a public email directory.

## Build and verify

```bash
npm test
npm run build
npm start
```

Node serves the built app and `/api/v1` together at `http://localhost:3000`.
Set Supabase Auth redirects to this origin when testing production mode.
Tests cover API validation, authentication/role gates, caller-scoped profile
updates, idempotent bookmarks, original fixtures, React account flows, stale
request handling, and generated offline caching. They mock Supabase; run the
live RLS checks in [Supabase setup](docs/SUPABASE.md) after connecting a project.

## Deployment and offline support

See [Deployment](docs/DEPLOYMENT.md). The recommended deployment runs Node with
the React build on one host. GitHub Pages can host the frontend with a separately
hosted Node API; the Actions workflow now builds and uploads `dist/`.

The production build generates a versioned service worker for static assets.
The shell loads offline, but transport queries, authentication, and account
operations require a connection. Private API responses are never cached.

## Structure

```text
src/                    React frontend and component tests
server/                 Express API and API tests
server/data/            Original sample transport fixtures
supabase/migrations/    PostgreSQL schema, triggers, grants, and RLS
public/                 PWA manifest and icon
build/                  Service worker generator and template
docs/                   API, database, and deployment guides
.env.example            Configuration template (no credentials)
```

See [API contract](docs/API.md), [architecture](docs/PROJECT-OVERVIEW.md), and
[Contributing](CONTRIBUTING.md).
