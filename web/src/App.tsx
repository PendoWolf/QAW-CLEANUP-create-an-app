import { useEffect, useState } from "react";
import { api, ApiError, type AppState } from "./api";

// Seam for Pendo. Novus installs the Pendo agent, which provides window.pendo
// at runtime; this fires a Track Event for each action. No-op when the agent
// isn't present (local dev), so the app and Playwright mocks both stay simple.
function trackEvent(name: string) {
  if (typeof window !== "undefined") {
    window.pendo?.track?.(`demo-${name}`);
  }
}

// Track Event: an API action (load, increment, decrement, reset, or refresh)
// failed and an error appeared. The demo-* events only fire on success, so this
// is the only signal for failed requests. No-op when the agent isn't present.
function trackActionFailed(action: string, e: unknown) {
  if (typeof window === "undefined") return;
  const errorMessage = e instanceof Error ? e.message : String(e);
  window.pendo?.track?.("state_action_failed", {
    action,
    errorMessage: errorMessage.slice(0, 200),
    // Only HTTP failures have a status code; network errors leave it out.
    ...(e instanceof ApiError ? { statusCode: e.status } : {}),
  });
}

export default function App() {
  const [state, setState] = useState<AppState>({ counter: 0, lastAction: "none" });
  const [error, setError] = useState<string | null>(null);

  const run = async (name: string, fn: () => Promise<AppState>) => {
    try {
      setError(null);
      setState(await fn());
      trackEvent(name);
    } catch (e) {
      setError((e as Error).message);
      trackActionFailed(name, e);
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
