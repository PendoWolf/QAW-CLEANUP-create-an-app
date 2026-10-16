import { useEffect, useState } from "react";
import { api, ApiError, type AppState } from "./api";

type Action = "load" | "increment" | "decrement" | "reset" | "refresh";
type TrackProps = Record<string, string | number | boolean>;

// Seam for Pendo. Novus installs the Pendo agent, which provides window.pendo
// at runtime; this fires a Track Event for each action. No-op when the agent
// isn't present (local dev), so the app and Playwright mocks both stay simple.
// Event names must match the track types registered in Pendo exactly.
function trackEvent(name: string, props: TrackProps) {
  if (typeof window !== "undefined") {
    try {
      window.pendo?.track?.(name, props);
    } catch {
      // Analytics must never break the counter.
    }
  }
}

// Success event for each action. `previous` is the state on screen when the
// action started; `next` is the state the API returned.
function trackSuccess(action: Action, previous: AppState, next: AppState) {
  const { counter, lastAction } = next;
  const { counter: previousCounter, lastAction: previousLastAction } = previous;
  switch (action) {
    case "load":
      trackEvent("demo-load", { counter, lastAction });
      break;
    case "increment":
      trackEvent("demo-increment", { counter, previousCounter, lastAction });
      break;
    case "decrement":
      trackEvent("demo-decrement", { counter, previousCounter, lastAction });
      break;
    case "reset":
      trackEvent("demo-reset", { counter, previousCounter, previousLastAction });
      break;
    case "refresh":
      trackEvent("demo-refresh", {
        counter,
        lastAction,
        previousCounter,
        valueChanged: counter !== previousCounter,
      });
      break;
  }
}

// Failure event shared by every action, so each action gets a success rate.
function trackFailure(action: Action, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  // Truncated to stay well inside Pendo's 512-byte limit for track properties.
  const props: TrackProps = { action, errorMessage: message.slice(0, 200) };
  // Only non-2xx responses have a status; network/CORS failures have none.
  if (e instanceof ApiError) props.httpStatus = e.status;
  trackEvent("demo-action-failed", props);
}

// React StrictMode runs the mount effect twice in development. Module-level
// (a ref would reset on remount) so the initial load's outcome is tracked once
// per page load.
let initialLoadTracked = false;

export default function App() {
  const [state, setState] = useState<AppState>({ counter: 0, lastAction: "none" });
  const [error, setError] = useState<string | null>(null);

  const run = async (action: Action, fn: () => Promise<AppState>) => {
    const previous = state;
    const shouldTrack = action !== "load" || !initialLoadTracked;
    if (action === "load") initialLoadTracked = true;
    try {
      setError(null);
      const next = await fn();
      setState(next);
      if (shouldTrack) trackSuccess(action, previous, next);
    } catch (e) {
      setError((e as Error).message);
      if (shouldTrack) trackFailure(action, e);
    }
  };

  useEffect(() => {
    run("load", api.getState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
      <h1>QAWolf Demo</h1>

      <p data-testid="counter-value" style={{ fontSize: "3rem", margin: "1rem 0" }}>
        {state.counter}
      </p>
      <p data-testid="last-action" style={{ color: "#666" }}>
        Last action: {state.lastAction}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button data-testid="btn-increment" onClick={() => run("increment", api.increment)}>
          Increment
        </button>
        <button data-testid="btn-decrement" onClick={() => run("decrement", api.decrement)}>
          Decrement
        </button>
        <button data-testid="btn-reset" onClick={() => run("reset", api.reset)}>
          Reset
        </button>
        <button data-testid="btn-refresh" onClick={() => run("refresh", api.getState)}>
          Refresh
        </button>
      </div>

      {error && (
        <p data-testid="error" style={{ color: "crimson", marginTop: 16 }}>
          {error}
        </p>
      )}
    </main>
  );
}
