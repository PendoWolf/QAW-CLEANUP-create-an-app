import type { Request } from "express";

// Server-side Pendo Track Events, sent to the Pendo Track API over HTTP.
// The integration key is a secret, so it is read from the environment and
// never committed. When it isn't set, tracking is skipped.
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST || "data.pendo-dev.pendo-dev.com";
const PENDO_TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;

// The web client forwards the Pendo visitor and account IDs it initialized the
// agent with, so server events are attributed to the same visitor and account.
export const VISITOR_ID_HEADER = "x-pendo-visitor-id";
export const ACCOUNT_ID_HEADER = "x-pendo-account-id";

type TrackProperties = Record<string, string | number | boolean>;

export function trackEvent(req: Request, event: string, properties: TrackProperties = {}): void {
  if (!PENDO_TRACK_EVENT_SECRET) return;

  const body = {
    type: "track",
    event,
    visitorId: req.get(VISITOR_ID_HEADER) || "system",
    accountId: req.get(ACCOUNT_ID_HEADER) || "system",
    timestamp: Date.now(),
    properties,
    context: {
      ip: req.ip,
      userAgent: req.get("user-agent"),
      url: req.originalUrl,
    },
  };

  // Fire-and-forget: a tracking failure must never break the API response.
  fetch(`https://${PENDO_DATA_HOST}/data/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pendo-integration-key": PENDO_TRACK_EVENT_SECRET,
    },
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (!res.ok) console.error(`Pendo track "${event}" failed: ${res.status}`);
    })
    .catch((err: unknown) => {
      console.error(`Pendo track "${event}" failed:`, err);
    });
}
