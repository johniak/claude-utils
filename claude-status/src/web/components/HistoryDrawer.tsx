import { useState, useEffect } from "react";
import { SessionCardState } from "../../shared/types.js";

const API_BASE = "";

interface Props {
  session: SessionCardState | null;
  onClose: () => void;
}

interface HistoryEvent {
  id: string;
  type: string;
  sessionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export default function HistoryDrawer({ session, onClose }: Props) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;

    setLoading(true);
    fetch(`${API_BASE}/api/history/${session.sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [session]);

  if (!session) return null;

  return (
    <div className="history-drawer-overlay" onClick={onClose}>
      <div className="history-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="history-drawer-header">
          <h2>{session.title || session.projectPath}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="history-drawer-meta">
          <span>Host: {session.hostName}</span>
          <span>Status: {session.status}</span>
          <span>Last update: {formatTime(session.lastUpdate)}</span>
        </div>

        {loading ? (
          <p className="loading">Loading history...</p>
        ) : events.length === 0 ? (
          <p className="empty-history">No events recorded</p>
        ) : (
          <div className="history-list">
            {events.map((event) => (
              <div key={event.id} className="history-event">
                <span className="event-time">{formatTime(event.timestamp)}</span>
                <span className="event-type">{event.type}</span>
                {typeof event.payload.message === "string" && event.payload.message && (
                  <span className="event-message">{event.payload.message as string}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
