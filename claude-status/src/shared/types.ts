export type HostId = string;
export type SessionId = string;
export type ProjectPath = string;
export type SessionTitle = string;

export type SessionStatus =
  | "active"
  | "waiting"
  | "idle"
  | "error"
  | "stale";

export interface HostInfo {
  id: HostId;
  name: string;
  os: string;
  projectPath: ProjectPath;
}

export interface SessionEvent {
  id: string;
  type:
    | "hook"
    | "discovery"
    | "heartbeat"
    | "test"
    | "stale_check"
    | "turn_complete"
    | "error"
    | "message";
  hostId: HostId;
  sessionId: SessionId;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface SessionCardState {
  hostId: HostId;
  hostName: string;
  os: string;
  sessionId: SessionId;
  projectPath: ProjectPath;
  title: SessionTitle;
  status: SessionStatus;
  lastUpdate: number;
  latestImportantMessage: string;
  eventCount: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  eventsPath: string;
  heartbeatIntervalMs: number;
  staleAfterMs: number;
  tls?: {
    key: string;
    cert: string;
  };
}

export interface AgentConfig {
  serverUrl: string;
  hostName: string;
  os: string;
  projectPath: string;
  heartbeatIntervalMs: number;
  queuePath: string;
}

export interface IngestRequest {
  hostId: HostId;
  sessionId: SessionId;
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

export interface IngestResponse {
  ok: boolean;
  sessionId: SessionId;
  eventCount: number;
}

export interface SessionsResponse {
  sessions: SessionCardState[];
}

export interface HistoryResponse {
  sessionId: SessionId;
  events: SessionEvent[];
}

export const HEARTBEAT_INTERVAL_MS = 15000;
export const STALE_AFTER_MS = 45000;
export const MAX_HISTORY_EVENTS = 50;
export const DEFAULT_PORT = 4000;
export const DEFAULT_HOST = "127.0.0.1";
