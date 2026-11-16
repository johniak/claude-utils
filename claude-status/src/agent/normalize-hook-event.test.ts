import { describe, it, expect } from "vitest";
import { normalizeHookEvent } from "./normalize-hook-event.js";
import { IngestRequest } from "../shared/types.js";

const baseConfig = {
  serverUrl: "http://127.0.0.1:4000",
  hostName: "test-host",
  os: "darwin",
  projectPath: "/tmp/test-project",
  heartbeatIntervalMs: 15000,
  queuePath: "/tmp/queue.jsonl",
};

describe("normalizeHookEvent", () => {
  it("normalizes a basic hook event", () => {
    const raw = { type: "test_hook", message: "hello world" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;

    expect(result).toBeDefined();
    expect(result.hostId).toBe("test-host");
    expect(result.sessionId).toBe("project:/tmp/test-project");
    expect(result.type).toBe("test_hook");
    expect(result.payload.hostName).toBe("test-host");
    expect(result.payload.message).toBe("hello world");
    expect(result.payload.projectPath).toBe("/tmp/test-project");
  });

  it("uses explicit type when provided", () => {
    const raw = { type: "custom_hook", message: "hello" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.type).toBe("custom_hook");
  });

  it("infers turn_complete when no explicit type and final flag present", () => {
    const raw = { final: true, message: "done" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.type).toBe("turn_complete");
    expect(result.payload.final).toBe(true);
  });

  it("infers error when no explicit type and error flag present", () => {
    const raw = { error: true, message: "oops" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.type).toBe("error");
    expect(result.payload.error).toBe(true);
  });

  it("infers waiting when no explicit type and waiting flag present", () => {
    const raw = { waiting: true };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.type).toBe("waiting");
  });

  it("uses provided sessionId", () => {
    const raw = { sessionId: "my-session-123", message: "test" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.sessionId).toBe("my-session-123");
  });

  it("extracts title from various fields", () => {
    const raw = { title: "My Project", message: "test" };
    let result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.payload.title).toBe("My Project");

    const raw2 = { sessionTitle: "Another Project" };
    result = normalizeHookEvent(raw2, baseConfig) as IngestRequest;
    expect(result.payload.title).toBe("Another Project");
  });

  it("extracts message from various fields", () => {
    const raw = { message: "primary", snippet: "secondary" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.payload.message).toBe("primary");

    const raw2 = { snippet: "snippet only" };
    const result2 = normalizeHookEvent(raw2, baseConfig) as IngestRequest;
    expect(result2.payload.message).toBe("snippet only");
  });

  it("uses provided timestamp", () => {
    const ts = 1234567890000;
    const raw = { timestamp: ts, message: "test" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.timestamp).toBe(ts);
  });

  it("returns null for invalid input", () => {
    expect(normalizeHookEvent(null, baseConfig)).toBeNull();
    expect(normalizeHookEvent(undefined, baseConfig)).toBeNull();
    expect(normalizeHookEvent("string", baseConfig)).toBeNull();
    expect(normalizeHookEvent(42, baseConfig)).toBeNull();
  });

  it("includes assistantMessage when present", () => {
    const raw = { assistantMessage: "I finished the task" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.payload.assistantMessage).toBe("I finished the task");
  });

  it("infers message type from assistantMessage", () => {
    const raw = { assistantMessage: "working on it" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.type).toBe("message");
  });

  it("prefers explicit type over inference", () => {
    const raw = { type: "custom_type", message: "test" };
    const result = normalizeHookEvent(raw, baseConfig) as IngestRequest;
    expect(result.type).toBe("custom_type");
  });

  it("normalizes Claude Code hook input fields", () => {
    const result = normalizeHookEvent(
      {
        session_id: "claude-session-1",
        transcript_path: "/tmp/transcript.jsonl",
        cwd: "/Users/test/my-project",
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
      },
      baseConfig
    ) as IngestRequest;

    expect(result.sessionId).toBe("claude-session-1");
    expect(result.type).toBe("hook");
    expect(result.payload.projectPath).toBe("/Users/test/my-project");
    expect(result.payload.title).toBe("my-project");
    expect(result.payload.status).toBe("active");
    expect(result.payload.hookEventName).toBe("PostToolUse");
    expect(result.payload.toolName).toBe("Bash");
    expect(result.payload.message).toBe("Bash completed");
  });

  it("marks Claude Code Stop hooks as idle", () => {
    const result = normalizeHookEvent(
      {
        session_id: "claude-session-1",
        cwd: "/tmp/project",
        hook_event_name: "Stop",
        last_assistant_message: "Finished the task",
      },
      baseConfig
    ) as IngestRequest;

    expect(result.type).toBe("hook");
    expect(result.payload.status).toBe("idle");
    expect(result.payload.message).toBe("Finished the task");
  });

  it("uses stable session ids for synthetic heartbeat events", () => {
    const result = normalizeHookEvent(
      {
        type: "heartbeat",
        sessionFile: "/Users/test/my-project/CLAUDE.md",
        projectPath: "/Users/test/my-project",
      },
      baseConfig
    ) as IngestRequest;

    expect(result.sessionId).toBe("/Users/test/my-project/CLAUDE.md");
    expect(result.type).toBe("heartbeat");
    expect(result.payload.status).toBe("idle");
  });
});
