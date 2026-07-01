import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createRouter } from "../../src/server/routes.js";
import { EventStore } from "../../src/server/store.js";
import { getAttendedSessions, SessionCardState } from "../../src/shared/reducer.js";
import { v4 as uuidv4 } from "uuid";

describe("E2E: Session Monitoring Flow", () => {
  let app: express.Express;
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore("/tmp/claude-status-e2e-test.jsonl");
    app = express();
    app.use(express.json());
    app.use("/api", createRouter(store));
  });

  afterEach(async () => {
    store.clear();
  });

  it("completes the full flow: ingest -> sessions list -> history", async () => {
    const now = Date.now();

    // Step 1: Post events for two hosts
    await request(app)
      .post("/api/events")
      .send({
        hostId: "mac-1",
        sessionId: "session-mac-1",
        type: "hook",
        timestamp: now,
        payload: {
          hostName: "macbook-pro",
          os: "darwin",
          projectPath: "/Users/john/project",
          title: "Build API",
          message: "Starting the API server",
        },
      });

    await request(app)
      .post("/api/events")
      .send({
        hostId: "linux-1",
        sessionId: "session-linux-1",
        type: "hook",
        timestamp: now + 1,
        payload: {
          hostName: "server",
          os: "linux",
          projectPath: "/home/user/app",
          title: "Deploy",
          message: "Deploying to production",
        },
      });

    // Step 2: Verify sessions list
    const sessionsRes = await request(app).get("/api/sessions");
    expect(sessionsRes.status).toBe(200);
    expect(sessionsRes.body.sessions.length).toBe(2);

    // Step 3: Post more events
    await request(app)
      .post("/api/events")
      .send({
        hostId: "mac-1",
        sessionId: "session-mac-1",
        type: "hook",
        timestamp: now + 100,
        payload: {
          hostName: "macbook-pro",
          message: "API server started on port 3000",
        },
      });

    await request(app)
      .post("/api/events")
      .send({
        hostId: "linux-1",
        sessionId: "session-linux-1",
        type: "error",
        timestamp: now + 200,
        payload: {
          hostName: "server",
          message: "Deployment failed: insufficient memory",
        },
      });

    // Step 4: Verify error session is prioritized
    const sessionsRes2 = await request(app).get("/api/sessions");
    expect(sessionsRes2.body.sessions.length).toBe(2);
    expect(sessionsRes2.body.sessions[0].status).toBe("error");
    expect(sessionsRes2.body.sessions[0].sessionId).toBe("session-linux-1");

    // Step 5: Check history for mac session
    const historyRes = await request(app).get("/api/history/session-mac-1");
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.events.length).toBe(2);
    expect(historyRes.body.events[0].payload.message).toBe("Starting the API server");
    expect(historyRes.body.events[1].payload.message).toBe("API server started on port 3000");

    // Step 6: Check history for linux session
    const historyRes2 = await request(app).get("/api/history/session-linux-1");
    expect(historyRes2.body.events.length).toBe(2);
    expect(historyRes2.body.events[1].type).toBe("error");
  });

  it("handles turn_complete and stale transitions", async () => {
    const now = Date.now();

    // Active session
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: now,
        payload: { hostName: "mac", message: "working" },
      });

    // Turn complete
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "turn_complete",
        timestamp: now + 100,
        payload: { hostName: "mac", final: true, message: "Done with this phase" },
      });

    const cards = store.getCards();
    const session = cards.get("session-1");
    expect(session!.status).toBe("turn_complete");
    expect(session!.latestImportantMessage).toBe("Done with this phase");

    // Simulate stale - use Date.now() minus STALE_AFTER_MS+
    const { STALE_AFTER_MS } = await import("../../src/shared/types.js");
    const oldTime = Date.now() - (STALE_AFTER_MS + 10000);
    // Replace the session's lastUpdate with oldTime by re-ingesting with old timestamp
    store.ingest({
      id: "stale-trigger",
      type: "hook",
      hostId: "host-1",
      sessionId: "session-1",
      timestamp: oldTime,
      payload: { hostName: "mac", message: "old" },
    });

    // Now add a stale_check with current time
    store.ingest({
      id: "stale-check",
      type: "stale_check",
      hostId: "system",
      sessionId: "session-1",
      timestamp: Date.now(),
      payload: {},
    });

    const cards2 = store.getCards();
    const session2 = cards2.get("session-1");
    expect(session2!.status).toBe("stale");
  });

  it("filters sessions by status correctly", async () => {
    const now = Date.now();

    // Host 1: active
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "active-1",
        type: "hook",
        timestamp: now,
        payload: { hostName: "mac1", message: "active" },
      });

    // Host 2: waiting
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-2",
        sessionId: "waiting-1",
        type: "hook",
        timestamp: now + 1,
        payload: { hostName: "mac2", waiting: true, message: "thinking" },
      });

    // Host 3: error
    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-3",
        sessionId: "error-1",
        type: "error",
        timestamp: now + 2,
        payload: { hostName: "linux", message: "crashed" },
      });

    // All sessions
    let res = await request(app).get("/api/sessions");
    expect(res.body.sessions.length).toBe(3);

    // Error only
    res = await request(app).get("/api/sessions?status=error");
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].sessionId).toBe("error-1");

    // Waiting and active
    res = await request(app).get("/api/sessions?status=waiting,active");
    expect(res.body.sessions.length).toBe(2);
  });

  it("maintains message persistence across events", async () => {
    const now = Date.now();

    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: now,
        payload: { hostName: "mac", message: "first message" },
      });

    await request(app)
      .post("/api/events")
      .send({
        hostId: "host-1",
        sessionId: "session-1",
        type: "hook",
        timestamp: now + 1,
        payload: { hostName: "mac", message: "second message" },
      });

    const res = await request(app).get("/api/sessions");
    expect(res.body.sessions[0].latestImportantMessage).toBe("second message");
    expect(res.body.sessions[0].eventCount).toBe(2);
  });
});
