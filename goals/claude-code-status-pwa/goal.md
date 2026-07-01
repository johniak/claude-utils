# Claude Code Status PWA

Build a LAN-only, read-only PWA dashboard for monitoring Claude Code sessions running on multiple local machines. The app should show mobile-friendly session cards with title, host, current status, last update time, and the final or latest important message from each session.

The shared understanding is captured in [facts.md](facts.md). The approved execution plan is captured in [plan.md](plan.md).

Done means the `claude-status/` tool is implemented with a central LAN server, host-side Claude Code hook/agent reporting for macOS and Linux/WSL, WebSocket-powered PWA updates, short local history, HTTPS support for mobile PWA installability, installer/uninstaller scripts, and automated tests covering the key reducer, ingest, WebSocket, installer, and UI behaviors described in the facts.
