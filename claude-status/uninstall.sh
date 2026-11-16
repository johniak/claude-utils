#!/usr/bin/env bash
# Uninstaller for the claude-status Claude Code hook reporter.
# Removes hook entries from settings.json and cleans up installed files.
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
HOOK_DIR="$CLAUDE_DIR/claude-status"

echo "→ Uninstalling claude-status from $CLAUDE_DIR"

# 1. Dependency check
if ! command -v jq >/dev/null 2>&1; then
  echo "✗ 'jq' is required"
  exit 1
fi

# 2. Remove hook entries from settings.json if it exists
if [ -f "$SETTINGS" ]; then
  if ! jq empty "$SETTINGS" >/dev/null 2>&1; then
    echo "✗ $SETTINGS is not valid JSON — aborting"
    exit 1
  fi

  cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
  echo "✓ Backed up $SETTINGS"

  tmp="$(mktemp)"
  jq --arg hook "$HOOK_DIR/bin/claude-status-hook" '
    def without_status_hook:
      map(select(((.hooks // []) | any(.command == $hook)) | not));

    if .hooks then
      .hooks.SessionStart = ((.hooks.SessionStart // []) | without_status_hook)
      | .hooks.UserPromptSubmit = ((.hooks.UserPromptSubmit // []) | without_status_hook)
      | .hooks.MessageDisplay = ((.hooks.MessageDisplay // []) | without_status_hook)
      | .hooks.Notification = ((.hooks.Notification // []) | without_status_hook)
      | .hooks.PermissionRequest = ((.hooks.PermissionRequest // []) | without_status_hook)
      | .hooks.PreToolUse = ((.hooks.PreToolUse // []) | without_status_hook)
      | .hooks.PostToolUse = ((.hooks.PostToolUse // []) | without_status_hook)
      | .hooks.PostToolUseFailure = ((.hooks.PostToolUseFailure // []) | without_status_hook)
      | .hooks.Stop = ((.hooks.Stop // []) | without_status_hook)
      | .hooks.StopFailure = ((.hooks.StopFailure // []) | without_status_hook)
      | .hooks.SessionEnd = ((.hooks.SessionEnd // []) | without_status_hook)
      | .hooks |= with_entries(select(.value != []))
    else
      .
    end
  ' \
    "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "✓ Hook entries removed from settings.json"
else
  echo "  No settings.json found — skipping"
fi

# 3. Remove installed files
if [ -d "$HOOK_DIR" ]; then
  rm -rf "$HOOK_DIR"
  echo "✓ Removed $HOOK_DIR"
else
  echo "  Hook directory not found — skipping"
fi

echo "Done. claude-status has been uninstalled."
