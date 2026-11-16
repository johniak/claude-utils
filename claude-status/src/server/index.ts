import express from "express";
import { createServer, Server } from "http";
import { createServer as createHttpsServer } from "https";
import { createRouter } from "./routes.js";
import { EventStore } from "./store.js";
import { WebSocketBroadcaster } from "./ws.js";
import {
  ServerConfig,
  DEFAULT_PORT,
  DEFAULT_HOST,
  HEARTBEAT_INTERVAL_MS,
  STALE_AFTER_MS,
} from "../shared/types.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10),
    host: process.env.HOST ?? DEFAULT_HOST,
    eventsPath:
      process.env.EVENTS_PATH ??
      path.join(process.env.HOME || "", ".claude", "claude-status", "server", "events.jsonl"),
    heartbeatIntervalMs:
      parseInt(process.env.HEARTBEAT_INTERVAL_MS ?? String(HEARTBEAT_INTERVAL_MS), 10),
    staleAfterMs:
      parseInt(process.env.STALE_AFTER_MS ?? String(STALE_AFTER_MS), 10),
    tls:
      process.env.TLS_KEY && process.env.TLS_CERT
        ? {
            key: process.env.TLS_KEY,
            cert: process.env.TLS_CERT,
          }
        : undefined,
  };
}

let httpServer: Server;
let broadcaster: WebSocketBroadcaster;
let store: EventStore;

export async function startServer(
  configOverride?: Partial<ServerConfig>
): Promise<{
  server: Server;
  store: EventStore;
  stop: () => Promise<void>;
  url: string;
}> {
  const config: ServerConfig = {
    ...loadConfig(),
    ...configOverride,
  };

  store = new EventStore(config.eventsPath);
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createRouter(store));

  if (config.tls) {
    const httpsServer = createHttpsServer({
      key: fs.readFileSync(config.tls.key),
      cert: fs.readFileSync(config.tls.cert),
    }, app as any);
    broadcaster = new WebSocketBroadcaster(httpsServer as unknown as Server, store, config);
    httpServer = httpsServer as unknown as Server;
  } else {
    httpServer = createServer(app);
    broadcaster = new WebSocketBroadcaster(httpServer, store, config);
  }

  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, config.host, resolve);
  });

  const url = config.tls
    ? `https://${config.host}:${config.port}`
    : `http://${config.host}:${config.port}`;

  // Start stale detection loop
  startStaleChecker(config);

  return {
    server: httpServer,
    store,
    stop: async () => {
      httpServer.close();
      await broadcaster.close();
    },
    url,
  };
}

function startStaleChecker(config: ServerConfig): void {
  setInterval(() => {
    const now = Date.now();
    const cards = store.getCards();

    for (const card of cards.values()) {
      if (card.status !== "stale" && now - card.lastUpdate > config.staleAfterMs) {
        store.ingest({
          id: `stale-${card.sessionId}-${now}`,
          type: "stale_check",
          hostId: "system",
          sessionId: card.sessionId,
          timestamp: now,
          payload: { checkTime: now },
        });
      }
    }
  }, config.heartbeatIntervalMs);
}

export function getStore(): EventStore {
  return store;
}

startServer().then((s) => {
  console.log(`[claude-status server] Running at ${s.url}`);

  process.on("SIGINT", async () => {
    console.log("[claude-status server] Shutting down...");
    await s.stop();
    process.exit(0);
  });
}).catch((err) => {
  console.error("[claude-status server] Failed to start:", err);
  process.exit(1);
});
