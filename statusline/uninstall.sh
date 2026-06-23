#!/usr/bin/env bash
# Uninstaller — removes the statusLine wiring and the script.
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SCRIPT_DST="$CLAUDE_DIR/statusline-context.sh"
SETTINGS="$CLAUDE_DIR/settings.json"

echo "→ Removing Claude Code statusline from $CLAUDE_DIR"

# 1) Drop the statusLine key (only if settings.json exists & is valid)
if [ -f "$SETTINGS" ] && jq empty "$SETTINGS" >/dev/null 2>&1; then
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
  tmp="$(mktemp)"
  jq 'del(.statusLine)' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "✓ Removed statusLine from settings.json (backup made)"
else
  echo "• No valid settings.json — skipping"
fi

# 2) Remove the script
if [ -f "$SCRIPT_DST" ]; then
  rm -f "$SCRIPT_DST"
  echo "✓ Removed $SCRIPT_DST"
else
  echo "• Script not present — skipping"
fi

echo
echo "Done. Restart Claude Code to apply."
