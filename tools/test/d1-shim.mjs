// A tiny stand-in for Cloudflare D1 in tests, on Node's built-in SQLite (node:sqlite, Node 22.5+).
// It covers the D1 calls the Worker uses: prepare().bind().first(col?) / all() / run(), and batch().
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function makeD1(migrationsDir) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON'); // D1 enforces foreign keys; the tests must too (a delete bug hid here once)
  for (const f of (await readdir(migrationsDir)).filter((x) => x.endsWith('.sql')).sort()) db.exec(await readFile(path.join(migrationsDir, f), 'utf8'));
  const plain = (r) => (r ? { ...r } : null);
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a.map((v) => (v === undefined ? null : v))),
    first: async (col) => { const r = plain(db.prepare(sql).get(...args)); return r == null ? null : col ? r[col] : r; },
    all: async () => ({ results: db.prepare(sql).all(...args).map(plain) }),
    run: async () => { const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid), changes: i.changes } }; }
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => { db.exec('BEGIN'); try { const out = []; for (const s of list) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    raw: db
  };
}

// Static assets from dist-tools/ (what the Worker serves with env.ASSETS).
export function makeAssets(dir) {
  return {
    fetch: async (req) => {
      const p = decodeURIComponent(new URL(req.url).pathname);
      const file = path.join(dir, p.endsWith('/') ? p + 'index.html' : p);
      try {
        const body = await readFile(file);
        const type = file.endsWith('.json') ? 'application/json' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
        return new Response(body, { status: 200, headers: { 'Content-Type': type } });
      } catch { return new Response('not found', { status: 404 }); }
    }
  };
}
