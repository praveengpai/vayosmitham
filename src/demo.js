// DEMO worker: the normal app plus fictional data that is created on first use and reset every night.
// Only deployed with `wrangler deploy --env demo` (ENVIRONMENT=demo, separate databases).
import app from './worker.js';
import schemaIdentity from '../demo/schema-identity.sql';
import schemaClinical from '../demo/schema-clinical.sql';
import schemaMedia from '../demo/schema-media.sql';
import identitySeed from '../demo/identity.sql';
import clinicalSeed from '../demo/clinical.sql';
import lsgdSeed from '../demo/lsgds.sql';
import mediaSeed from '../demo/media.sql';
import upIdentity0005 from '../demo/upgrade-identity-0005.sql';
import upClinical0005 from '../demo/upgrade-clinical-0005.sql';

// Schema upgrades for demo databases created by an earlier version. Each runs as one transaction (D1 batch).
const UPGRADES = [
  { db: 'IDENTITY', sql: upIdentity0005, done: "SELECT 1 AS x FROM pragma_table_info('users') WHERE name = 'institution_id'" },
  { db: 'CLINICAL', sql: upClinical0005, done: "SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'institutions'" },
];
async function upgrade(env) {
  for (const u of UPGRADES) {
    if (await env[u.db].prepare(u.done).first()) continue;
    const stmts = u.sql.trim().split('\n').filter(Boolean).map(line => env[u.db].prepare(line));
    await env[u.db].batch(stmts);
  }
}

const exec = (db, sql) => db.exec(sql.trim());

async function ensureSchema(env) {
  const t = await env.IDENTITY.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
  if (!t) {
    await exec(env.IDENTITY, schemaIdentity);
    await exec(env.CLINICAL, schemaClinical);
    await exec(env.MEDIA_DB, schemaMedia);
  }
  await upgrade(env);
  const l = await env.CLINICAL.prepare('SELECT COUNT(*) AS n FROM lsgds').first();
  if (!l.n) await exec(env.CLINICAL, lsgdSeed);
  const m = await env.MEDIA_DB.prepare("SELECT COUNT(*) AS n FROM media WHERE key LIKE 'demo/%'").first();
  if (m.n < 5) await exec(env.MEDIA_DB, mediaSeed);
}

export async function resetDemo(env) {
  if (env.ENVIRONMENT !== 'demo') throw new Error('Not the demo site');
  await ensureSchema(env);
  await exec(env.IDENTITY, identitySeed);
  await exec(env.CLINICAL, clinicalSeed);
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (env.ENVIRONMENT === 'demo' && url.pathname === '/api/demo/reset' && req.method === 'POST') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Cross-site request blocked' }, 403);
      // Allowed when the demo has never been set up, or for the demo super admin.
      const t = await env.IDENTITY.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
      const n = t ? (await env.IDENTITY.prepare('SELECT COUNT(*) AS n FROM users').first()).n : 0;
      if (n) {
        const me = await app.fetch(new Request(new URL('/api/me', url), { headers: { cookie: req.headers.get('cookie') || '' } }), env, ctx).then(r => r.json()).catch(() => ({}));
        if (me.user?.role !== 'superadmin') return json({ error: 'Only the demo super admin can reset the demo' }, 403);
      }
      const t0 = Date.now();
      await resetDemo(env);
      return json({ ok: true, ms: Date.now() - t0 });
    }
    return app.fetch(req, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (event.cron === '30 21 * * *') return resetDemo(env);
    return app.scheduled(event, env, ctx);
  },
};
