// Phone + PIN login with server-side sessions.
// PINs are hashed with PBKDF2-SHA256. The iteration count is kept modest because the
// Cloudflare free plan allows 10 ms of CPU per request; raise PBKDF2_ITER on the paid plan.
import { HttpError, b64, fromB64, sha256, safeEqual, nowIso, addMinutes } from './util.js';

const PBKDF2_ITER = 20000;
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export async function hashPin(pin, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}

export function validPin(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) return false;
  const p = String(pin);
  if (/^(\d)\1{5}$/.test(p)) return false;
  if ('0123456789'.includes(p) || '9876543210'.includes(p)) return false;
  return true;
}

export function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  return d;
}

function cookie(token, maxAge) {
  return `vs_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function login(env, phone, pin) {
  const u = await env.IDENTITY.prepare('SELECT * FROM users WHERE phone = ?').bind(normPhone(phone)).first();
  if (!u || !u.active) {
    await hashPin(String(pin || '000000'));  // equalise timing
    throw new HttpError(401, 'Phone number or PIN is not correct');
  }
  if (u.locked_until && u.locked_until > nowIso()) throw new HttpError(423, 'Too many attempts. Try again after 15 minutes.');
  const { hash } = await hashPin(String(pin || ''), u.pin_salt);
  if (!safeEqual(hash, u.pin_hash)) {
    const fails = u.failed_attempts + 1;
    await env.IDENTITY.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
      .bind(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? addMinutes(LOCK_MINUTES) : null, u.id).run();
    throw new HttpError(401, 'Phone number or PIN is not correct');
  }
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = b64(tokenBytes).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
  const th = await sha256(token);
  await env.IDENTITY.batch([
    env.IDENTITY.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').bind(u.id),
    env.IDENTITY.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').bind(th, u.id, addMinutes(SESSION_HOURS * 60)),
    env.IDENTITY.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
  ]);
  return { user: publicUser(u), setCookie: cookie(token, SESSION_HOURS * 3600) };
}

export async function logout(env, request) {
  const token = readToken(request);
  if (token) await env.IDENTITY.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return cookie('', 0);
}

function readToken(request) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(/(?:^|;\s*)vs_session=([^;]+)/);
  return m ? m[1] : null;
}

export async function currentUser(env, request) {
  const token = readToken(request);
  if (!token) return null;
  const th = await sha256(token);
  const row = await env.IDENTITY.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`).bind(th).first();
  return row || null;
}

export function publicUser(u) {
  return {
    id: u.id, role: u.role, name: u.name, phone: u.phone, email: u.email, must_change: !!u.must_change,
    organisation: u.organisation, state: u.state, district: u.district, lsgd_type: u.lsgd_type, lsgd_name: u.lsgd_name, ward: u.ward,
    reg_council: u.reg_council, reg_number: u.reg_number,
    ui_lang: u.ui_lang, content_lang: u.content_lang, translate_on: !!u.translate_on, trained_at: u.trained_at,
  };
}

export function requireRole(user, ...roles) {
  if (!user) throw new HttpError(401, 'Please sign in');
  if (user.must_change) throw new HttpError(403, 'Please set a new PIN first', 'must_change');
  if (!roles.includes(user.role)) throw new HttpError(403, 'Not allowed for your role');
}
