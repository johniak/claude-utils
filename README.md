# claude-statusline

A compact, single-line **statusline for [Claude Code](https://claude.com/claude-code)** that shows — at a glance — your model, context window usage, and account rate limits, with a smart **pace marker** so you can tell whether you're burning quota faster or slower than the clock.

```
Opus 4.8 (1M context) · high  │  🧠 ⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁⛁ 13%  │  WEEK ⛁⛁│⛁⛁⛁⛁⛁⛁⛁ 22%│37% ⟳ SAT 22:00  │  SESSION ⛁⛁⛁⛁⛁│⛁⛁⛁⛁ 23%│66% ⟳ 14:40
```

## What it shows

- **Model + effort** — `model.display_name` and the current reasoning effort level.
- **🧠 Context** — how full the context window is (matches `/context`). Banded green → orange → red with markers at ⅓ and ⅔.
- **WEEK / SESSION usage** — your 7-day and 5-hour account rate limits:
  - **first number** = quota used %, colored by **pace**: 🟢 green = you're using *slower* than time is passing (you have headroom), 🔴 red = *faster* (you'll run out before the reset).
  - **white `│` marker** on the bar = how much of the period has elapsed. Fill ending **left of `│`** → under budget; **past `│`** → over budget.
  - **second number** (white) = % of the period elapsed.
  - **⟳ time** = when that window resets (local time; day shown for the weekly window).

Everything is read from the JSON Claude Code pipes to the statusline command on stdin — **no API calls, no tokens, no caching.**

## Install

```bash
git clone https://github.com/johniak/claude-statusline.git
cd claude-statusline
./install.sh
```

Then **restart Claude Code**.

The installer copies `statusline-context.sh` into `~/.claude/` and adds this to `~/.claude/settings.json` (backing it up first):

```json
"statusLine": {
  "type": "command",
  "command": "$HOME/.claude/statusline-context.sh",
  "refreshInterval": 2
}
```

## Uninstall

```bash
./uninstall.sh
```

Removes the `statusLine` key from `settings.json` (with a backup) and deletes the script. Restart Claude Code.

## Requirements

- **`jq`** — required (the statusline parses stdin with it; the installer edits `settings.json` with it).
  macOS: `brew install jq` · Debian/Ubuntu: `sudo apt install jq`
- `bash` and `date` — handles both macOS/BSD and GNU `date`.

Without `jq` the statusline still renders the 🧠 context bar, but not the WEEK/SESSION usage bars.

## Notes

- The **WEEK/SESSION** segments only appear if your Claude Code build includes `rate_limits` in the statusline payload. The context bar always works.
- Custom config dir is honored via `CLAUDE_CONFIG_DIR` (defaults to `~/.claude`).
- Bar widths and colors are plain variables at the top of `statusline-context.sh` — tweak to taste.

## License

MIT — see [LICENSE](LICENSE).
