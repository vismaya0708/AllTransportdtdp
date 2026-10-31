# Security Policy

## Scope

This repository contains a React frontend, Node API, and Supabase Auth/database
integration. Transport schedules are unverified sample fixtures.

## Reporting

Do not publish passwords, private student information, API keys or other sensitive data in issues or pull requests. For a security concern, contact the repository owner privately through an appropriate channel.

## Important

Supabase manages authentication. Node verifies access tokens with Supabase and
uses the caller's token for queries so row-level security applies. Role records
are administrator-controlled; signup metadata cannot grant elevated access.

Keep `.env` files out of source control. Browser `VITE_*` settings are public;
never place a service-role/secret key there. Configure HTTPS, allowed origins,
email confirmation/recovery URLs, and reliable email delivery before launch.

The repository's automated tests mock Supabase. Before accepting real users,
apply the migration and verify the student/HOD/anonymous RLS checks in
`docs/SUPABASE.md` against your own development project. Private API responses
must remain `no-store` and excluded from service-worker caches.
