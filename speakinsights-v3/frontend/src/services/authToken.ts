/**
 * SpeakInsights v3 — Auth wiring for the shared axios client
 *
 * Non-React module so the axios singleton stays import-agnostic.
 * ClerkProvider lives in React-land and pushes the session token in here
 * on change via setApiAuthToken.
 */

let _token: string | null = null;

const listeners = new Set<(token: string | null) => void>();

export function setApiAuthToken(token: string | null) {
  _token = token;
  listeners.forEach((fn) => fn(token));
}

export function getApiAuthToken(): string | null {
  return _token;
}

export function onApiAuthTokenChange(fn: (token: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
