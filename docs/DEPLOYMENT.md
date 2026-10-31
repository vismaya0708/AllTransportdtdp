# Deployment

## Node host (recommended)

Use a Node.js 26+ host that supports long-running HTTP processes.

1. Configure the variables in `.env.example` on the host. Use the same Supabase
   project in the frontend and backend. Set `FRONTEND_ORIGIN` to the exact HTTPS
   origin of your application. Keep `VITE_API_BASE_URL` blank and `VITE_BASE_PATH=/`.
2. Run `npm ci && npm test && npm run build` as the build command.
3. Start with `npm start`. The server listens on `PORT` (default 3000), serves
   `dist/`, and exposes `/api/v1`. Terminate HTTPS at the host's reverse proxy.
4. Apply the Supabase migration before signup. Configure Supabase Auth Site URL
   and redirect allowlist, including the base URL and `?recovery=1` URL.
5. Verify `/api/v1/health`, signup with email confirmation, password recovery,
   student/HOD permissions, and bookmark persistence with separate accounts.

Use the host's rate limiter if behind a reverse proxy; the API intentionally
does not trust arbitrary forwarded IP headers. Its in-memory limiter is per
process. Use a shared limiter for multiple instances.

Frontend `VITE_*` values are compiled into the bundle. Rebuild after changing
them. The API uses only the public publishable/anon key and verified caller
tokens. No service-role key is necessary. Never use one in a `VITE_*` variable.

## GitHub Pages frontend + separate Node API

GitHub Pages can host the React build, but cannot run Node. First deploy the
Node server to an HTTPS host; configure `FRONTEND_ORIGIN` to allow your Pages
origin. In GitHub repository **Settings > Secrets and variables > Actions >
Variables**, set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (public browser key)
- `VITE_API_BASE_URL=https://YOUR_API_HOST/api/v1`
- Optional `VITE_BASE_PATH`: defaults to `/repository-name/`; set `/` for a
  user/organization root site or custom domain.

Choose **GitHub Actions** in **Settings > Pages**. The workflow at
`.github/workflows/deploy-pages.yml` installs, tests, builds, and uploads only
`dist/` on pushes to `main` or manual dispatch. For a deployable authenticated
application, all three project/API variables must be configured. With no
Supabase configuration, the build deliberately shows setup guidance.

## Offline support

`build/pwa.js` generates `dist/service-worker.js` from the production bundle.
It precaches HTML, JS, CSS, manifest, and icon with a content-derived cache
version. API and Supabase traffic is never cached. The shell can open offline;
transport and account queries require a connection. A new worker waits for
existing tabs to close, preserving matching HTML and asset versions.

Serve the built app, load it once, wait for activation in browser DevTools,
then enable Offline and reload. Test both `/` and a project base path. The
app should show an offline/error state without disclosing cached account data.
Use HTTPS or localhost. Development mode does not register a service worker.
