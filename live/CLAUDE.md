# live/

The live stats site, **https://ldhml.com/** (owner, 2026-11-20). GitHub Pages (`flyinwhee.github.io/ldhml-site/`) is the dev/staging copy, with the branch previews at `/preview/<branch>/`.

- `worker.js`: serves `dist-live/` (the `dist/` of `main`, without previews) and redirects `www.ldhml.com` to `ldhml.com`. Nothing else.
- `wrangler.jsonc`: the Worker `ldhml-site`, custom domains `ldhml.com` and `www.ldhml.com`.
- Deploy: `.github/workflows/refresh.yml` ("Refresh and publish"), on every push to `main`, after the build. It needs two GitHub secrets: `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID`. Without them the step is skipped and only Pages deploys.

Rules:
- Hard rule 1 holds: this Worker never fetches NBHPA. Visitors' browsers do.
- Same files as Pages: never build a different site for live. A difference between staging and live is a bug.
- The data refresh (`npm run fetch:force`, or the tools admin "Données du site public") pushes to `main`, so it reaches ldhml.com by this same deploy.
