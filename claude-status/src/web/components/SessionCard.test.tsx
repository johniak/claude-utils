import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionCard from "./SessionCard.js";
import { SessionCardState } from "../../shared/types.js";

function makeCard(overrides: Partial<SessionCardState>): SessionCardState {
  return {
    hostId: "host-1",
    hostName: "my-mac",
    os: "darwin",
    sessionId: "session-1",
    projectPath: "/Users/test/project",
    title: "Test Project",
    status: "active",
    lastUpdate: Date.now(),
    latestImportantMessage: "Test message",
    eventCount: 1,
    ...overrides,
  };
}

describe("SessionCard", () => {
  it("renders session title", () => {
    render(
      <SessionCard
        session={makeCard({})}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Test Project")).toBeInTheDocument();
  });

  it("renders session host and time", () => {
    render(
      <SessionCard
        session={makeCard({})}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("my-mac")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(
      <SessionCard
        session={makeCard({ status: "error" })}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders message when present", () => {
    render(
      <SessionCard
        session={makeCard({ latestImportantMessage: "Hello world" })}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("uses project path fallback for title", () => {
    render(
      <SessionCard
        session={makeCard({ title: "", projectPath: "/Users/test/my-app" })}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("my-app")).toBeInTheDocument();
  });

  it("truncates long messages", () => {
    const longMsg = "a".repeat(200);
    render(
      <SessionCard
        session={makeCard({ latestImportantMessage: longMsg })}
        onClick={() => {}}
      />
    );
    expect(screen.getByText(longMsg.slice(0, 120) + "...")).toBeInTheDocument();
  });
});
