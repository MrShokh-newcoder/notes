#!/bin/sh
# Copy the publishable notes from the vault, then send them to GitHub (which rebuilds the site).
set -e
cd "$(dirname "$0")/.."
node scripts/sync-vault.mjs
git add -A
if git diff --cached --quiet; then
  echo "No changes to publish."
else
  git commit -m "Update notes $(date +%Y-%m-%d)"
  git push
fi
