import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createRouter } from "../server/routes.js";
import { EventStore } from "../server/store.js";
import { SessionEvent } from "../shared/types.js";
import { v4 as uuidv4 } from "uuid";

function makeTestEvent(overrides: Partial<SessionEvent>): SessionEvent {
  return {
    id: uuidv4(),
    type: "hook",
    hostId: "test-host",
    sessionId: "test-session",
    timestamp: Date.now(),
    payload: {
      hostName: "test-host-name",
      os: "darwin",
      projectPath: "/tmp/test",
      message: "test event",
      ...overrides.payload,
    },
    ...overrides,
  } as SessionEvent;
}

describe("Server Routes", () => {
  let app: express.Express;
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore("/tmp/claude-status-test-events.jsonl");
    app = express();
    app.use(express.json());
    app.use("/api", createRouter(store));
  });

  afterEach(async () => {
    store.clear();
  });

  it("returns health check", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects ingest without required fields", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({ sessionId: "s1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("accepts an ingest event", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: Date.now(),
        payload: { hostName: "my-mac", message: "hello" },
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.sessionId).toBe("session-1");
    expect(res.body.eventCount).toBe(1);
  });

  it("returns sessions via GET /api/sessions", async () => {
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: Date.now(),
        payload: { hostName: "my-mac", message: "hello" },
      });

    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].sessionId).toBe("session-1");
    expect(res.body.sessions[0].hostName).toBe("my-mac");
  });

  it("returns multiple sessions from different hosts", async () => {
    const now = Date.now();
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: now,
        payload: { hostName: "mac-1", message: "from mac" },
      });

    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-2",
        sessionId: "session-2",
        type: "hook",
        timestamp: now + 1,
        payload: { hostName: "linux-1", message: "from linux" },
      });

    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(2);
  });

  it("filters sessions by status", async () => {
    const now = Date.now();
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "active-1",
        type: "hook",
        timestamp: now,
        payload: { hostName: "mac", message: "active" },
      });

    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-2",
        sessionId: "error-1",
        type: "error",
        timestamp: now + 1,
        payload: { hostName: "linux", message: "error" },
      });

    let res = await request(app).get("/api/sessions");
    expect(res.body.sessions.length).toBe(2);

    res = await request(app).get("/api/sessions?status=error");
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].status).toBe("error");
  });

  it("returns history for a session", async () => {
    const now = Date.now();
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: now,
        payload: { hostName: "mac", message: "first" },
      });

    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: now + 1,
        payload: { hostName: "mac", message: "second" },
      });

    const res = await request(app).get("/api/history/session-1");
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe("session-1");
    expect(res.body.events.length).toBe(2);
    expect(res.body.events[0].payload.message).toBe("first");
    expect(res.body.events[1].payload.message).toBe("second");
  });

  it("returns empty history for unknown session", async () => {
    const res = await request(app).get("/api/history/unknown-session");
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBe(0);
  });

  it("persists events to disk and reloads", async () => {
    const storePath = "/tmp/claude-status-persist-test.jsonl";

    const persistentStore = new EventStore(storePath);
    persistentStore.ingest({
      id: "test-persist",
      type: "hook",
      hostId: "host-1",
      sessionId: "session-1",
      timestamp: Date.now(),
      payload: { hostName: "mac", message: "persisted" },
    });

    const freshStore = new EventStore(storePath);
    const cards = freshStore.getCards();
    expect(cards.size).toBeGreaterThan(0);
  });
});
