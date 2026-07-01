# Plan: Claude Code Status PWA

## Solution Approach

Build a new self-contained tool directory, `claude-status/`, matching the existing repo pattern where each utility has its own `README.md`, `install.sh`, and `uninstall.sh`.

The MVP should have three pieces:

- A LAN server that stores current session state plus short event history, exposes REST ingest endpoints for host agents, and broadcasts updates to the PWA over WebSocket.
- A host-side Claude Code hook reporter installed into `~/.claude/settings.json`, plus a small scanner/heartbeat agent for discovering existing sessions from local Claude Code state where hooks alone are not enough.
- A mobile-first Vite/React PWA that shows read-only status cards for sessions across hosts.

Use TypeScript for server, agent, shared types, and frontend. Keep persistence simple: append JSONL events plus an in-memory reducer rebuilt on startup. Avoid SQLite in the MVP unless the event history requirements grow.

Because mobile PWA install/service worker support generally requires a secure context, the LAN server should support HTTPS in MVP. The plan should document a simple local certificate path, for example `mkcert`, while still keeping the app LAN-only and unauthenticated.

Relevant docs to verify during implementation:

- Claude Code hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- PWA installability: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Secure contexts: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts

## Ordered Steps

### 1. Scaffold `claude-status/`

Touch:

- `claude-status/package.json`
- `claude-status/tsconfig.json`
- `claude-status/vite.config.ts`
- `claude-status/src/shared/`
- `claude-status/src/server/`
- `claude-status/src/agent/`
- `claude-status/src/web/`
- `claude-status/README.md`
- root `README.md`

Create a self-contained Node/TypeScript project under `claude-status/`. Do not turn the repo root into a broad monorepo unless needed. Add scripts for `dev`, `build`, `test`, `server`, `agent`, and `web`.

Verification:

- `cd claude-status && npm install`
- `npm run build`
- `npm test`

### 2. Define Shared Event And Session Model

Touch:

- `claude-status/src/shared/types.ts`
- `claude-status/src/shared/reducer.ts`
- `claude-status/src/shared/reducer.test.ts`

Define:

- `HostId`, `SessionId`, `ProjectPath`, `SessionTitle`
- `SessionStatus`: `active`, `waiting`, `turn_complete`, `completed`, `error`, `stale`
- `SessionEvent`: hook events, scanner discoveries, heartbeat, manual test fixtures
- `SessionCardState`: the exact shape consumed by the dashboard

The reducer should derive current card state from events. Treat Claude Code `Stop` or equivalent end-of-turn events as `turn_complete`, not necessarily "the whole task is finished", because Claude Code cannot reliably know the user's broader goal. Preserve the final/last assistant message on that event.

Verification:

- Unit tests for status transitions: active -> waiting, active -> turn_complete, active -> error, stale after missed heartbeat.
- Unit tests for retaining the latest important message and last change time.

### 3. Build Server Ingest, State Store, And WebSocket Broadcast

Touch:

- `claude-status/src/server/index.ts`
- `claude-status/src/server/store.ts`
- `claude-status/src/server/routes.ts`
- `claude-status/src/server/ws.ts`
- `claude-status/src/server/fixtures.test.ts`

Implement:

- `POST /api/events` for host agents/hook reporters.
- `GET /api/sessions` for initial dashboard load.
- `GET /api/history?sessionId=...` for short history.
- `GET /healthz`.
- WebSocket endpoint, e.g. `/ws`, broadcasting session snapshots and deltas.
- JSONL append-only storage under `~/.claude/claude-status/server/events.jsonl` by default, configurable by env.

Use no auth in MVP, but bind default host carefully:

- server default for dashboard: `0.0.0.0` only when explicitly requested by config/CLI;
- document LAN exposure clearly;
- no endpoint should allow sending commands to Claude Code.

Verification:

- Tests post fixture events for two hosts and assert `GET /api/sessions` returns two distinct cards.
- Tests reconnect/rebuild from JSONL.
- Tests WebSocket receives update after an ingest event.

### 4. Build Claude Code Hook Reporter

Touch:

- `claude-status/src/agent/hook-reporter.ts`
- `claude-status/src/agent/normalize-hook-event.ts`
- `claude-status/src/agent/normalize-hook-event.test.ts`
- `claude-status/bin/claude-status-hook`

The hook reporter reads Claude Code hook JSON from stdin, normalizes it into `SessionEvent`, and sends it to the central server. It must:

- include host name, OS, project path, session id if available, transcript path if available, hook event name, timestamp, and message snippet if available;
- use short network timeouts so hooks do not slow Claude Code noticeably;
- spool failed sends to a local JSONL queue for retry by the agent;
- never include command output beyond the small final/important message snippet needed for the dashboard.

Verification:

- Fixture tests for the hook event payloads supported by the current Claude Code docs.
- Test failed send writes to local queue.
- Manual test by piping fixture JSON into the hook reporter and checking server state.

### 5. Add Existing Session Discovery And Heartbeat Agent

Touch:

- `claude-status/src/agent/index.ts`
- `claude-status/src/agent/transcript-scanner.ts`
- `claude-status/src/agent/queue.ts`
- `claude-status/src/agent/config.ts`

Because the user wants to monitor existing sessions without a wrapper, add an agent process that periodically scans known Claude Code local state/transcript locations and emits discovery/heartbeat events. The agent should not control sessions. Its job is to:

- discover sessions that existed before hooks were installed or before the server started;
- retry queued hook events;
- mark host liveness;
- let the server mark sessions `stale` when no updates arrive.

Document the limitation: already-running sessions may not produce precise live state until a hook fires or a transcript update is observed.

Verification:

- Unit tests for transcript discovery using fixture files.
- Integration test starts server, runs scanner against fixtures, and sees discovered cards.

### 6. Implement Installer And Uninstaller

Touch:

- `claude-status/install.sh`
- `claude-status/uninstall.sh`
- `claude-status/README.md`

Follow the existing `statusline/install.sh` style:

- respect `CLAUDE_CONFIG_DIR`, defaulting to `~/.claude`;
- require `jq`;
- back up `settings.json` before editing;
- install a hook command into `~/.claude/claude-status/`;
- merge Claude Code hook entries idempotently;
- write a simple config file with the central server URL;
- uninstall only the keys/files owned by `claude-status`.

Verification:

- Run install against a temporary `CLAUDE_CONFIG_DIR` fixture and assert generated `settings.json` contains the hook entries.
- Run uninstall against the same fixture and assert unrelated settings survive.

### 7. Build Mobile-First PWA Dashboard

Touch:

- `claude-status/src/web/App.tsx`
- `claude-status/src/web/components/SessionCard.tsx`
- `claude-status/src/web/components/StatusFilter.tsx`
- `claude-status/src/web/components/HistoryDrawer.tsx`
- `claude-status/src/web/styles.css`
- `claude-status/src/web/manifest.webmanifest`
- `claude-status/src/web/service-worker.ts`
- `claude-status/index.html`

The first screen should be the usable dashboard, not a landing page. It should show:

- attention-needed sessions first;
- status color and icon;
- title/project, host, last update time, and final/important message;
- connection state to the backend;
- filters for all, waiting, active, completed, stale;
- a compact history drawer for a selected card.

Keep the MVP read-only. No input box for sending text to Claude Code, no command buttons, and no remote terminal control.

Verification:

- Component tests for card rendering states.
- Playwright mobile viewport screenshot for readable cards and no overlapping text.
- PWA manifest and service worker are served correctly.

### 8. Add HTTPS/LAN Startup Path

Touch:

- `claude-status/src/server/tls.ts`
- `claude-status/README.md`
- `claude-status/scripts/dev-cert.md` or equivalent docs

Add config for HTTP during local development and HTTPS for LAN/mobile PWA testing. Document a practical path:

- generate a local cert with `mkcert`;
- start server with cert/key paths;
- access from phone at `https://<lan-ip>:<port>`;
- accept/trust the local CA on devices as needed.

Verification:

- Server starts with HTTP in dev.
- Server starts with configured cert/key.
- Manual mobile check: Add to Home Screen works from the LAN URL.

### 9. End-To-End Verification

Touch:

- `claude-status/tests/e2e/`
- `claude-status/README.md`

Create a fixture-driven end-to-end test:

1. Start the server.
2. Open the PWA in Playwright.
3. Post hook fixture events for two hosts and three sessions.
4. Assert cards update through WebSocket.
5. Assert final message appears after a turn-complete event.
6. Assert stale status appears after simulated heartbeat timeout.

Manual verification:

- Install on one macOS host and one Linux/WSL host.
- Point both agents at one LAN server.
- Start or continue Claude Code sessions.
- Confirm cards appear and update from the phone.

## Risks And Open Questions

- Claude Code hook payload fields can change. Implementation should keep raw payloads in debug logs/fixtures during development, but avoid exposing sensitive raw data in the dashboard.
- "Existing sessions" cannot be perfectly monitored if they never emit a hook and no transcript update can be associated with a live session. The plan mitigates this with scanning and explicit stale states.
- Detecting "completed whole task" versus "completed current turn/phase" is inherently ambiguous. MVP should label this as `turn_complete` and show the final message instead of pretending to know the broader task is done.
- No auth is acceptable only because MVP is LAN-only and read-only. If remote access or session control is added later, auth becomes mandatory.
- Mobile PWA installability over plain LAN HTTP is not reliable because service workers and installability require secure contexts in modern browsers. HTTPS support should be part of MVP, even if auth is not.
