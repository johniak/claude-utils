# review

A `/review` skill for [Claude Code](https://claude.com/claude-code) that reviews a GitHub Pull Request like a critical senior engineer: **problem-only**, severity-sorted, and **verified against the real codebase** (not just the diff).

## What it does

- Fetches the PR with `gh` and checks out the branch (worktree) for full context.
- Reads **every changed file** line by line, verifying assumptions against the actual code — no guessing.
- Reports **only problems** (no praise), each tagged with severity and sorted most-critical first:
  🟠 Security → 🔴 Bug → 🟡 Warning → 🔵 Suggestion → ⚪ Nit.
- Produces a structured review: PR goal, general comments, specific `file:line` comments with before/after suggestions, and a verdict.
- Adapts to whatever language/framework the PR uses.
- Builds up `memory/NOTES.md` with project-specific knowledge across reviews.

It is **stack-agnostic** — point it at any repo. Comments are bilingual (English + Polish explanation by default); see the skill body to switch to a single language or a different one.

## Install

```bash
git clone https://github.com/johniak/claude-utils.git
cd claude-utils/review
./install.sh
```

This copies the skill to `~/.claude/skills/review/`. Then in Claude Code:

```
/review https://github.com/owner/repo/pull/123
```

(The installer preserves any `memory/NOTES.md` you've already accumulated.)

## Uninstall

```bash
./uninstall.sh
```

Removes `~/.claude/skills/review/` (backing up your accumulated notes to your home dir first).

## Requirements

- The [GitHub CLI](https://cli.github.com/) (`gh`), authenticated (`gh auth login`).
- A git checkout of the repo you're reviewing (so the skill can open files for context).

## Customizing

Everything lives in `skill/SKILL.md`:

- **Output language** — drop the `🇵🇱` Polish line for English-only, or swap it for another language.
- **Severity scheme** — tweak the emoji/labels and the sort order.
- **What to look for** — add stack-specific checks your team cares about.
