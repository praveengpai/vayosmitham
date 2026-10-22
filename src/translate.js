// Machine translation with caching.
// Order of engines:
//   1. Bhashini (Government of India) — used automatically when BHASHINI_USER_ID and BHASHINI_API_KEY secrets exist.
//   2. Cloudflare Workers AI — IndicTrans2 for English → Indian languages; an instruction model for Indian → English.
// Every result is cached in the clinical DB so the same text is never translated twice.
import { sha256 } from './util.js';

const INDICTRANS_CODES = { ml: 'mal_Mlym', ta: 'tam_Taml', kn: 'kan_Knda', te: 'tel_Telu', hi: 'hin_Deva', bn: 'ben_Beng', gu: 'guj_Gujr', pa: 'pan_Guru', or: 'ory_Orya', mr: 'mar_Deva', ur: 'urd_Arab' };
const LANG_NAMES = { en: 'English', ml: 'Malayalam', ta: 'Tamil', kn: 'Kannada', te: 'Telugu', hi: 'Hindi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', or: 'Odia', mr: 'Marathi', ur: 'Urdu' };
const LLM_MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];

export async function translate(env, text, src, tgt) {
  text = String(text || '').trim();
  if (!text || src === tgt) return { text, engine: 'none', cached: false };
  const key = await sha256(`${src}|${tgt}|${text}`);
  const hit = await env.CLINICAL.prepare('SELECT out_text, engine FROM translations WHERE hash = ?').bind(key).first();
  if (hit) return { text: hit.out_text, engine: hit.engine, cached: true };

  let out = null, engine = null;
  if (env.BHASHINI_USER_ID && env.BHASHINI_API_KEY) {
    try { out = await bhashini(env, text, src, tgt); engine = 'bhashini'; } catch (e) { console.error('bhashini failed', e.message); }
  }
  if (!out && src === 'en' && INDICTRANS_CODES[tgt]) {
    try {
      const r = await env.AI.run('@cf/ai4bharat/indictrans2-en-indic-1B', { text: splitSentences(text), target_language: INDICTRANS_CODES[tgt] });
      if (r?.translations?.length) { out = r.translations.join(' '); engine = 'indictrans2'; }
    } catch (e) { console.error('indictrans2 failed', e.message); }
  }
  if (!out) {
    for (const model of LLM_MODELS) {
      try { out = await llmTranslate(env, model, text, src, tgt); engine = model.split('/').pop(); if (out) break; }
      catch (e) { console.error(model, 'failed', e.message); }
    }
  }
  if (!out) {
    try {
      const r = await env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang: src, target_lang: tgt });
      if (r?.translated_text) { out = r.translated_text; engine = 'm2m100'; }
    } catch (e) { console.error('m2m100 failed', e.message); }
  }
  if (!out) return { text: null, engine: null, cached: false, error: 'Translation is not available right now' };
  await env.CLINICAL.prepare('INSERT OR REPLACE INTO translations (hash, src_lang, tgt_lang, out_text, engine) VALUES (?,?,?,?,?)')
    .bind(key, src, tgt, out, engine).run();
  return { text: out, engine, cached: false };
}

function splitSentences(text) {
  // IndicTrans2 works best sentence by sentence; keep line breaks as sentence ends.
  const parts = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

async function llmTranslate(env, model, text, src, tgt) {
  const messages = [
    { role: 'system', content: `You are a medical translator for a community dental programme for older people in India. Translate the user's text from ${LANG_NAMES[src] || src} to ${LANG_NAMES[tgt] || tgt}. Keep dental and medical meaning exact, keep numbers, tooth numbers, drug names and proper nouns unchanged. Output only the translation, with no notes or quotation marks.` },
    { role: 'user', content: text },
  ];
  const r = await env.AI.run(model, { messages, max_tokens: 1024, temperature: 0.1 });
  const out = typeof r?.response === 'string' ? r.response : r?.choices?.[0]?.message?.content;
  return out ? String(out).trim() : null;
}

const BHASHINI_CODES = { en: 'en', ml: 'ml', ta: 'ta', kn: 'kn', te: 'te', hi: 'hi', bn: 'bn', gu: 'gu', pa: 'pa', or: 'or', mr: 'mr', ur: 'ur' };
async function bhashini(env, text, src, tgt) {
  // Step 1: ask the ULCA pipeline config for a translation service for this language pair.
  const cfgRes = await fetch('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json', userID: env.BHASHINI_USER_ID, ulcaApiKey: env.BHASHINI_API_KEY },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: BHASHINI_CODES[src], targetLanguage: BHASHINI_CODES[tgt] } } }],
      pipelineRequestConfig: { pipelineId: env.BHASHINI_PIPELINE_ID || '64392f96daac500b55c543cd' },
    }),
  });
  if (!cfgRes.ok) throw new Error('config ' + cfgRes.status);
  const cfg = await cfgRes.json();
  const ep = cfg.pipelineInferenceAPIEndPoint;
  const serviceId = cfg.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  if (!ep?.callbackUrl || !serviceId) throw new Error('no service');
  // Step 2: run the translation.
  const res = await fetch(ep.callbackUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [ep.inferenceApiKey.name]: ep.inferenceApiKey.value },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: BHASHINI_CODES[src], targetLanguage: BHASHINI_CODES[tgt] }, serviceId } }],
      inputData: { input: [{ source: text }] },
    }),
  });
  if (!res.ok) throw new Error('compute ' + res.status);
  const data = await res.json();
  return data.pipelineResponse?.[0]?.output?.map(o => o.target).join(' ') || null;
}

// Glossary terms present in a text, so readers see the approved equivalents next to a machine translation.
export async function glossaryHits(env, text) {
  const { results } = await env.CLINICAL.prepare('SELECT en, ml FROM glossary').all();
  const lower = String(text || '').toLowerCase();
  return results.filter(g => lower.includes(g.en.toLowerCase()) || String(text || '').includes(g.ml));
}
