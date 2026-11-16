import { SessionCardState } from "../../shared/types.js";

const statusColors: Record<SessionCardState["status"], string> = {
  active: "#22c55e",
  waiting: "#f59e0b",
  idle: "#60a5fa",
  error: "#ef4444",
  stale: "#6b7280",
};

const statusLabels: Record<SessionCardState["status"], string> = {
  active: "Running",
  waiting: "Needs Input",
  idle: "Idle",
  error: "Error",
  stale: "Stale",
};

const statusIcons: Record<SessionCardState["status"], string> = {
  active: "▶",
  waiting: "⏳",
  idle: "✓",
  error: "✗",
  stale: "⏸",
};

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface Props {
  session: SessionCardState;
  onClick: () => void;
}

export default function SessionCard({ session, onClick }: Props) {
  const color = statusColors[session.status];
  const icon = statusIcons[session.status];
  const label = statusLabels[session.status];

  return (
    <div className="session-card" onClick={onClick} style={{ borderLeft: `4px solid ${color}` }}>
      <div className="session-card-header">
        <div className="session-title-row">
          <span className="session-icon" style={{ color }}>{icon}</span>
          <span className="session-title">{session.title || session.projectPath.split("/").pop() || "Unknown"}</span>
          <span className={`session-badge ${session.status}`}>{label}</span>
        </div>
        <div className="session-meta">
          <span className="session-host">{session.hostName}</span>
          <span className="session-time">{formatTime(session.lastUpdate)}</span>
        </div>
      </div>
      {session.latestImportantMessage && (
        <p className="session-message">
          {session.latestImportantMessage.length > 120
            ? session.latestImportantMessage.slice(0, 120) + "..."
            : session.latestImportantMessage}
        </p>
      )}
    </div>
  );
}
