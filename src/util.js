// Small helpers shared by the API.

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code || 'error'; }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export async function body(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Expected JSON');
  try { return await request.json(); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I to avoid misreading
export function randomCode(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}
export function uid(prefix = '') { return prefix + crypto.randomUUID(); }
export function personId() { return 'VS-' + randomCode(6); }
export function caseId(now = new Date()) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, '');
  return `C-${d}-${randomCode(4)}`;
}

export function b64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256(text) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string compare
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function nowIso() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
export function addMinutes(min) { return new Date(Date.now() + min * 60000).toISOString().replace('T', ' ').slice(0, 19); }
export function addMonths(months, from = new Date()) {
  const d = new Date(from); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10);
}

export function parseJSON(s, fallback) { try { return s == null ? fallback : JSON.parse(s); } catch { return fallback; } }

export function str(v, max = 2000) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}
export function int(v, min, max) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}
export function oneOf(v, list, fallback = null) { return list.includes(v) ? v : fallback; }

export async function getSettings(env) {
  const { results } = await env.CLINICAL.prepare('SELECT key, value FROM settings').all();
  const s = {};
  for (const r of results) s[r.key] = r.value;
  return s;
}

export async function audit(env, user, action, objectType, objectId, detail) {
  try {
    await env.CLINICAL.prepare('INSERT INTO audit_log (user_id, role, action, object_type, object_id, detail) VALUES (?,?,?,?,?,?)')
      .bind(user?.id || null, user?.role || null, action, objectType || null, objectId || null, detail ? JSON.stringify(detail).slice(0, 2000) : null).run();
  } catch (e) { console.error('audit failed', e); }
}

// SELECT ... WHERE col IN (…) for any number of ids. D1 allows at most 100 bound values per query, so look up in chunks.
// sql must contain "IN (?)" once, e.g. selectIn(db, 'SELECT id, name FROM persons WHERE id IN (?)', ids).
export async function selectIn(db, sql, ids, size = 90) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    const part = ids.slice(i, i + size);
    const { results } = await db.prepare(sql.replace('IN (?)', `IN (${part.map(() => '?').join(',')})`)).bind(...part).all();
    out.push(...results);
  }
  return out;
}
