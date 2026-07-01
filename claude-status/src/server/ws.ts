// @ts-nocheck
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import { createServer, Server } from "http";
import { readFileSync } from "fs";
import { EventStore } from "./store.js";
import { getAttendedSessions } from "../shared/reducer.js";
import { ServerConfig } from "../shared/types.js";

export class WebSocketBroadcaster {
  wss;
  store;
  server;

  constructor(server, store, config) {
    this.server = server;
    this.store = store;
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      this.broadcastSnapshot(ws);

      ws.on("close", () => {});

      ws.on("error", (err) => {
        console.error("WebSocket error:", err.message);
      });
    });

    store.onEvent(() => {
      this.broadcast("");
    });
  }

  broadcastSnapshot(target) {
    const cards = this.store.getCards();
    const attended = getAttendedSessions(cards);
    const data = JSON.stringify({ type: "snapshot", sessions: attended });

    if (target) {
      if (target.readyState === WebSocket.OPEN) {
        target.send(data);
      }
    } else {
      this.broadcast(data);
    }
  }

  broadcast(message) {
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  getServer() {
    return this.server;
  }

  close() {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
