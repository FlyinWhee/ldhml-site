# Open items

Status as of 2026-10-15.

## Needs the owner
- **NBHPA permission.** No contract or expectation that outside sites may use their public pages, endpoints or logos. The owner will raise it. Offer to draft the message (what is read, how often, no photos, unofficial label, ask for a read-only API or export).
- **Unraid refresh.** Not set up. The owner is new to Unraid: walk step by step (see `operations.md`).
- **Delete the unused Worker** (`worker/`, both `wrangler.toml`, Cloudflare Worker, GitHub variable `LDHML_API`).

## Possible work
- PWA "Install" button (Android hides "Add to Home screen"). Check offline behavior in a real browser.
- Local clock countdown between polls (smooth game clock without more requests).
- Android app (Capacitor) with local notifications; push notifications would need a server.
- Remove `LDHML_API` and meta support from code after the Worker is deleted.
- Verify English wording across all views.
- Box scores in `data/` grow every game day; if pages exceed a few MB, split box data into a lazily fetched file.

## Known source limits
See `data-formats.md` (team goals without scorer, penalties without a player, goalie data only when recorded). The source has no birth date or age for players.
