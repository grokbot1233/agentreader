#!/usr/bin/env bash
# Publish @axiomworks/agentreader and @axiomworks/agentreader-mcp.
# Token: /workspace/agentreader/.npm_token (chmod 600, gitignored). Never echoed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="${NPM_TOKEN_FILE:-$ROOT/.npm_token}"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Missing npm token file: $TOKEN_FILE" >&2
  exit 1
fi

TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
if [[ -z "$TOKEN" ]]; then
  echo "Token file is empty: $TOKEN_FILE" >&2
  exit 1
fi

TMP_NPMRC="$(mktemp)"
cleanup() { rm -f "$TMP_NPMRC"; }
trap cleanup EXIT

cat > "$TMP_NPMRC" <<NPMRC
//registry.npmjs.org/:_authToken=${TOKEN}
registry=https://registry.npmjs.org/
NPMRC
chmod 600 "$TMP_NPMRC"

export npm_config_userconfig="$TMP_NPMRC"

echo "npm whoami:"
npm whoami

if [[ $# -gt 0 ]]; then PACKAGES=("$@"); else PACKAGES=(
  "$ROOT/packages/agentreader"
  "$ROOT/packages/agentreader-mcp"
); fi

for pkg in "${PACKAGES[@]}"; do
  name="$(node -p "require('$pkg/package.json').name")"
  ver="$(node -p "require('$pkg/package.json').version")"
  echo ""
  echo "=== Building $name@$ver ==="
  (cd "$pkg" && npm run build)
  echo "=== Publishing $name@$ver ==="
  (cd "$pkg" && npm publish --access public)
done

echo ""
echo "Done. Verify with: npm view @axiomworks/agentreader && npm view @axiomworks/agentreader-mcp"
