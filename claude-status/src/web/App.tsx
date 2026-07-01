import { useState, useEffect, useCallback } from "react";
import SessionCard from "./components/SessionCard";
import StatusFilter from "./components/StatusFilter";
import HistoryDrawer from "./components/HistoryDrawer";
import { SessionCardState, SessionStatus } from "../shared/types.js";

const API_BASE = import.meta.env.DEV ? "" : "";

interface WSMessage {
  type: "snapshot";
  sessions: SessionCardState[];
}

export default function App() {
  const [sessions, setSessions] = useState<SessionCardState[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionCardState | null>(null);
  const [filter, setFilter] = useState<SessionStatus[]>([]);
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSessions();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => setConnected(true);
    websocket.onclose = () => setConnected(false);
    websocket.onerror = () => setConnected(false);

    websocket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        if (message.type === "snapshot") {
          setSessions(message.sessions || []);
        }
      } catch {
        // ignore
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [fetchSessions]);

  const filteredSessions =
    filter.length === 0
      ? sessions
      : sessions.filter((s) => filter.includes(s.status));

  return (
    <div className="app">
      <header className="app-header">
        <h1>Claude Status</h1>
        <span className={`connection-status ${connected ? "connected" : "disconnected"}`}>
          {connected ? "● Connected" : "● Disconnected"}
        </span>
      </header>

      <StatusFilter
        filter={filter}
        onFilterChange={setFilter}
        counts={{
          all: sessions.length,
          active: sessions.filter((s) => s.status === "active").length,
          waiting: sessions.filter((s) => s.status === "waiting").length,
          error: sessions.filter((s) => s.status === "error").length,
          stale: sessions.filter((s) => s.status === "stale").length,
          turn_complete: sessions.filter((s) => s.status === "turn_complete").length,
        }}
      />

      <main className="sessions-list">
        {filteredSessions.length === 0 ? (
          <div className="empty-state">
            <p>No sessions found</p>
            <p className="empty-hint">
              Start a Claude Code session to see it here
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              onClick={() => setSelectedSession(session)}
            />
          ))
        )}
      </main>

      <HistoryDrawer
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}
