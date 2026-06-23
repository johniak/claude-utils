#!/usr/bin/env bash
# Installer for the /review PR-review skill.
# Copies the skill into ~/.claude/skills/review so Claude Code can discover it.
set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$SRC_DIR/skill"
SKILL_DST="$CLAUDE_DIR/skills/review"

echo "→ Installing /review skill into $SKILL_DST"

mkdir -p "$CLAUDE_DIR/skills"

# Preserve any existing memory/NOTES.md (accumulated review knowledge)
if [ -f "$SKILL_DST/memory/NOTES.md" ]; then
  cp "$SKILL_DST/memory/NOTES.md" "/tmp/review-notes-backup.$$.md"
  echo "• Preserving your existing memory/NOTES.md"
  KEEP_NOTES=1
fi

rm -rf "$SKILL_DST"
mkdir -p "$SKILL_DST"
cp -R "$SKILL_SRC/." "$SKILL_DST/"

if [ "${KEEP_NOTES:-0}" = "1" ]; then
  mkdir -p "$SKILL_DST/memory"
  mv "/tmp/review-notes-backup.$$.md" "$SKILL_DST/memory/NOTES.md"
fi

echo "✓ Installed. Invoke it in Claude Code with:  /review <PR_URL>"
echo "  (Restart Claude Code if it doesn't appear immediately.)"
