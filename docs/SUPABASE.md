# Supabase tables and setup

The React frontend and Node API use Supabase Auth and PostgreSQL. Copy
`.env.example` to `.env` and set the public project configuration for both.
Apply `supabase/migrations/202610310001_initial.sql` once in a new development
project's SQL editor (or through Supabase CLI migrations). The SQL below mirrors
that migration for reference; the migration file is the source of truth.
No Supabase project is provisioned or connected in the repository template.

## Required tables

| Table | Purpose | Ownership / write access |
| --- | --- | --- |
| `auth.users` | Email, password hash, identity, confirmation | Managed by Supabase Auth; never create your own password table |
| `public.profiles` | Student name, roll, year, locality | Student reads/edits own allowed fields; HOD reads students |
| `public.user_roles` | Trusted `student` / `hod` authorization | User reads own role; only trusted provisioning changes roles |
| `public.saved_routes` | Per-student bus bookmarks | Student reads/inserts/deletes own rows |

Only **three custom tables** are required. Bus, Metro, MMTS, stops, schedules,
and localities stay in static Node fixtures from `index.html`; no transport
tables, paid realtime features, or Storage buckets are needed for this version.
Do not import the prototype demo passwords or use its timestamp IDs as Auth IDs.

## Development migration

Run once as the project database administrator. This SQL intentionally creates
new objects rather than pretending to upgrade an existing deployed schema.

```sql
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  roll_number text not null unique
    check (char_length(roll_number) between 1 and 40
      and roll_number = upper(trim(roll_number))),
  year_of_study text not null
    check (year_of_study in ('1st Year', '2nd Year', '3rd Year', '4th Year')),
  locality text not null check (locality in ('LB Nagar', 'Kukatpally', 'KPHB')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'hod'))
);

create table public.saved_routes (
  user_id uuid not null references auth.users(id) on delete cascade,
  route_no text not null check (char_length(route_no) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (user_id, route_no)
);

create index profiles_locality_idx on public.profiles (locality);
create index saved_routes_recent_idx
  on public.saved_routes (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.saved_routes enable row level security;

-- Remove broad/default privileges before granting the minimum needed.
revoke all on public.profiles, public.user_roles, public.saved_routes
  from anon, authenticated;
grant select on public.profiles, public.user_roles, public.saved_routes
  to authenticated;
grant update (full_name, year_of_study, locality) on public.profiles
  to authenticated;
grant insert (user_id, route_no), delete on public.saved_routes
  to authenticated;

create policy roles_read_self on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

create policy profiles_read_self_or_hod on public.profiles
  for select to authenticated using (
    id = (select auth.uid()) or exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'hod'
    )
  );

create policy profiles_update_self_student on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid()) and exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'student'
    )
  )
  with check (
    id = (select auth.uid()) and exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'student'
    )
  );

create policy saved_read_self_student on public.saved_routes
  for select to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'student'
    )
  );
create policy saved_insert_self_student on public.saved_routes
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'student'
    )
  );
create policy saved_delete_self_student on public.saved_routes
  for delete to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'student'
    )
  );

create function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_profile_updated_at();

-- Signup metadata may supply profile fields, NEVER trusted roles.
-- Invalid/missing fields or duplicate rolls fail the Auth signup transaction.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles
    (id, full_name, roll_number, year_of_study, locality)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'full_name'),
    upper(trim(new.raw_user_meta_data ->> 'roll_number')),
    new.raw_user_meta_data ->> 'year_of_study',
    new.raw_user_meta_data ->> 'locality'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A restricted read RPC lets HOD endpoints identify students without granting
-- clients access to everybody's role rows. Apply filters/pagination in Node's
-- Supabase RPC query; never return unbounded student directories to the UI.
create function public.student_profiles()
returns setof public.profiles language sql stable security definer
set search_path = '' as $$
  select p.* from public.profiles p
  join public.user_roles target on target.user_id = p.id
  where target.role = 'student' and exists (
    select 1 from public.user_roles caller
    where caller.user_id = (select auth.uid()) and caller.role = 'hod'
  );
$$;
revoke execute on function public.student_profiles() from public, anon, authenticated;
grant execute on function public.student_profiles() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_profile_updated_at() from public, anon, authenticated;

commit;
```

### Important schema choices

- Student profiles are created atomically with Auth users by the trigger, even
  when email confirmation means no session is returned. React must always supply
  the registration metadata. Changing Auth user metadata later does not overwrite
  the trusted profile or role.
- All accounts initially have student-profile fields. To bootstrap a HOD, create
  an account with complete metadata and an unused administrative roll identifier,
  then promote it through trusted SQL below. HOD UI can hide student-only fields.
  Public signup must never accept an authoritative role field.
- `roll_number` is unique, normalized uppercase, and not editable by students.
  Admin corrections require a trusted maintenance operation.
- The locality constraint mirrors the current selectable values. Update it
  deliberately when the static fixture gains selectable localities.
- `route_no` deliberately has no foreign key because buses are static, not SQL
  records. Node validates fixture membership. Direct REST writes can create an
  unknown bookmark for the same user, so consumers must tolerate `bus: null`.
- There is no bookmark update permission. Use insert-on-conflict-do-nothing for
  an idempotent save and delete for removal; avoid an update-based upsert.
- HOD RLS permits reading all profiles. Node uses the `student_profiles` RPC
  for student lists, detail queries, and student counts; it filters to student
  accounts even when there are multiple HOD accounts. Node still checks the HOD
  role first to return `403` rather than an empty result for unauthorized users.
  The function uses a fixed search path, no dynamic SQL, and a caller-role check
  because its owner bypasses RLS. Clients cannot read other users' role rows.
- RLS denies client-side profile inserts/deletes, role writes, and anonymous
  reads. Cascades clean up profiles, roles, and bookmarks when Auth users are
  deleted by a trusted administrator.

## Provision the HOD

After creating and confirming the intended account, find its UUID in Supabase
Authentication. As a trusted administrator, substitute that UUID:

```sql
update public.user_roles
set role = 'hod'
where user_id = '<verified-hod-auth-uuid>'::uuid;
```

Check that exactly the intended row changed. Do not choose the role based merely
on an email prefix or frontend UI selection. Keep service-role/secret keys off
the browser, out of Git, and out of all `VITE_*` variables.

## Configuration

React environment (public values, not an authorization boundary):

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

Node environment:

```dotenv
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

A legacy anon key can be used where a publishable key is expected. Ordinary
Node requests forward the verified caller's Bearer token and do not need a
service-role key. Provisioning scripts can use a separate server-only secret;
never ship that script's environment to the frontend or commit `.env` files.

Configure Supabase Auth Site URL and allowlisted redirect URLs for localhost
and production. Enable email confirmation and configure reliable email delivery
and password policy. Use actual student email addresses; generated addresses
may not have inboxes and break confirmation/recovery. Keep development and
production data separate, and configure backups before collecting real data.

## Verification before launch

Use separate student A, student B, and HOD sessions plus an anonymous client:

1. Signup creates exactly one profile and student role; metadata `role: hod`
   has no effect. Invalid metadata and duplicate rolls do not leave partial rows.
2. A reads/edits A's allowed fields; cannot read/edit B, change roll or role,
   insert another profile, or grant themselves HOD.
3. A can save/delete A's routes, but cannot read/write B's bookmarks. Repeated
   saves retain one row and its original timestamp. HOD cannot write bookmarks.
4. Anonymous REST requests cannot read any of the three custom tables.
5. HOD can read student profiles; students get `403` on Node admin endpoints.
6. Auth user deletion cascades related rows. Logout/reload never exposes the
   previous account's profile or bookmarks.
7. Test RLS through the public client/REST API, not only the SQL editor or a
   service-role client, which bypasses policies.

The SQL has not been executed against a Supabase project in this repository;
these checks are required, not reported as completed tests.
