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

// A unique query param per read makes each request a CDN cache miss, so we
// never get a stale object — or a cached 404 from just after a write.
function bust(url) {
  return `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
}

async function read(namespace, id) {
  const p = pathFor(namespace, id);
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
    console.log(`[blob] write ${p}: ok`);
  } catch (e) {
    console.error(`[blob] write ${p}: FAILED — ${(e && e.message) || e}`);
    throw e; // surface to the route so the client sees a real error
  }
}

module.exports = { read, write, available };
