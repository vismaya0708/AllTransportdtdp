# Application overview

- `src/`: React screens, Supabase Auth client, authenticated API client, styles,
  and component tests. Hash navigation supports static hosting and browser back.
- `server/`: Express API with server-verified Supabase tokens, database-derived
  role checks, input validation, CORS, security headers, and rate limiting.
- `server/data/transport.js`: nine buses, three Metro lines, four MMTS corridors,
  and four localities extracted unchanged from the prototype.
- `supabase/migrations/`: PostgreSQL tables, signup trigger, trusted roles,
  per-user RLS, and restricted HOD student-query function.
- `public/`: shared PWA icon and manifest. `build/` generates the service worker
  from the built React assets, excluding all private API data.

Students register using real email addresses, confirm through Supabase, update
their profile, explore all transport modes, and save bus routes across devices.
HOD accounts use a protected overview, paginated searchable directory, student
details, and locality counts. Promote a HOD only through trusted database access;
public signup always creates a student.

Transport records are unverified sample information. There is no live tracking,
transport editing, fare prediction, or provider feed integration.
