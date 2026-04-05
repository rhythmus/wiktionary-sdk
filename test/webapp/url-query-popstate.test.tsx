/** @vitest-environment jsdom */
/** URL `q` param + `usePopstateQuerySync` updates React state on popstate (refetch is App-specific). */
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React, { useState as useReactState } from "react";
import { readQueryParamQ, usePopstateQuerySync } from "../../webapp/src/url-query-popstate";

describe("readQueryParamQ / readInitialQueryFromWindow", () => {
  it("reads trimmed q", () => {
    expect(readQueryParamQ("?q=hello%20")).toBe("hello");
    expect(readQueryParamQ("")).toBe("");
  });
});

describe("usePopstateQuerySync (popstate)", () => {
  /** Minimal harness: popstate updates `q` only (full App refetches separately). */
  function Harness() {
    const [q, setQ] = useReactState(() => readQueryParamQ(window.location.search) || "FALLBACK");
    usePopstateQuerySync(setQ, "FALLBACK");
    return <span data-testid="synced-q">{q}</span>;
  }

  it("updates displayed query when popstate fires and location.search has q", () => {
    window.history.replaceState({}, "", "/?q=alpha");
    render(<Harness />);
    expect(screen.getByTestId("synced-q")).toHaveTextContent("alpha");

    act(() => {
      window.history.pushState({}, "", "/?q=beta");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByTestId("synced-q")).toHaveTextContent("beta");
  });

  it("uses empty fallback when q is absent after popstate", () => {
    window.history.replaceState({}, "", "/?q=start");
    render(<Harness />);
    expect(screen.getByTestId("synced-q")).toHaveTextContent("start");
    act(() => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByTestId("synced-q")).toHaveTextContent("FALLBACK");
  });
});
