// Vercel Blob persistence backend. Stores each record as a JSON object at a
// deterministic path ("data/<namespace>/<id>.json") so it can be overwritten
// and read back. Used by store.js when a Blob read/write token is configured.

const { put, list } = require('@vercel/blob');

// Resolve the read/write token: the standard injected var, any custom
// "*_READ_WRITE_TOKEN" (Vercel names it after the store), or an explicit one.
// Returns the env var NAME so we can log it (never the secret value).
function findTokenKey() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'BLOB_READ_WRITE_TOKEN';
  const keys = Object.keys(process.env);
  return (
    keys.find((k) => /READ_WRITE_TOKEN$/.test(k) && /BLOB/i.test(k)) ||
    keys.find((k) => /READ_WRITE_TOKEN$/.test(k)) ||
    null
  );
}

const TOKEN_KEY = findTokenKey();
const TOKEN = TOKEN_KEY ? process.env[TOKEN_KEY] : undefined;
const available = !!TOKEN;

if (available) {
  console.log(`[blob] token detected from env var "${TOKEN_KEY}" (len=${TOKEN.length})`);
} else {
  console.log('[blob] no *_READ_WRITE_TOKEN env var found — Blob backend unavailable');
}

// Public origin of the store (e.g. https://xxxx.public.blob.vercel-storage.com).
// Cached per instance so reads are a direct fetch rather than a list call.
let base = null;

// Write-through cache. Vercel Blob serves content via a CDN that keeps serving
// the OLD object for a short while after an overwrite (its edge cache has a
// ~60s floor that query-string cache-busting can't defeat). So after we write,
// we hold the fresh value in memory and serve reads from it — that way a save
// followed by a refresh shows the new data immediately instead of "a few
// refreshes later". Entries expire so a warm instance eventually re-reads the
// (by then consistent) blob.
const cache = new Map(); // key -> { data, at }
const CACHE_TTL_MS = 90 * 1000;
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

function cacheKey(namespace, id) {
  return `${namespace}:${id}`;
}

function pathFor(namespace, id) {
  return `data/${namespace}/${id}.json`;
}

async function ensureBase() {
  if (base) return base;
  try {
    const { blobs } = await list({ token: TOKEN, limit: 1 });
    if (blobs && blobs[0]) base = new URL(blobs[0].url).origin;
  } catch {
    /* store may be empty or unreachable; caller falls back */
  }
  return base;
}

// A unique query param per read makes each request a CDN cache miss where
// possible; combined with the write-through cache above this keeps reads fresh.
function bust(url) {
  return `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
}

async function read(namespace, id) {
  const key = cacheKey(namespace, id);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return clone(cached.data);
  }

  const p = pathFor(namespace, id);
  const fresh = await fetchBlob(p);
  if (fresh != null) cache.set(key, { data: clone(fresh), at: Date.now() });
  return fresh;
}

async function fetchBlob(p) {
  const origin = await ensureBase();
  if (origin) {
    try {
      const res = await fetch(bust(`${origin}/${p}`), { cache: 'no-store' });
      if (res.status === 404) {
        console.log(`[blob] read ${p}: not found (404)`);
        return null;
      }
      if (res.ok) return await res.json();
      console.warn(`[blob] read ${p}: unexpected status ${res.status}`);
    } catch (e) {
      console.warn(`[blob] read ${p}: fetch error — ${(e && e.message) || e}`);
    }
  }
  // Fallback: locate the blob via list, then fetch its URL.
  try {
    const { blobs } = await list({ prefix: p, token: TOKEN, limit: 1 });
    const hit = (blobs || []).find((b) => b.pathname === p) || (blobs || [])[0];
    if (!hit) {
      console.log(`[blob] read ${p}: not found (list)`);
      return null;
    }
    if (!base) base = new URL(hit.url).origin;
    const res = await fetch(bust(hit.url), { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.error(`[blob] read ${p}: FAILED — ${(e && e.message) || e}`);
    return null;
  }
}

async function write(namespace, id, data) {
  const p = pathFor(namespace, id);
  try {
    const { url } = await put(p, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false, // stable, predictable path
      allowOverwrite: true, // updating an existing record
      contentType: 'application/json',
      cacheControlMaxAge: 0, // mutable data — don't let the CDN serve it stale
      token: TOKEN,
    });
    if (!base) {
      try {
        base = new URL(url).origin;
      } catch {
        /* ignore */
      }
    }
    // Serve subsequent reads from memory until the CDN catches up.
    cache.set(cacheKey(namespace, id), { data: clone(data), at: Date.now() });
    console.log(`[blob] write ${p}: ok`);
  } catch (e) {
    console.error(`[blob] write ${p}: FAILED — ${(e && e.message) || e}`);
    throw e; // surface to the route so the client sees a real error
  }
}

module.exports = { read, write, available };
