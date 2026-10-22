// Photo processing on the phone: resize, re-encode as JPEG (which drops EXIF/GPS data),
// and check brightness and sharpness so the worker can retake a poor photo straight away.

const MAX_SIDE = 1600;

export async function processPhoto(file) {
  const bmp = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  const quality = measure(ctx, w, h);
  let blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.82));
  if (blob.size > 1_400_000) blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.65));
  return { blob, w, h, ...quality };
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// Brightness = mean luma; sharpness = variance of a Laplacian on a 256px grey copy.
function measure(ctx, w, h) {
  const s = Math.min(1, 256 / Math.max(w, h));
  const sw = Math.max(8, Math.round(w * s)), sh = Math.max(8, Math.round(h * s));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const cx = c.getContext('2d');
  cx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const d = cx.getImageData(0, 0, sw, sh).data;
  const g = new Float32Array(sw * sh);
  let sum = 0;
  for (let i = 0; i < g.length; i++) { const y = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; g[i] = y; sum += y; }
  const mean = sum / g.length;
  let lsum = 0, lsq = 0, n = 0;
  for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
    const i = y * sw + x;
    const L = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - sw] - g[i + sw];
    lsum += L; lsq += L * L; n++;
  }
  const variance = lsq / n - (lsum / n) ** 2;
  const problems = [];
  if (mean < 55) problems.push('dark');
  if (mean > 225) problems.push('bright');
  if (variance < 60) problems.push('blurry');
  return { brightness: Math.round(mean), sharpness: Math.round(variance), problems, q: Math.round(Math.min(1, variance / 300) * 100) / 100 };
}
