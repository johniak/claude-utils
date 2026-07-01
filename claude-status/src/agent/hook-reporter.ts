import { AgentConfig } from "../shared/types.js";
import { normalizeHookEvent } from "./normalize-hook-event.js";
import { EventEmitter } from "events";

const QUEUE_FILE = "claude-status-queue.jsonl";

export class HookReporter {
  private serverUrl: string;
  private config: AgentConfig;
  private queuePath: string;
  private queue: Array<Record<string, unknown>> = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;

  constructor(config: AgentConfig) {
    this.serverUrl = config.serverUrl;
    this.config = config;
    this.queuePath = config.queuePath || QUEUE_FILE;
  }

  async loadQueue(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const fs = await import("fs");
      if (fs.existsSync(this.queuePath)) {
        const data = fs.readFileSync(this.queuePath, "utf-8");
        this.queue = data
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => JSON.parse(l));
      }
    } catch {
      this.queue = [];
    }
  }

  async sendEvent(rawPayload: Record<string, unknown>): Promise<void> {
    await this.loadQueue();

    const normalized = normalizeHookEvent(rawPayload, this.config);
    if (!normalized) {
      return;
    }

    const success = await this.postToServer(normalized as Record<string, unknown>);

    if (!success) {
      this.queue.push(normalized as Record<string, unknown>);
      await this.saveQueue();
      this.scheduleRetry();
    }
  }

  private async postToServer(event: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async saveQueue(): Promise<void> {
    try {
      const fs = await import("fs");
      const dir = require("path").dirname(this.queuePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        this.queuePath,
        this.queue.map((e) => JSON.stringify(e)).join("\n")
      );
    } catch {
      // silently fail queue saves
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      await this.retryQueue();
    }, 5000);
  }

  private async retryQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const failed: Record<string, unknown>[] = [];
    for (const event of this.queue) {
      const success = await this.postToServer(event);
      if (success) {
        // removed from queue implicitly
      } else {
        failed.push(event);
      }
    }
    this.queue = failed;
    await this.saveQueue();
  }
}

export function createReporterFromStdin(): void {
  const config: AgentConfig = {
    serverUrl: process.env.CLAUDE_STATUS_SERVER_URL || "http://127.0.0.1:4000",
    hostName: process.env.HOSTNAME || "unknown",
    os: process.env.OS || "darwin",
    projectPath: process.env.CLAUDE_PROJECT_PATH || "",
    heartbeatIntervalMs: 15000,
    queuePath: process.env.CLAUDE_STATUS_QUEUE_PATH || QUEUE_FILE,
  };

  const reporter = new HookReporter(config);

  process.stdin.setEncoding("utf-8");
  let buffer = "";

  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const payload = JSON.parse(line);
        reporter.sendEvent(payload);
      } catch {
        // silently skip malformed JSON
      }
    }
  });

  process.on("SIGTERM", async () => {
    await reporter.saveQueue();
    process.exit(0);
  });
}
