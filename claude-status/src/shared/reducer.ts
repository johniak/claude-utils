import { SessionEvent, SessionCardState, SessionStatus, SessionId, STALE_AFTER_MS } from "./types.js";

const VALID_STATUSES: SessionStatus[] = ["active", "waiting", "idle", "error", "stale"];

export function reduceEvents(
  events: SessionEvent[]
): Map<SessionId, SessionCardState> {
  const cards = new Map<string, SessionCardState>();

  for (const event of events) {
    const existing = cards.get(event.sessionId);

    if ((event.type === "discovery" || event.type === "heartbeat") && !existing) {
      continue;
    }

    if (event.type === "stale_check") {
      if (existing) {
        const isStale =
          Date.now() - existing.lastUpdate > STALE_AFTER_MS;
        if (isStale && existing.status !== "stale") {
          cards.set(event.sessionId, {
            ...existing,
            status: "stale",
            lastUpdate: event.timestamp,
          });
        }
      }
      continue;
    }

    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const bool = (v: unknown) => v === true;

    const hostName =
      str(event.payload.hostName) ||
      existing?.hostName ||
      event.hostId ||
      "unknown";
    const os = str(event.payload.os) || existing?.os || "";
    const projectPath =
      str(event.payload.projectPath) ||
      existing?.projectPath ||
      "";
    const title =
      str(event.payload.title) ||
      str(event.payload.sessionTitle) ||
      projectPath.split("/").pop() ||
      "Unknown";
    const message =
      str(event.payload.message) ||
      str(event.payload.snippet) ||
      str(event.payload.lastMessage) ||
      "";

    let newStatus: SessionStatus = existing?.status ?? "active";

    const payloadStatus = normalizeStatus(str(event.payload.status));

    if (payloadStatus) {
      newStatus = payloadStatus;
    } else if (event.type === "hook" || event.type === "test") {
      if (bool(event.payload.final) || bool(event.payload.turnComplete)) {
        newStatus = "idle";
      } else if (bool(event.payload.error)) {
        newStatus = "error";
      } else if (bool(event.payload.waiting)) {
        newStatus = "waiting";
      } else {
        newStatus = "active";
      }
    } else if (event.type === "discovery") {
      newStatus = existing?.status ?? "idle";
    } else if (event.type === "heartbeat") {
      newStatus = existing?.status === "stale" ? "idle" : existing?.status ?? "idle";
    } else if (event.type === "message") {
      newStatus = "active";
    } else if (event.type === "turn_complete") {
      newStatus = "idle";
    } else if (event.type === "error") {
      newStatus = "error";
    }

    const importantMessage =
      message || (existing?.latestImportantMessage ?? "");

    cards.set(event.sessionId, {
      hostId: event.hostId,
      hostName,
      os,
      sessionId: event.sessionId,
      projectPath,
      title,
      status: newStatus,
      lastUpdate: event.timestamp,
      latestImportantMessage: importantMessage,
      eventCount: (existing?.eventCount ?? 0) + 1,
    });
  }

  return cards;
}

export function computeCardStatus(
  lastUpdate: number,
  currentStatus: SessionStatus
): SessionStatus {
  if (currentStatus === "stale") return "stale";
  if (Date.now() - lastUpdate > STALE_AFTER_MS) {
    return "stale";
  }
  return currentStatus;
}

export function getAttendedSessions(
  cards: Map<SessionId, SessionCardState>
): SessionCardState[] {
  const attended = new Map<string, SessionCardState>();

  for (const card of cards.values()) {
    const existing = attended.get(card.hostId);
    if (!existing || card.lastUpdate > existing.lastUpdate) {
      attended.set(card.hostId, card);
    }
  }

  const result = Array.from(attended.values());

  const attentionPriority: Record<SessionStatus, number> = {
    error: 0,
    waiting: 1,
    stale: 2,
    active: 3,
    idle: 4,
  };

  result.sort((a, b) => {
    const aPriority = attentionPriority[a.status] ?? 99;
    const bPriority = attentionPriority[b.status] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.lastUpdate - a.lastUpdate;
  });

  return result;
}

function normalizeStatus(value: string): SessionStatus | "" {
  if ((VALID_STATUSES as string[]).includes(value)) {
    return value as SessionStatus;
  }

  switch (value) {
    case "running":
    case "working":
      return "active";
    case "blocked":
    case "needs_input":
      return "waiting";
    case "done":
    case "turn_complete":
    case "completed":
      return "idle";
    case "failed":
      return "error";
    default:
      return "";
  }
}

export function filterByStatus(
  cards: SessionCardState[],
  statuses: SessionStatus[]
): SessionCardState[] {
  if (statuses.length === 0) return cards;
  return cards.filter((card) => statuses.includes(card.status));
}

export function getHistoryForSession(
  events: SessionEvent[],
  sessionId: string
): SessionEvent[] {
  return events
    .filter((e) => e.sessionId === sessionId)
    .slice(-50);
}
