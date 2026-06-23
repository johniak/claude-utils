#!/usr/bin/env bash
# Installer for the Claude Code context/usage statusline.
# Copies the statusline script into ~/.claude and wires it into settings.json.
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_SRC="$SRC_DIR/statusline-context.sh"
SCRIPT_DST="$CLAUDE_DIR/statusline-context.sh"
SETTINGS="$CLAUDE_DIR/settings.json"

echo "→ Installing Claude Code statusline into $CLAUDE_DIR"

# Dependency check
if ! command -v jq >/dev/null 2>&1; then
  echo "✗ 'jq' is required (statusline needs it; installer uses it to edit settings.json)."
  echo "  Install it:  macOS → brew install jq   |   Debian/Ubuntu → sudo apt install jq"
  exit 1
fi

# 1) Copy the script
mkdir -p "$CLAUDE_DIR"
cp "$SCRIPT_SRC" "$SCRIPT_DST"
chmod +x "$SCRIPT_DST"
echo "✓ Script → $SCRIPT_DST"

# 2) Ensure settings.json exists and is valid JSON
if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
  echo "✓ Created $SETTINGS"
elif ! jq empty "$SETTINGS" >/dev/null 2>&1; then
  echo "✗ $SETTINGS is not valid JSON — aborting so nothing is clobbered."
  exit 1
else
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
  echo "✓ Backed up settings.json"
fi

# 3) Merge the statusLine block (idempotent — overwrites just this key)
tmp="$(mktemp)"
jq '.statusLine = {type:"command", command:"$HOME/.claude/statusline-context.sh", refreshInterval:2}' \
  "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
echo "✓ Wired statusLine into settings.json"

echo
echo "Done. Restart Claude Code to see the statusline."
