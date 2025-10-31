#!/usr/bin/env bash

set -euo pipefail

# Usage:
#   scripts/gh-release-and-deploy.sh v2.1.7 user@your-live /opt/billing
# Requires:
#   - gh (GitHub CLI) logged in: gh auth status
#   - git with push access
#   - SSH access to server

TAG="${1:-}"
SERVER="${2:-}"
REMOTE_PATH="${3:-/opt/billing}"

if [[ -z "$TAG" || -z "$SERVER" ]]; then
  echo "Usage: $0 <tag> <user@host> [remote_path]"
  exit 1
fi

echo "📦 Preparing release $TAG"

# Ensure clean tree
git fetch origin --tags

# Bump tag if not exists
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "🔖 Creating tag $TAG"
  git tag "$TAG"
  git push origin "$TAG"
else
  echo "🔖 Tag $TAG already exists"
fi

# Find changelog file
CHANGELOG_FILE="CHANGELOG_${TAG}.md"
if [[ ! -f "$CHANGELOG_FILE" ]]; then
  # fallback: try normalize (e.g. v2.1.7 -> CHANGELOG_v2.1.7.md)
  CHANGELOG_FILE="CHANGELOG_${TAG}.md"
fi

NOTES=""
if [[ -f "$CHANGELOG_FILE" ]]; then
  NOTES="--notes-file $CHANGELOG_FILE"
fi

echo "🚀 Creating GitHub release $TAG"
gh release create "$TAG" --title "$TAG" $NOTES || echo "(info) Release may already exist"

echo "🛳️  Deploying to $SERVER:$REMOTE_PATH"
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$SERVER" bash -lc "
  set -e
  cd '$REMOTE_PATH'
  echo '→ Fetching tags'
  git fetch --tags --force
  echo '→ Checkout $TAG'
  git checkout -f '$TAG'
  echo '→ Install deps'
  npm install --no-audit --no-fund
  echo '→ Build'
  npm run build
  echo '→ Restart PM2'
  pm2 restart billing-app || pm2 start dist/server.js --name billing-app
  pm2 list
"

echo "✅ Release $TAG created and deployed."




