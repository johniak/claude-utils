import { SessionEvent, SessionCardState, SessionStatus, SessionId, STALE_AFTER_MS } from "./types.js";

export function reduceEvents(
  events: SessionEvent[]
): Map<SessionId, SessionCardState> {
  const cards = new Map<string, SessionCardState>();

  for (const event of events) {
    const existing = cards.get(event.sessionId);

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

    const hostName = str(event.payload.hostName) ?? "";
    const os = str(event.payload.os) ?? "";
    const projectPath = str(event.payload.projectPath) ?? "";
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

    if (event.type === "hook" || event.type === "test") {
      const hookStatus = str(event.payload.status);
      if (hookStatus === "completed" || bool(event.payload.final)) {
        newStatus = "turn_complete";
      } else if (hookStatus === "error" || bool(event.payload.error)) {
        newStatus = "error";
      } else if (hookStatus === "waiting" || bool(event.payload.waiting)) {
        newStatus = "waiting";
      } else if (bool(event.payload.turnComplete)) {
        newStatus = "turn_complete";
      } else if (event.payload.assistantMessage || event.payload.message) {
        newStatus = "active";
      } else {
        newStatus = "active";
      }
    } else if (event.type === "discovery") {
      newStatus = "active";
    } else if (event.type === "heartbeat") {
      newStatus = existing?.status === "stale" ? "active" : existing?.status ?? "active";
    } else if (event.type === "message" || event.type === "turn_complete") {
      newStatus = "turn_complete";
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
    turn_complete: 3,
    active: 4,
    completed: 5,
  };

  result.sort((a, b) => {
    const aPriority = attentionPriority[a.status] ?? 99;
    const bPriority = attentionPriority[b.status] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.lastUpdate - a.lastUpdate;
  });

  return result;
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
