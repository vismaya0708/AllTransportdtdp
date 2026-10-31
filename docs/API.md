# Application API contract

Implemented in `server/app.js`, with a React client in `src/`.
Supabase credentials and the database migration are required for authenticated
requests. See [Supabase setup](SUPABASE.md). Transport records remain fixtures,
not live feeds. Tests use mocked Supabase responses; live RLS verification is
still required after connecting a project.

## Architecture

- React mobile-first frontend, retaining the existing screens and sample data.
- Node.js backend (Express is sufficient), exposing `/api/v1` over HTTPS.
- Supabase Auth for email/password login and PostgreSQL for user-owned data.
- Bus, Metro, MMTS, and locality records remain versioned static fixtures on the
  Node server, copied from `index.html`, not invented or fetched from live feeds.
- Use Supabase's JavaScript client in React for sign-up, login, session refresh,
  email confirmation, password recovery, and logout. Do not implement a second
  password store or issue custom authentication tokens in Node.

## Authentication

React calls these Supabase SDK methods, not Node endpoints:

| Operation | Supabase client method | Notes |
| --- | --- | --- |
| Register | `auth.signUp({ email, password, options: { data } })` | `data` contains `full_name`, `roll_number`, `year_of_study`, `locality` |
| Log in | `auth.signInWithPassword({ email, password })` | Use an actual email address, not a generated roll-number address |
| Current user/session | `auth.getUser()` / `auth.getSession()` | A client session alone is not server-side verification |
| Refresh | `auth.refreshSession()` | SDK can manage refresh automatically |
| Recover password | `auth.resetPasswordForEmail(email, { redirectTo })` | Allowlist the redirect in Supabase |
| Set recovered password | `auth.updateUser({ password })` | Requires the recovery session |
| Log out | `auth.signOut()` | Clear private frontend caches as well |

Registration metadata example:

```json
{
  "full_name": "Example Student",
  "roll_number": "DTDS004",
  "year_of_study": "1st Year",
  "locality": "LB Nagar"
}
```

With email confirmation enabled, registration may return no session: show a
confirmation message, not an authenticated dashboard. Enforce the chosen password
policy in Supabase; never log passwords, access tokens, or refresh tokens.
The initial production contract supports **email login only**. The prototype's
roll-number login would require a separately designed, rate-limited lookup flow;
do not expose a public student email directory to implement it.

All Node endpoints below except health require:

```http
Authorization: Bearer <Supabase access token>
```

Node must verify the token with Supabase Auth (`auth.getUser(token)`) or verified
project JWKS, not merely decode it. Derive the user ID from that verified token.
Use a per-request Supabase client with the caller's token so database RLS applies.
Read HOD authorization from `public.user_roles`; do not trust request bodies or
editable Auth user metadata. An API service-role client bypasses RLS and is not
appropriate for ordinary request queries.

## Conventions

- JSON requests/responses; require `Content-Type: application/json` for bodies.
- Success: `{ "data": ... }`; list responses may include `pagination`.
- Errors: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`.
- Status codes: `200` success, `204` deletion, `400` invalid request, `401` absent
  or invalid token, `403` wrong role, `404` unknown resource, `409` conflict,
  `429` throttled, `500` unexpected failure. Do not return database internals.
- IDs: Supabase UUIDs for users; bus numbers (`218-A`), Metro IDs (`red`, `blue`,
  `green`), MMTS IDs (`fl`, `medchal`, `ghatkesar`, `umdanagar`) for fixtures.
- Server timestamps are ISO-8601 UTC. Transport schedules are **display strings
  in Asia/Kolkata**, not UTC instants or predicted arrivals.
- Student lists: `page` defaults to 1; `limit` defaults to 20, maximum 100;
  positive integers only, stable order by `full_name`, then `id`.
- Restrict CORS to configured frontend origins, limit body size, rate-limit Auth
  and API traffic, validate inputs, and avoid public caching of private data.

## Endpoints

| Method | Path under `/api/v1` | Access | Result |
| --- | --- | --- | --- |
| GET | `/health` | Public | `{ "data": { "status": "ok" } }`; no secrets |
| GET | `/me` | Authenticated | Own profile and trusted role |
| PATCH | `/me` | Student | Update `full_name`, `year_of_study`, `locality` only |
| GET | `/localities` | Authenticated | Existing `LOCALITIES` fixture |
| GET | `/buses` | Authenticated | All buses, or filter with `?locality=LB%20Nagar` |
| GET | `/buses/:no` | Authenticated | Bus with ordered stops and schedule |
| GET | `/metro/lines` | Authenticated | Three existing Metro lines |
| GET | `/metro/lines/:id` | Authenticated | Line details and ordered stations |
| GET | `/mmts/routes` | Authenticated | Four existing MMTS corridors |
| GET | `/mmts/routes/:id` | Authenticated | Corridor details; stations can be absent |
| GET | `/me/saved-routes` | Student | Own saved bus routes, newest first |
| PUT | `/me/saved-routes/:no` | Student | Idempotently save an existing fixture bus; `200` |
| DELETE | `/me/saved-routes/:no` | Student | Idempotent removal; `204`, no response body |
| GET | `/admin/summary` | HOD | Counts of students, fixture buses, fixture localities |
| GET | `/admin/students` | HOD | Paginated student profiles; optional `search`, `locality` |
| GET | `/admin/students/:id` | HOD | Student profile and matching fixture buses |
| GET | `/admin/localities` | HOD | Fixture localities with student and bus counts |

Transport endpoints are read-only: the prototype's HOD “Manage” screens display
records but do not currently support editing. No transport CRUD or live tracking
is promised in this first contract. HOD can use the same transport read endpoints.

### Profile

`GET /me` example:

```json
{
  "data": {
    "id": "<auth-user-uuid>",
    "email": "student@example.edu",
    "full_name": "Example Student",
    "roll_number": "DTDS004",
    "year_of_study": "1st Year",
    "locality": "LB Nagar",
    "role": "student"
  }
}
```

Email on `/me` comes from the verified Auth user; do not duplicate passwords or
email into public profile records. Admin student responses contain profile fields
and available buses, **not Auth emails**, unless a separate authorized email
feature is explicitly implemented.

`PATCH /me` example body:

```json
{ "full_name": "Example Student", "locality": "KPHB" }
```

Reject unknown keys, role/ID/email/roll-number changes, blank names, names over
120 characters, unsupported years, and localities not selectable in the fixture.
Years are `1st Year` through `4th Year`; selectable localities are initially
`LB Nagar`, `Kukatpally`, and `KPHB` (exclude the destination `Masab Tank`). Return
the updated profile. All private profile responses use `Cache-Control: no-store`.

### Bus data

Copy all nine bus records and their exact stops, schedules, durations, statuses,
and notes from the `buses` array; preserve fixture values as display text. Example
`GET /buses/218-A` response (envelope metadata is new, bus values are existing):

```json
{
  "data": {
    "no": "218-A",
    "from": "LB Nagar",
    "to": "Masab Tank",
    "duration": "1 hr 10 min",
    "status": "Unverified",
    "notes": "Sample route and timings from the project poster — confirm with TGSRTC / Gamyam before travelling.",
    "stops": ["LB Nagar", "Chaitanyapuri", "Dilsukhnagar", "Moosarambagh", "Nampally", "Masab Tank (JNAFAU)"],
    "schedule": ["06:30 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM"]
  },
  "meta": { "source": "index.html", "sample": true, "timezone": "Asia/Kolkata" }
}
```

`GET /buses` returns an array of these records with the same `meta`. For locality
filtering, retain `busesFor`: destination equals `Masab Tank` and at least one
stop starts with the locality. A valid locality with no matches returns `[]`.
Unknown fixture IDs return `404`; do not silently substitute the first route.

Metro and MMTS responses preserve the existing arrays' field names and ordering
and include the same sample metadata. Do not convert vague MMTS times such as
`Early morning` into fabricated precise departures. React must visibly label
**all modes** as unverified sample data and recommend official confirmation.

### Saved routes

`PUT /me/saved-routes/218-A` takes no body and derives `user_id` from Auth. Return:

```json
{ "data": { "route_no": "218-A", "created_at": "2026-10-31T06:00:00.000Z" } }
```

Keep the original `created_at` for repeated saves; use conflict-do-nothing rather
than resetting it. Reject bus numbers absent from the static fixture with `404`.
GET returns an array of saved entries with a `bus` field containing the matching
fixture record. If a later fixture release removes a saved bus, return `bus: null`
and let the user remove the bookmark; never replace it with another bus.

### HOD

Verify the HOD role before querying students. Search matches name, roll number,
or locality case-insensitively; parameterize database queries. Summary response:

```json
{ "data": { "students": 3, "buses": 9, "localities": 4 } }
```

The student count is database-derived (the example is not a guaranteed count).
`GET /admin/students` returns `{ "data": [], "pagination": { "page": 1,
"limit": 20, "total": 0 } }` when empty. Unknown student IDs, including HOD IDs,
return `404`. Never return password material or arbitrary Auth metadata.

## Acceptance checks for implementation

- Missing, expired, and forged tokens receive `401`.
- Students cannot access HOD endpoints or other users' bookmarks/profiles,
  including by calling Supabase REST directly.
- Public sign-up and profile updates cannot assign or change a role.
- New accounts survive reload; unconfirmed email does not yield a dashboard.
- Bookmark saves are idempotent, isolated by user, and persist across devices.
- All fixture counts, field values, stop ordering, and disclaimers are retained.
- Loading/error/empty states, keyboard input, narrow screens, and back navigation
  work on the React app without exposing another user's cached data.
