// API client and the encrypted offline outbox.
// Visits recorded without a signal are encrypted with a key derived from the worker's PIN (AES-GCM)
// and kept in IndexedDB until they are uploaded.

export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: raw ? headers : (body !== undefined ? { 'content-type': 'application/json', ...headers } : headers),
      body: raw ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No internet connection', 'offline');
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`, data && data.code);
  return data;
}

// ---------------- IndexedDB ----------------
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vayosmitham', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(store, mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// ---------------- encryption key (from PIN) ----------------
let KEY = null;
const enc = new TextEncoder(), dec = new TextDecoder();

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Called after a successful sign-in or PIN entry. userId scopes the vault to this worker.
export async function unlockVault(userId, pin) {
  let meta = await tx('meta', 'readonly', s => reqP(s.get('vault')));
  if (!meta || meta.userId !== userId) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pin, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const check = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode('vayosmitham'));
    meta = { userId, salt, iv, check };
    // a different worker on this device: their encrypted items cannot be read anyway; keep them until that worker signs in
    await tx('meta', 'readwrite', s => s.put(meta, 'vault'));
    KEY = key;
    return true;
  }
  const key = await deriveKey(pin, meta.salt);
  try {
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: meta.iv }, key, meta.check);
    KEY = key;
    return true;
  } catch {
    return false;
  }
}
export function vaultUnlocked() { return !!KEY; }
export function lockVault() { KEY = null; }
export async function vaultOwner() { return (await tx('meta', 'readonly', s => reqP(s.get('vault'))))?.userId || null; }
// PIN changed: re-key the vault (items are re-encrypted with the new key).
export async function rekeyVault(userId, newPin) {
  const items = await listOutbox(true);
  const decrypted = [];
  for (const it of items) decrypted.push({ it, data: await decryptItem(it) });
  await tx('meta', 'readwrite', s => s.delete('vault'));
  KEY = null;
  await unlockVault(userId, newPin);
  for (const { it, data } of decrypted) await putOutbox(it.id, data, it);
}

async function encrypt(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, KEY, enc.encode(JSON.stringify(obj)));
  return { iv, ct };
}
async function decryptJson(box) {
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, KEY, box.ct)));
}
async function encryptBlob(blob) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, KEY, await blob.arrayBuffer()) };
}
async function decryptBlob(box) {
  return new Blob([await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, KEY, box.ct)], { type: 'image/jpeg' });
}

// ---------------- outbox ----------------
// data = { visit: {...payload}, photos: [{view, blob, w, h, q, client_uuid}], label }
export async function putOutbox(id, data, prev = {}) {
  if (!KEY) throw new Error('Saved visits are locked. Enter your PIN.');
  const photos = [];
  for (const p of data.photos || []) photos.push({ view: p.view, mime: p.mime, w: p.w, h: p.h, q: p.q, client_uuid: p.client_uuid, box: p.blob ? await encryptBlob(p.blob) : null, uploaded: !!p.uploaded });
  const item = {
    id, created_at: prev.created_at || new Date().toISOString(), label: data.label || '', status: prev.status || 'pending', error: null,
    case_id: data.case_id || prev.case_id || null, visit: await encrypt(data.visit), photos,
  };
  await tx('outbox', 'readwrite', s => s.put(item));
}
async function decryptItem(it) {
  return {
    visit: await decryptJson(it.visit), case_id: it.case_id, label: it.label,
    photos: await Promise.all(it.photos.map(async p => ({ ...p, blob: p.box ? await decryptBlob(p.box) : null, box: undefined }))),
  };
}
export async function listOutbox(rawItems = false) {
  const items = await tx('outbox', 'readonly', s => reqP(s.getAll()));
  if (rawItems) return items;
  return items.map(i => ({ id: i.id, created_at: i.created_at, label: i.label, status: i.status, error: i.error, photos: i.photos.length }));
}
async function updateItem(id, patch) {
  const it = await tx('outbox', 'readonly', s => reqP(s.get(id)));
  if (it) await tx('outbox', 'readwrite', s => s.put({ ...it, ...patch }));
}
export async function removeOutbox(id) { await tx('outbox', 'readwrite', s => s.delete(id)); }

let syncing = null;
export function syncOutbox(onChange) {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!KEY || !navigator.onLine) return { sent: 0 };
    let sent = 0;
    for (const it of await listOutbox(true)) {
      try {
        const data = await decryptItem(it);
        let caseId = it.case_id;
        if (!caseId) {
          const r = await api('/api/visits', { method: 'POST', body: data.visit });
          caseId = r.case_id;
          await updateItem(it.id, { case_id: caseId, status: 'photos' });
        }
        for (let i = 0; i < it.photos.length; i++) {
          const p = data.photos[i];
          if (p.uploaded || !p.blob) continue;
          if (p.view === 'voice_note') {
            await api(`/api/cases/${caseId}/voice?client_uuid=${encodeURIComponent(p.client_uuid)}`, { method: 'POST', raw: p.blob, headers: { 'content-type': p.mime || 'audio/webm' } });
          } else {
            const qs = new URLSearchParams({ view: p.view, client_uuid: p.client_uuid, w: p.w || '', h: p.h || '', q: p.q ?? '' });
            await api(`/api/cases/${caseId}/images?${qs}`, { method: 'POST', raw: p.blob, headers: { 'content-type': 'image/jpeg' } });
          }
          it.photos[i].uploaded = true;
          await updateItem(it.id, { photos: it.photos });
        }
        await removeOutbox(it.id);
        sent++;
      } catch (e) {
        if (e.code === 'offline') break;
        await updateItem(it.id, { status: 'error', error: e.message });
      }
      onChange && onChange();
    }
    return { sent };
  })().finally(() => { syncing = null; });
  return syncing;
}

export function uuid() { return crypto.randomUUID(); }
