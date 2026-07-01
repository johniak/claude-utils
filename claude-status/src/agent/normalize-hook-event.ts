import { AgentConfig, IngestRequest } from "../shared/types.js";

export function normalizeHookEvent(
  raw: unknown,
  config: AgentConfig
): IngestRequest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const rec = raw as Record<string, unknown>;

  const sessionId =
    (rec.sessionId as string) ||
    (rec.session_id as string) ||
    `auto-${config.hostName}-${Date.now()}`;

  const eventType = inferEventType(rec);
  const timestamp =
    (rec.timestamp as number) ||
    (rec.time as number) ||
    Date.now();

  const payload: Record<string, unknown> = {
    hostName: config.hostName,
    os: config.os,
    projectPath: config.projectPath,
    message: extractMessage(rec),
    title: extractTitle(rec),
  };

  if (rec.status) {
    payload.status = rec.status;
  }
  if (rec.final !== undefined) {
    payload.final = rec.final;
  }
  if (rec.error !== undefined) {
    payload.error = rec.error;
  }
  if (rec.waiting !== undefined) {
    payload.waiting = rec.waiting;
  }
  if (rec.turnComplete !== undefined) {
    payload.turnComplete = rec.turnComplete;
  }
  if (rec.assistantMessage) {
    payload.assistantMessage = rec.assistantMessage;
  }
  if (rec.snippet) {
    payload.snippet = rec.snippet;
  }

  return {
    hostId: config.hostName,
    sessionId,
    type: eventType,
    timestamp,
    payload,
  };
}

function inferEventType(raw: Record<string, unknown>): string {
  if (raw.type) {
    return raw.type as string;
  }

  if (raw.final === true || raw.status === "completed") {
    return "turn_complete";
  }
  if (raw.error === true || raw.status === "error") {
    return "error";
  }
  if (raw.waiting === true || raw.status === "waiting") {
    return "waiting";
  }
  if (raw.assistantMessage || raw.message) {
    return "message";
  }

  return "hook";
}

function extractMessage(raw: Record<string, unknown>): string {
  return (
    (raw.message as string) ||
    (raw.snippet as string) ||
    (raw.lastMessage as string) ||
    (raw.assistantMessage as string) ||
    ""
  );
}

function extractTitle(raw: Record<string, unknown>): string {
  return (
    (raw.title as string) ||
    (raw.sessionTitle as string) ||
    (raw.projectPath as string) ||
    ""
  );
}
