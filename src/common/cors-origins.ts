/**
 * CORS allowlist for HTTP (main.ts) and WebSocket (chat.gateway).
 * When CORS_ORIGINS is a comma-separated list, these origins are always merged in
 * so the production web app stays authorized without duplicating env in every deploy.
 */
const DEFAULT_WEB_APP_ORIGINS = ['https://www.zenno.dev'];

export function parseCorsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw === '*') return true;
  const fromEnv = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return [...new Set([...DEFAULT_WEB_APP_ORIGINS, ...fromEnv])];
}
