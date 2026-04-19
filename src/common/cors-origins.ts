/**
 * CORS allowlist for HTTP (main.ts) and WebSocket (chat.gateway).
 * All origins are configured via the CORS_ORIGINS environment variable.
 *
 * Rules applied automatically so the env var stays concise:
 *  - Trailing slashes are stripped (browsers never send them in Origin headers).
 *  - For every `https://example.com` entry, `https://www.example.com` is also
 *    added automatically (and vice-versa), so you only need to list one form.
 *  - `*` or an empty/missing variable means "allow all" (open — fine for dev).
 */
export function parseCorsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw.trim() === '*') return true;

  const explicit = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))   // strip trailing slashes
    .filter(Boolean);

  if (explicit.length === 0) return true;

  // Auto-expand: add www <-> non-www counterparts so listing one is enough.
  const expanded = new Set(explicit);
  for (const origin of explicit) {
    try {
      const u = new URL(origin);
      if (u.hostname.startsWith('www.')) {
        // www.example.com → example.com
        u.hostname = u.hostname.slice(4);
      } else {
        // example.com → www.example.com
        u.hostname = `www.${u.hostname}`;
      }
      expanded.add(u.origin); // u.origin strips path/query automatically
    } catch {
      // Not a valid URL — keep the original entry as-is.
    }
  }

  return Array.from(expanded);
}
