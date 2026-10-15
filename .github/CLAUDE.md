# .github/

`workflows/refresh.yml`: on every push to `main` (and by hand): `npm ci`, `node build.mjs`, upload `dist/`, deploy to GitHub Pages. It does NOT fetch data (NBHPA blocks GitHub runners). Do not add a fetch step. The file name is historical.
