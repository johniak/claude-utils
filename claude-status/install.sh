#!/usr/bin/env bash
# Installer for the claude-status Claude Code hook reporter.
# Installs the hook into ~/.claude/settings.json and copies the compiled agent.
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$CLAUDE_DIR/claude-status"
HOOK_SCRIPT_DST="$INSTALL_DIR/bin/claude-status-hook"
SETTINGS="$CLAUDE_DIR/settings.json"
SERVER_URL="${CLAUDE_STATUS_SERVER_URL:-http://127.0.0.1:4000}"

echo "→ Installing claude-status into $CLAUDE_DIR"

# 1. Dependency checks
if ! command -v jq >/dev/null 2>&1; then
  echo "✗ 'jq' is required — install it first"
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "✗ 'npx' (npm) is required — install Node.js first"
  exit 1
fi

# 2. Build TypeScript
echo "→ Building..."
cd "$SRC_DIR"
npx tsc --project tsconfig.json 2>&1 | tail -3 || {
  echo "✗ TypeScript compilation failed"
  exit 1
}

# 3. Create install directory and copy compiled files
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -r "$SRC_DIR/dist/." "$INSTALL_DIR/"
echo "✓ Compiled files → $INSTALL_DIR/"

# 4. Create hook script
mkdir -p "$INSTALL_DIR/bin"
cp "$SRC_DIR/bin/claude-status-hook" "$HOOK_SCRIPT_DST"
chmod +x "$HOOK_SCRIPT_DST"
echo "✓ Hook script → $HOOK_SCRIPT_DST"

# 5. Ensure settings.json exists
if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
elif ! jq empty "$SETTINGS" >/dev/null 2>&1; then
  echo "✗ $SETTINGS is not valid JSON — aborting"
  exit 1
else
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
fi
echo "✓ Backed up $SETTINGS"

# 6. Install hook idempotently
tmp="$(mktemp)"
jq --arg url "$SERVER_URL" --arg hook "$HOOK_SCRIPT_DST" \
  '.hooks = ((.hooks // {}) + {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": $hook,
            "env": { "CLAUDE_STATUS_SERVER_URL": $url }
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": $hook,
            "env": { "CLAUDE_STATUS_SERVER_URL": $url }
          }
        ]
      }
    ]
  })' \
  "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"

echo "✓ Hook entries added to settings.json"
echo "  Server URL: $SERVER_URL"
echo "Done. Restart Claude Code to activate hooks."
