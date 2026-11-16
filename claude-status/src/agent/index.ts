import { AgentConfig } from "../shared/types.js";
import fs from "fs";
import path from "path";
import { HookReporter } from "./hook-reporter.js";
import os from "os";
import { pathToFileURL } from "url";

const CLAUDE_TRANSCRIPT_DIR = ".claude/CLAUDE.md";
const CLAUDE_STATE_DIR = ".claude/sessions";

export class Agent {
  private config: AgentConfig;
  private reporter: HookReporter;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.reporter = new HookReporter(config);
  }

  async start(): Promise<void> {
    await this.reporter.loadQueue();
    console.log(
      `[claude-status agent] Started on ${this.config.hostName}`
    );
    this.intervalId = setInterval(() => {
      this.heartbeat();
      this.discoverSessions();
    }, this.config.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.reporter.saveQueue();
  }

  private async heartbeat(): Promise<void> {
    const projectPath = this.config.projectPath;
    if (!projectPath) return;

    const sessionFile = this.findSessionFile(projectPath);
    if (!sessionFile) return;

    const stat = fs.statSync(sessionFile);
    const lastModified = stat.mtimeMs;

    this.reporter
      .sendEvent({
        type: "heartbeat",
        lastModified,
        sessionFile,
      })
      .catch(() => {});
  }

  private async discoverSessions(): Promise<void> {
    const homeDir = process.env.HOME || ".";
    const searchPaths = [
      homeDir,
      process.cwd(),
    ];

    for (const searchPath of searchPaths) {
      try {
        const sessions = await this.scanForSessions(searchPath);
        for (const session of sessions) {
          this.reporter
            .sendEvent({
              type: "discovery",
              sessionFile: session.file,
              projectPath: session.projectPath,
              lastModified: session.lastModified,
            })
            .catch(() => {});
        }
      } catch {
        // skip paths we can't read
      }
    }
  }

  private async scanForSessions(
    rootPath: string
  ): Promise<
    Array<{ file: string; projectPath: string; lastModified: number }>
  > {
    const results: Array<{
      file: string;
      projectPath: string;
      lastModified: number;
    }> = [];

    if (!fs.existsSync(rootPath)) return results;

    const entries = fs.readdirSync(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }
        const subResults = await this.scanForSessions(fullPath);
        results.push(...subResults);
      } else if (entry.isFile()) {
        if (entry.name === "CLAUDE.md") {
          try {
            const stat = fs.statSync(fullPath);
            const projectPath = path.dirname(fullPath);
            results.push({
              file: fullPath,
              projectPath,
              lastModified: stat.mtimeMs,
            });
          } catch {
            // skip
          }
        }
      }
    }

    return results;
  }

  private findSessionFile(projectPath: string): string | null {
    const candidate = path.join(projectPath, "CLAUDE.md");
    return fs.existsSync(candidate) ? candidate : null;
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

export function loadAgentConfig(): AgentConfig {
  return {
    serverUrl:
      process.env.CLAUDE_STATUS_SERVER_URL || "http://127.0.0.1:4000",
    hostName: process.env.HOSTNAME || os.hostname() || "unknown",
    os: process.env.OS || process.platform,
    projectPath:
      process.env.CLAUDE_PROJECT_PATH ||
      process.env.CLAUDE_PROJECT_DIR ||
      process.cwd(),
    heartbeatIntervalMs: parseInt(
      process.env.HEARTBEAT_INTERVAL_MS || "15000",
      10
    ),
    queuePath:
      process.env.CLAUDE_STATUS_QUEUE_PATH ||
      path.join(process.env.HOME || ".", ".claude", "claude-status", "queue.jsonl"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const agent = createAgent(loadAgentConfig());
  agent.start().catch((err) => {
    console.error("[claude-status agent] Failed to start:", err);
    process.exit(1);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      agent.stop();
      process.exit(0);
    });
  }
}
