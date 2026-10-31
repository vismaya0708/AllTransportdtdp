# Code review and requirement fit

> Historical review of the original HTML import. The current branch replaces
> it with React, Node, and a configurable Supabase integration; see the README
> for current setup and validation status. The missing PWA assets and workflow
> location identified below are addressed by the generated production worker,
> public manifest/icon, and `.github/workflows/deploy-pages.yml`.

## Scope

Reviewed the source imported in commit `7fcbc0a` and present at `1f7c71c`.
The working tree had no existing changes. The latest commit only deleted a ZIP,
so reviewing only that deletion would not review the app the user requested.
No application fixes or commits were made as part of this review.

## Requirement fit

| Requirement | Current state | Proposed next step |
| --- | --- | --- |
| Mobile UI | Responsive single HTML prototype with student/HOD screens | Retain styling and navigation in React; verify on real mobile browsers |
| React frontend | Not present; rendering uses HTML strings and DOM listeners | Create a React app with screen components and explicit session/loading/error state |
| Node backend | Not present; no package manifest or API | Implement the contract in [API.md](API.md) |
| Supabase login | Demo users/passwords in browser memory | Supabase Auth with actual email confirmation/recovery; no real credentials in this prototype |
| Persistent user data | Only bus bookmarks use localStorage; signup/profile changes disappear on reload | Use the three custom tables in [SUPABASE.md](SUPABASE.md) |
| Static bus/Metro information | Nine buses and three Metro lines already defined | Copy exact values into static backend fixtures, retaining sample disclaimers |
| MMTS | Four sample corridors already defined | Preserve the same records; do not fabricate missing stops or times |
| API/schema documentation | No implemented API or schema | Proposed contracts and development schema are now documented |

Keep the existing root `index.html` prototype until the replacement is ready.
The React frontend can be hosted statically, but Node requires a separate server
host; GitHub Pages cannot run it. Choose hosting and production origins before
configuring Supabase redirects and CORS. Do not advertise live data, secure
login, or completed React/Node integration until those are implemented.

## Confirmed defects in the imported source

1. **Missing service worker** (`index.html:1229`): registration points at
   `./service-worker.js`, which is absent. Offline support advertised by the
   README cannot work; the registration request fails.
2. **Missing manifest icon** (`manifest.webmanifest:14`): the only icon points
   at absent `icons/icon.svg`. The inline page favicon does not fulfill the
   manifest reference. Add real manifest assets and test platform installation
   requirements (including appropriate raster sizes where required).
3. **Undiscoverable deployment workflow** (`deploy-pages.yml:1-6`): GitHub
   Actions does not discover workflows in the repository root. The workflow
   needs to live under `.github/workflows/` for its triggers to run.

Demo authentication and nonpersistent signups are intentional prototype
limitations, not newly discovered security vulnerabilities. They are still
blockers to using this prototype with real students; replacing them is part
of the requested architecture, not merely connecting a database URL.

## Checks performed

- Read tracked source, manifest, deployment configuration, project docs, and
  Git history. No `AGENTS.md` or `AGENTS.override.md` files were found in scope.
- Executed the inline app script with Node 22 in a mocked DOM and rendered all
  18 screen functions with both student and HOD fixtures: 36 render calls passed.
- Confirmed fixture counts: 9 buses, 3 Metro lines, 4 MMTS routes.
- Checked local asset/workflow paths: the worker, manifest icon, and expected
  `.github/workflows/deploy-pages.yml` path are absent.
- No package/test runner exists. Mocked rendering does not verify real browser
  layout, authorization, PWA installation, or end-to-end interaction. No live
  Supabase database, SQL migration, API, or production deployment was tested.

## Suggested implementation order

1. Extract transport/locality fixtures without changing their content.
2. Create React components from the prototype and verify narrow-screen flows.
3. Configure Supabase Auth and apply/test the development schema and RLS.
4. Implement Node token verification, profile/bookmark endpoints, then HOD reads.
5. Add authorization, persistence, fixture, and mobile browser tests.
6. Repair and verify PWA assets and production deployment configuration.

Do not cache Auth, profile, bookmark, or HOD responses in a service worker.
