// Vercel Blob persistence backend. Stores each record as a JSON object at a
// deterministic path ("data/<namespace>/<id>.json") so it can be overwritten
// and read back. Used by store.js when a Blob read/write token is configured.

const { put, list } = require('@vercel/blob');

// Resolve the read/write token: the standard injected var, any custom
// "*_READ_WRITE_TOKEN" (Vercel names it after the store), or an explicit one.
function findToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const keys = Object.keys(process.env);
  const blobKey =
    keys.find((k) => /READ_WRITE_TOKEN$/.test(k) && /BLOB/i.test(k)) ||
    keys.find((k) => /READ_WRITE_TOKEN$/.test(k));
  return blobKey ? process.env[blobKey] : undefined;
}

const TOKEN = findToken();
const available = !!TOKEN;

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

async function read(namespace, id) {
  const p = pathFor(namespace, id);
  const origin = await ensureBase();
  if (origin) {
    const res = await fetch(`${origin}/${p}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    }
  }
  // Fallback: locate the blob via list, then fetch its URL.
  try {
    const { blobs } = await list({ prefix: p, token: TOKEN, limit: 1 });
    const hit = (blobs || []).find((b) => b.pathname === p) || (blobs || [])[0];
    if (!hit) return null;
    if (!base) base = new URL(hit.url).origin;
    const res = await fetch(hit.url, { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function write(namespace, id, data) {
  const { url } = await put(pathFor(namespace, id), JSON.stringify(data), {
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
}

module.exports = { read, write, available };
