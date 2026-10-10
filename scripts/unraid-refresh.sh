#!/bin/bash
# Refresh the data cache from a home server (residential IP: NBHPA blocks data-center IPs).
# Needs: git with push access to the repo, and Docker (Node runs inside a container, nothing to install on the host).
# Run from the Unraid "User Scripts" plugin, for example with the cron line:  45 23 * * *
# If this script stops running, nothing breaks: the site fills the gap with live data in the visitor's browser.
set -euo pipefail

REPO="${LDHML_REPO:-/mnt/user/appdata/ldhml-site}"   # clone of the repo
cd "$REPO"

git pull --rebase --autostash -q origin main

# Node 22 in a throwaway container. node_modules stays in the clone (ignored by git).
docker run --rm -v "$REPO":/app -w /app node:22-alpine sh -c \
  '[ -d node_modules ] || npm ci --silent; node scraper/fetch.mjs'

if git diff --quiet -- data && [ -z "$(git ls-files --others --exclude-standard data)" ]; then
  echo "No change in data. Nothing to push."
  exit 0
fi

git add data
git -c user.name="LDHML refresh" -c user.email="refresh@localhost" commit -q -m "Refresh data cache"
git push -q origin HEAD:main
echo "Pushed. GitHub Pages deploys from the push."
