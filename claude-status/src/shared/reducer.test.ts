import { describe, it, expect } from "vitest";
import {
  reduceEvents,
  computeCardStatus,
  getAttendedSessions,
  filterByStatus,
  getHistoryForSession,
} from "./reducer.js";
import { SessionEvent } from "./types.js";

function makeEvent(
  overrides: Partial<SessionEvent>
): SessionEvent {
  const defaultPayload = {
    hostName: "my-mac",
    os: "darwin",
    projectPath: "/Users/test/project",
    message: "test message",
  };
  const { payload: overridePayload, ...restOverrides } = overrides;
  return {
    id: "evt-1",
    type: "hook",
    hostId: "host-1",
    sessionId: "session-1",
    timestamp: Date.now(),
    payload: { ...defaultPayload, ...overridePayload },
    ...restOverrides,
  } as SessionEvent;
}

describe("reduceEvents", () => {
  it("creates a card from a hook event", () => {
    const events = [makeEvent({ payload: { title: "My Project" } })];
    const cards = reduceEvents(events);

    expect(cards.size).toBe(1);
    const card = cards.get("session-1");
    expect(card).toBeDefined();
    expect(card!.status).toBe("active");
    expect(card!.title).toBe("My Project");
    expect(card!.hostName).toBe("my-mac");
    expect(card!.latestImportantMessage).toBe("test message");
  });

  it("transitions active -> turn_complete on final event", () => {
    const events: SessionEvent[] = [
      makeEvent({ payload: { message: "working on it" } }),
      makeEvent({
        type: "turn_complete",
        payload: { final: true, message: "done with this phase" },
      }),
    ];
    const cards = reduceEvents(events);
    const card = cards.get("session-1");
    expect(card!.status).toBe("turn_complete");
    expect(card!.latestImportantMessage).toBe("done with this phase");
  });

  it("transitions active -> error on error event", () => {
    const events: SessionEvent[] = [
      makeEvent({ payload: { message: "starting" } }),
      makeEvent({
        type: "error",
        payload: { message: "something went wrong" },
      }),
    ];
    const cards = reduceEvents(events);
    const card = cards.get("session-1");
    expect(card!.status).toBe("error");
  });

  it("sets waiting status from hook payload", () => {
    const events = [
      makeEvent({ payload: { waiting: true, message: "thinking..." } }),
    ];
    const cards = reduceEvents(events);
    const card = cards.get("session-1");
    expect(card!.status).toBe("waiting");
  });

  it("marks session stale after heartbeat timeout", () => {
    const oldTime = Date.now() - 60000;
    const events: SessionEvent[] = [
      makeEvent({
        timestamp: oldTime,
        payload: { message: "old event" },
      }),
      {
        ...makeEvent({
          type: "stale_check",
          timestamp: Date.now(),
        }),
      },
    ];
    const cards = reduceEvents(events);
    const card = cards.get("session-1");
    expect(card!.status).toBe("stale");
  });

  it("preserves latest important message", () => {
    const events: SessionEvent[] = [
      makeEvent({
        payload: { message: "first message" },
      }),
      makeEvent({
        payload: { message: "second message" },
      }),
    ];
    const cards = reduceEvents(events);
    const card = cards.get("session-1");
    expect(card!.latestImportantMessage).toBe("second message");
  });

  it("tracks event count", () => {
    const events: SessionEvent[] = [
      makeEvent({}),
      makeEvent({}),
      makeEvent({}),
    ];
    const cards = reduceEvents(events);
    const card = cards.get("session-1");
    expect(card!.eventCount).toBe(3);
  });

  it("handles multiple hosts and sessions", () => {
    const events: SessionEvent[] = [
      makeEvent({ sessionId: "s1", hostId: "h1" }),
      makeEvent({ sessionId: "s2", hostId: "h2", payload: { hostName: "linux-box" } }),
    ];
    const cards = reduceEvents(events);
    expect(cards.size).toBe(2);
    expect(cards.get("s1")!.hostId).toBe("h1");
    expect(cards.get("s2")!.hostId).toBe("h2");
    expect(cards.get("s2")!.hostName).toBe("linux-box");
  });
});

describe("computeCardStatus", () => {
  it("returns stale when lastUpdate is old", () => {
    const oldTime = Date.now() - 60000;
    expect(computeCardStatus(oldTime, "active")).toBe("stale");
  });

  it("returns current status when recent", () => {
    expect(computeCardStatus(Date.now(), "active")).toBe("active");
  });

  it("keeps stale status even if recent", () => {
    expect(computeCardStatus(Date.now(), "stale")).toBe("stale");
  });
});

describe("getAttendedSessions", () => {
  it("returns one card per host (most recent)", () => {
    const cards = reduceEvents([
      makeEvent({ sessionId: "s1", timestamp: 100 }),
      makeEvent({ sessionId: "s2", timestamp: 200 }),
      makeEvent({ sessionId: "s3", hostId: "h1", timestamp: 300 }),
    ]);

    const attended = getAttendedSessions(cards);
    expect(attended.length).toBe(2);
    expect(attended[0].sessionId).toBe("s3");
  });

 it("sorts attention-needed sessions first", () => {
    const cards = reduceEvents([
      makeEvent({
        sessionId: "active-1",
        hostId: "host-active",
        payload: { message: "a", hostName: "host-a" },
      }),
      makeEvent({
        sessionId: "error-1",
        hostId: "host-error",
        type: "error",
        payload: { message: "oops", hostName: "host-e" },
      }),
      makeEvent({
        sessionId: "waiting-1",
        hostId: "host-waiting",
        payload: { waiting: true, message: "thinking", hostName: "host-w" },
      }),
    ]);

    const attended = getAttendedSessions(cards);
    expect(attended[0].status).toBe("error");
    expect(attended[1].status).toBe("waiting");
  });
});

describe("filterByStatus", () => {
  it("filters cards by status array", () => {
    const cards = reduceEvents([
      makeEvent({
        sessionId: "active-1",
        payload: { message: "active" },
      }),
      makeEvent({
        sessionId: "error-1",
        type: "error",
        payload: { message: "error" },
      }),
      makeEvent({
        sessionId: "waiting-1",
        payload: { waiting: true },
      }),
    ]);
    const all = Array.from(cards.values());

    const errors = filterByStatus(all, ["error"]);
    expect(errors.length).toBe(1);
    expect(errors[0].status).toBe("error");

    const nonStale = filterByStatus(all, ["active", "waiting"]);
    expect(nonStale.length).toBe(2);
  });

  it("returns all cards when statuses is empty", () => {
    const cards = reduceEvents([makeEvent({})]);
    const all = Array.from(cards.values());
    expect(filterByStatus(all, [])).toEqual(all);
  });
});

describe("getHistoryForSession", () => {
  it("returns events for a specific session", () => {
    const events: SessionEvent[] = [
      makeEvent({ sessionId: "s1" }),
      makeEvent({ sessionId: "s2" }),
      makeEvent({ sessionId: "s1" }),
    ];

    const history = getHistoryForSession(events, "s1");
    expect(history.length).toBe(2);
  });

  it("returns empty for unknown session", () => {
    const events = [makeEvent({ sessionId: "s1" })];
    const history = getHistoryForSession(events, "unknown");
    expect(history.length).toBe(0);
  });

  it("limits to 50 events", () => {
    const events: SessionEvent[] = [];
    for (let i = 0; i < 70; i++) {
      events.push(makeEvent({ sessionId: "s1" }));
    }
    const history = getHistoryForSession(events, "s1");
    expect(history.length).toBe(50);
  });
});
