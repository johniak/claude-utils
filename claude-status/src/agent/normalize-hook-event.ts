import { AgentConfig, IngestRequest } from "../shared/types.js";
import path from "path";

export function normalizeHookEvent(
  raw: unknown,
  config: AgentConfig
): IngestRequest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const rec = raw as Record<string, unknown>;

  const hookEventName = stringValue(rec.hook_event_name) || stringValue(rec.type);
  const eventType = inferEventType(rec);
  const timestamp =
    (rec.timestamp as number) ||
    (rec.time as number) ||
    Date.now();
  const projectPath =
    stringValue(rec.cwd) ||
    stringValue(rec.projectPath) ||
    config.projectPath;
  const sessionId =
    stringValue(rec.sessionId) ||
    stringValue(rec.session_id) ||
    stringValue(rec.transcript_path) ||
    stringValue(rec.transcriptPath) ||
    stringValue(rec.sessionFile) ||
    (projectPath ? `project:${projectPath}` : "") ||
    `auto-${config.hostName}-${Date.now()}`;
  const status = inferStatus(rec);
  const message = extractMessage(rec);

  const payload: Record<string, unknown> = {
    hostName: config.hostName,
    os: config.os,
    projectPath,
    message,
    title: extractTitle(rec, projectPath),
    status,
  };

  if (hookEventName) {
    payload.hookEventName = hookEventName;
  }
  if (rec.transcript_path) {
    payload.transcriptPath = rec.transcript_path;
  }
  if (rec.cwd) {
    payload.cwd = rec.cwd;
  }
  if (rec.tool_name) {
    payload.toolName = rec.tool_name;
  }
  if (rec.notification_type) {
    payload.notificationType = rec.notification_type;
  }
  if (rec.permission_mode) {
    payload.permissionMode = rec.permission_mode;
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
  if (rec.sessionFile) {
    payload.sessionFile = rec.sessionFile;
  }
  if (rec.lastModified) {
    payload.lastModified = rec.lastModified;
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
  const hookEventName = stringValue(raw.hook_event_name);

  if (hookEventName) {
    return "hook";
  }

  const explicitType = stringValue(raw.type);
  if (explicitType) {
    return explicitType;
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

function inferStatus(raw: Record<string, unknown>): string {
  const explicitStatus = normalizeStatus(stringValue(raw.status));
  if (explicitStatus) return explicitStatus;

  const hookEventName = stringValue(raw.hook_event_name);
  switch (hookEventName) {
    case "SessionStart":
    case "UserPromptSubmit":
    case "MessageDisplay":
    case "PreToolUse":
    case "PostToolUse":
    case "PostToolBatch":
    case "CwdChanged":
    case "FileChanged":
    case "ConfigChange":
      return "active";
    case "Notification":
    case "PermissionRequest":
    case "TeammateIdle":
    case "Elicitation":
      return "waiting";
    case "Stop":
    case "SubagentStop":
    case "TaskCompleted":
    case "SessionEnd":
      return "idle";
    case "StopFailure":
    case "PostToolUseFailure":
      return "error";
    default:
      break;
  }

  const explicitType = stringValue(raw.type);
  switch (explicitType) {
    case "heartbeat":
    case "discovery":
      return "idle";
    case "message":
      return "active";
    case "turn_complete":
    case "completed":
      return "idle";
    case "error":
      return "error";
    default:
      break;
  }

  if (raw.final === true) return "idle";
  if (raw.error === true) return "error";
  if (raw.waiting === true) return "waiting";
  return "active";
}

function extractMessage(raw: Record<string, unknown>): string {
  const direct =
    stringValue(raw.message) ||
    stringValue(raw.snippet) ||
    stringValue(raw.lastMessage) ||
    stringValue(raw.assistantMessage) ||
    stringValue(raw.last_assistant_message) ||
    stringValue(raw.delta);

  if (direct) return direct;

  const hookEventName = stringValue(raw.hook_event_name);
  const toolName = stringValue(raw.tool_name);
  switch (hookEventName) {
    case "SessionStart":
      return "Session started";
    case "UserPromptSubmit":
      return "Prompt submitted";
    case "PreToolUse":
      return toolName ? `Using ${toolName}` : "Using tool";
    case "PostToolUse":
      return toolName ? `${toolName} completed` : "Tool completed";
    case "PostToolUseFailure":
      return toolName ? `${toolName} failed` : "Tool failed";
    case "Stop":
      return "Idle";
    case "SessionEnd":
      return "Session ended";
    default:
      return "";
  }
}

function extractTitle(raw: Record<string, unknown>, projectPath: string): string {
  return (
    stringValue(raw.title) ||
    stringValue(raw.sessionTitle) ||
    stringValue(raw.session_title) ||
    (projectPath ? path.basename(projectPath) : "") ||
    ""
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeStatus(value: string): string {
  switch (value) {
    case "active":
    case "running":
    case "working":
      return "active";
    case "waiting":
    case "blocked":
    case "needs_input":
      return "waiting";
    case "idle":
    case "done":
    case "turn_complete":
    case "completed":
      return "idle";
    case "error":
    case "failed":
      return "error";
    case "stale":
      return "stale";
    default:
      return "";
  }
}
