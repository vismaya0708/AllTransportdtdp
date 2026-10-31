# Contributing

Use Node.js 26+ and `npm ci`. Follow the README to configure a development
Supabase project; keep credentials in ignored `.env` files.

- Keep React screens usable on narrow mobile displays and with a keyboard.
- Preserve sample-data disclaimers for all transport modes.
- Put transport fixtures in `server/data/`; do not invent live provider data.
- Verify tokens server-side and derive ownership from the verified user.
- Never trust public signup metadata for roles. Keep RLS and column grants in
  sync with the API and test through authenticated Supabase REST clients.
- Add new database migrations rather than modifying an already applied schema.
- Never put secrets or service-role keys into browser configuration.

Run `npm test` and `npm run build` before submitting. Verify browser navigation,
email confirmation/recovery, profile updates, bookmarks, and HOD authorization
against a development Supabase project. See `docs/SUPABASE.md` for RLS checks.

The PWA worker and cache version are generated from production assets. Check
offline shell loading and confirm API responses never enter Cache Storage.
