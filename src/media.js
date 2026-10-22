// Photo storage. Uses R2 when the MEDIA_BUCKET binding exists, otherwise the interim D1 media database.
import { HttpError } from './util.js';

const MAX_BYTES = 1_500_000;

export async function putMedia(env, key, bytes, mime) {
  if (env.MEDIA_BUCKET) {
    await env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
  } else {
    await env.MEDIA_DB.prepare('INSERT OR REPLACE INTO media (key, mime, bytes) VALUES (?,?,?)').bind(key, mime, bytes).run();
  }
}

export async function getMedia(env, key) {
  if (env.MEDIA_BUCKET) {
    const obj = await env.MEDIA_BUCKET.get(key);
    if (obj) return { body: obj.body, mime: obj.httpMetadata?.contentType || 'image/jpeg' };
  }
  const row = await env.MEDIA_DB.prepare('SELECT mime, bytes FROM media WHERE key = ?').bind(key).first();
  if (!row) return null;
  return { body: new Uint8Array(row.bytes), mime: row.mime };
}

// Validate a JPEG and remove any EXIF/XMP (APP1) and comment segments, so no location or device data is stored.
export function cleanJpeg(buf) {
  const b = new Uint8Array(buf);
  if (b.length > MAX_BYTES) throw new HttpError(413, 'Photo is too large (max 1.5 MB)');
  if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) throw new HttpError(415, 'Only JPEG photos are accepted');
  const out = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) throw new HttpError(415, 'Photo file is damaged');
    const marker = b[i + 1];
    if (marker === 0xDA) { out.push(b.subarray(i)); break; }       // start of scan: copy the rest
    if (marker === 0xD9) { out.push(b.subarray(i, i + 2)); break; }
    const len = (b[i + 2] << 8) | b[i + 3];
    const drop = marker === 0xE1 || marker === 0xFE || (marker >= 0xE2 && marker <= 0xEF && marker !== 0xEE);
    if (!drop) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  const total = out.reduce((s, p) => s + p.length, 0);
  const res = new Uint8Array(total);
  let o = 0;
  for (const p of out) { res.set(p, o); o += p.length; }
  return res;
}
