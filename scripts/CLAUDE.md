# scripts/

Refresh helpers for the owner's machines. They fetch, commit and push `data/` and `registry/` (new people get their id during the fetch). They do not build.

- `refresh.bat`: Windows, one click. CRLF line endings (`.gitattributes`).
- `unraid-refresh.sh`: home server (User Scripts plugin + Docker). LF line endings. Not set up yet.

Both need git push access to `main`. Keep them idempotent: no change in `data/` means no commit.
