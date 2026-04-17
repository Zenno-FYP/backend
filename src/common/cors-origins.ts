/**
 * CORS allowlist for HTTP (main.ts) and WebSocket (chat.gateway).
 * All origins are configured via the CORS_ORIGINS environment variable.
 */

export function parseCorsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw === '*') return true;
  const fromEnv = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : true;
}
