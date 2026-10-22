// Prints an INSERT statement for a user with a hashed PIN (same PBKDF2 settings as src/auth.js).
// Usage: node scripts/user-sql.mjs '{"role":"admin","name":"...","phone":"9xxxxxxxxx","pin":"482913", ...}'
import { webcrypto as crypto } from 'node:crypto';
const u = JSON.parse(process.argv[2]);
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(u.pin), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 20000 }, key, 256);
const b64 = b => Buffer.from(b).toString('base64');
const q = v => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const id = u.id || 'U-' + crypto.randomUUID();
const cols = { id, role: u.role, name: u.name, phone: u.phone, pin_hash: b64(bits), pin_salt: b64(salt), must_change: u.must_change ?? 1,
  organisation: u.organisation, state: u.state, district: u.district, lsgd_type: u.lsgd_type, lsgd_name: u.lsgd_name, ward: u.ward,
  reg_council: u.reg_council, reg_number: u.reg_number, reg_verified_at: u.reg_number ? new Date().toISOString().slice(0, 10) : null,
  ui_lang: u.ui_lang || 'en', content_lang: u.content_lang || 'ml' };
console.log(`INSERT INTO users (${Object.keys(cols).join(', ')}) VALUES (${Object.values(cols).map(q).join(', ')});`);
