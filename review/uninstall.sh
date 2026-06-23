#!/usr/bin/env bash
# Uninstaller for the /review skill.
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SKILL_DST="$CLAUDE_DIR/skills/review"

if [ -d "$SKILL_DST" ]; then
  # Back up accumulated notes before removing, just in case.
  if [ -f "$SKILL_DST/memory/NOTES.md" ]; then
    bak="$HOME/review-NOTES.backup.$(date +%s).md"
    cp "$SKILL_DST/memory/NOTES.md" "$bak"
    echo "• Saved your review notes to $bak"
  fi
  rm -rf "$SKILL_DST"
  echo "✓ Removed $SKILL_DST"
else
  echo "• /review skill not installed — nothing to do"
fi

echo "Done. Restart Claude Code to apply."
