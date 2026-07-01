# claude-status

A LAN-only, read-only PWA dashboard for monitoring Claude Code sessions running on multiple local machines. Shows mobile-friendly session cards with title, host, current status, last update time, and the final or latest important message from each session.

## Architecture

```
[macOS Host] ──hook──> [claude-status-server] <──WebSocket──> [PWA Dashboard]
[Linux Host] ──hook──> [      (port 4000)     ]              [  (phone/laptop)  ]
```

- **Server**: Express + WebSocket, stores events in JSONL, broadcasts session state
- **Hook Reporter**: Reads Claude Code hook JSON from stdin, sends to server with retry queue
- **Heartbeat Agent**: Discovers existing sessions, sends heartbeats, detects stale sessions
- **PWA**: Mobile-first React dashboard with real-time WebSocket updates

## Components

### Server (`src/server/`)

- `POST /api/events` — Ingest events from hook reporters
- `GET /api/sessions` — List current session cards (with optional `?status=active,error,waiting`)
- `GET /api/history/:sessionId` — Get event history for a session
- `GET /healthz` — Health check
- `ws:/ws` — WebSocket for real-time updates

### Hook Reporter (`src/agent/`)

Installed via `install.sh` into `~/.claude/claude-status/`. Reads hook JSON from stdin and sends to the server. Failed sends are queued to a JSONL file and retried.

### Agent (`src/agent/index.ts`)

Discovers existing Claude Code sessions by scanning for `CLAUDE.md` files and sends heartbeat/discovery events.

## Installation

### Prerequisites

- `jq` installed
- Node.js 18+
- Claude Code installed

### Install

```bash
cd claude-status
npm install
npm run build
./install.sh
```

By default, the server runs on `http://127.0.0.1:4000`. To change:

```bash
CLAUDE_STATUS_SERVER_URL=http://192.168.1.100:4000 ./install.sh
```

### Uninstall

```bash
./uninstall.sh
```

## Development

```bash
npm run dev        # Start server + web in dev mode
npm run server     # Start server only
npm run web:dev    # Start web dev server
npm run agent      # Run the heartbeat/discovery agent
npm test           # Run tests
npm run build      # Build for production
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `HOST` | `127.0.0.1` | Server bind address |
| `EVENTS_PATH` | `~/.claude/claude-status/server/events.jsonl` | Events storage path |
| `TLS_KEY` | — | TLS private key path |
| `TLS_CERT` | — | TLS certificate path |
| `CLAUDE_STATUS_SERVER_URL` | `http://127.0.0.1:4000` | Server URL (for agents) |
| `CLAUDE_PROJECT_PATH` | `process.cwd()` | Project path for heartbeat |

## Security

- LAN-only by design — no authentication in MVP
- Read-only — hooks only send events, never receive commands
- No sensitive data exposed in the dashboard (only message snippets)
- HTTPS recommended for mobile PWA installability (use `mkcert` for local dev)
