import fs from "fs";
import path from "path";
import { SessionEvent, SessionCardState } from "../shared/types.js";
import { reduceEvents } from "../shared/reducer.js";

export class EventStore {
  private events: SessionEvent[] = [];
  private eventsPath: string;
  private listeners: Set<() => void> = new Set();

  constructor(eventsPath: string) {
    this.eventsPath = eventsPath;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!fs.existsSync(this.eventsPath)) {
      return;
    }
    try {
      const data = fs.readFileSync(this.eventsPath, "utf-8");
      const lines = data
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l));
      this.events = lines as SessionEvent[];
    } catch {
      this.events = [];
    }
  }

  private saveToDisk(): void {
    const dir = path.dirname(this.eventsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = this.events.map((e) => JSON.stringify(e)).join("\n");
    fs.writeFileSync(this.eventsPath, content);
  }

  onEvent(listener: () => void): void {
    this.listeners.add(listener);
  }

  offEvent(listener: () => void): void {
    this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  ingest(event: SessionEvent): void {
    this.events.push(event);
    this.saveToDisk();
    this.notify();
  }

  getAll(): SessionEvent[] {
    return [...this.events];
  }

  getCards(): Map<string, SessionCardState> {
    return reduceEvents(this.events);
  }

  getBySessionId(sessionId: string): SessionEvent[] {
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  clear(): void {
    this.events = [];
    this.saveToDisk();
    this.notify();
  }
}
