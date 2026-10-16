# scripts/

Refresh helpers for the owner's machines. They fetch, commit and push `data/` and `registry/` (new people get their id during the fetch). They do not build.

- `refresh.bat`: Windows, one click. CRLF line endings (`.gitattributes`).
- `unraid-refresh.sh`: home server (User Scripts plugin + Docker). LF line endings. Not set up yet.

- `tools-dev.bat`: Windows, one click: runs the tools (admin area) on this PC at http://localhost:8787/admin/ with a local database; asks once for an email to make a local admin. Nothing is deployed. CRLF line endings.

The refresh scripts need git push access to `main`. Keep them idempotent: no change in `data/` means no commit.
