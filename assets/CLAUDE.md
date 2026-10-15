# assets/

- `logos/`: per logo key (`retro`, `vintage`, `draft`, `dek`): `<key>.webp` (page), `<key>-icon.png` (browser tab). Also `hub-icon.png`, `dek-hero.webp`. Inlined as data URIs by `build.mjs`. Keep files small (they are in every page).
- `pwa/`: `<key>-192.png`, `-512.png`, `-maskable.png` for `hub, retro, vintage, draft, dek`. Copied to `dist/icons/`. `test-pwa.mjs` checks the sizes.

A new league logo needs files in both folders. Team logos are NOT here: they load from admin.nbhpa.com at runtime.
