# claude-utils

A small collection of utilities for [Claude Code](https://claude.com/claude-code).
Each tool lives in its own directory with a self-contained `install.sh` / `uninstall.sh` and its own README.

## Tools

| Tool | What it does |
|------|--------------|
| [**statusline**](statusline/) | Compact statusline showing model, context window usage, and account rate limits (weekly/session) with a pace marker that tells you if you're burning quota faster than the clock. |

## Usage

```bash
git clone https://github.com/johniak/claude-utils.git
cd claude-utils
```

Then enter any tool's directory and run its installer, e.g.:

```bash
cd statusline && ./install.sh
```

See each tool's README for details. Uninstall the same way with `./uninstall.sh`.

## License

MIT — see [LICENSE](LICENSE).
