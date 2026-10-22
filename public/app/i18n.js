// Interface translations. Keys are the English text; packs live in /app/lang/<code>.js.
// Any string missing from a pack appears in English.


// Language packs: /app/lang/<code>.js export { ui, clinical, notice, layers, deciders }.
export const DICTS = {};
export async function loadLang(code) {
  if (!code || code === 'en' || DICTS[code]) return DICTS[code] || null;
  try { DICTS[code] = (await import(`/app/lang/${code}.js`)).default; } catch (e) { console.warn('language pack missing', code, e); DICTS[code] = { ui: {}, clinical: {} }; }
  return DICTS[code];
}
