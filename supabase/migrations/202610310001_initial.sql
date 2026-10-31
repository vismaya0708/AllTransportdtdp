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
