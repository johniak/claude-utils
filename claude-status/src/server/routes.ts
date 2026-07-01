import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { EventStore } from "./store.js";
import {
  IngestRequest,
  IngestResponse,
  SessionsResponse,
  HistoryResponse,
  SessionEvent,
  getAttendedSessions,
  getHistoryForSession,
  filterByStatus,
} from "../shared/index.js";

export function createRouter(store: EventStore): express.Router {
  const router = express.Router();

  router.use(cors());
  router.use(express.json());

  router.get("/healthz", (_req, res) => {
    res.json({ ok: true, eventCount: store.getAll().length });
  });

  router.post("/events", (req, res) => {
    const body: IngestRequest = req.body;
    if (!body.hostId || !body.sessionId || !body.type) {
      res.status(400).json({ error: "hostId, sessionId, and type are required" });
      return;
    }

    const event: SessionEvent = {
      id: uuidv4(),
      type: body.type as SessionEvent["type"],
      hostId: body.hostId,
      sessionId: body.sessionId,
      timestamp: body.timestamp ?? Date.now(),
      payload: body.payload ?? {},
    };

    store.ingest(event);
    const cards = store.getCards();

    res.json({
      ok: true,
      sessionId: body.sessionId,
      eventCount: cards.get(body.sessionId)?.eventCount ?? 1,
    } as IngestResponse);
  });

  router.get("/sessions", (req, res) => {
    const cards = store.getCards();
    let attended = getAttendedSessions(cards);

    const statusFilter = req.query.status as string | undefined;
    if (statusFilter) {
      const statuses = statusFilter.split(",").map((s) => s.trim());
      attended = filterByStatus(attended, statuses as any);
    }

    res.json({ sessions: attended } as SessionsResponse);
  });

  router.get("/history/:sessionId", (req, res) => {
    const sessionId = req.params.sessionId;
    const events = getHistoryForSession(store.getAll(), sessionId);

    res.json({
      sessionId,
      events,
    } as HistoryResponse);
  });

  return router;
}
