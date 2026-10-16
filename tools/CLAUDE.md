# tools/

The LDHML tools: one Cloudflare Worker with a D1 database. Admin area now; captain area next. Read `../docs/tools.md` first.

```
src/worker.js      entry: /api/... to the API, everything else to the static assets (dist-tools/, built by ../build.mjs)
src/admin-api.js   /api/admin/...: sign-in, seasons, captains, access per season and team, audit
src/roster-api.js  /api/admin/...: people, league player lists, our teams, rosters, league rules (called by admin-api.js)
src/auth.js        passwordless sign-in (emailed code), sessions, cookies; admin and captain kinds kept apart
src/email.js       sends the code: "console" (local only) or "resend"
src/http.js        JSON responses, origin check, input cleaning
migrations/        D1 schema (SQL). Add a new numbered file; never edit an applied one.
public/            tool pages (admin/), copied into dist-tools/ by ../build.mjs with the site CSS, look.js and data/season.json
scripts/add-admin.mjs   add an admin (local or --remote); emails never go into the repo
scripts/remove-admin.mjs, scripts/seed-local.mjs (LOCAL only: season, teams, people, lists, rosters from the stats data)
test/              test-tools.mjs (npm test), d1-shim.mjs (D1 on node:sqlite)
wrangler.jsonc     Worker config. No secrets in it.
```

## Rules
1. **No personal data in git.** Admin and captain emails, sign-in data and sessions live only in D1. Never commit `.dev.vars`, exports or dumps of the database.
2. **Every feature table has a `season_id`.** Access is per season. A new feature that is not per season needs a written reason in `../docs/decisions.md`.
3. **Every change made by a person writes an `audit` row** (who, what, target, detail).
4. **The Worker never fetches NBHPA** (Cloudflare servers are blocked). It reads our snapshot (`/data/season.json`).
5. **Admin and captain stay apart:** separate tables, cookies (`__Host-ldhml_admin`, `__Host-ldhml_captain`), session kinds and URL areas (`/admin/`, `/captain/`).
6. Sign-in security (do not weaken without a decision): same answer for any email; codes 6 digits, 10 min, single use, 5 tries; 5 codes per email and 20 per IP per hour; only HMAC hashes stored (CODE_PEPPER secret); cookie `HttpOnly; Secure; SameSite=Strict`; writes need our own `Origin`.
7. The pages follow `../docs/presentation.md` (league badges, team chips, links to the stats site) and are fr/en (`STR` in `public/admin/admin.js`).
   **Admin layout rules:** every working tab has the **scope bar** (season, section, league; remembered in the browser, `ldhml-admin-scope`) and shows only that context (captains: league, team by team; players: section with a league filter; teams and rules: league). **Every add and edit form is a modal** (`S.modal`, `modalBody()`); lists keep only buttons. Errors of a modal's form show in the modal.
8. `EMAIL_MODE: "console"` and `DEV=1` (the code in the API answer) work on localhost only. Keep it so.
9. **Delete is a full delete** (test records; right to deletion, Law 25): the row, its dependent rows, its sessions and codes; audit rows stay but lose their details. Disable is the reversible option. A season can be deleted only without active access.
10. **D1 enforces foreign keys.** Delete dependent rows first, or clear `created_by` / `revoked_by` links (see `scripts/remove-admin.mjs`). The test D1 (`test/d1-shim.mjs`) enforces them too; keep it so.

## Commands
```
npm run tools:test        build + tools tests (also part of npm test; Node 22.5+)
scripts\tools-dev.bat     Windows one click: .dev.vars, local admin, build, local Worker, opens the browser
npm run tools:dev         build, local D1 schema, local Worker at http://localhost:8787/admin/ (needs tools/.dev.vars)
npm run tools:add-admin -- you@example.com "Name"            local database
npm run tools:add-admin -- you@example.com "Name" --remote   real database
npm run tools:remove-admin -- someone@example.com [--remote]  delete an admin (no admin screen yet)
npm run tools:seed        fill the LOCAL database from the current stats data (safe to run again)
```
`tools/.dev.vars` (git-ignored): `CODE_PEPPER=<any 16+ characters>` and `DEV=1`.
