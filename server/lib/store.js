// Pluggable key/value persistence.
//   - If a Redis (Vercel KV / Upstash) REST endpoint is configured via env
//     vars: durable storage that survives across serverless invocations.
//   - Otherwise: JSON files under /data locally. On Vercel the project FS is
//     read-only, so this falls back to /tmp, which is EPHEMERAL — data is
//     lost on cold starts. Configure a KV store for real persistence.
// Keys are namespaced as "<namespace>:<id>", e.g. "sprints:2026-W22".

const fs = require('fs');
const path = require('path');

// Accept either the Vercel KV names or the raw Upstash names.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKV = !!(KV_URL && KV_TOKEN);

let kv = null;
if (useKV) {
  // Lazy require so local dev doesn't need the package wired to env vars.
  const { createClient } = require('@vercel/kv');
  kv = createClient({ url: KV_URL, token: KV_TOKEN });
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const NAMESPACES = ['sprints', 'vacations', 'projects', 'meta'];

// Where file-mode data lives. The project filesystem is read-only on Vercel,
// so fall back to /tmp there (ephemeral) instead of crashing on writes.
const FILE_BASE = useKV
  ? null
  : process.env.VERCEL
  ? path.join('/tmp', 'eitp-data')
  : DATA_DIR;

if (!useKV) {
  for (const ns of NAMESPACES) {
    try {
      fs.mkdirSync(path.join(FILE_BASE, ns), { recursive: true });
    } catch {
      /* best effort */
    }
  }
}

function fileFor(namespace, id) {
  return path.join(FILE_BASE, namespace, `${id}.json`);
}

async function read(namespace, id) {
  if (useKV) {
    // @vercel/kv auto-deserializes stored JSON.
    return (await kv.get(`${namespace}:${id}`)) || null;
  }
  try {
    return JSON.parse(fs.readFileSync(fileFor(namespace, id), 'utf8'));
  } catch {
    return null;
  }
}

async function write(namespace, id, data) {
  if (useKV) {
    await kv.set(`${namespace}:${id}`, data);
    return;
  }
  fs.mkdirSync(path.join(FILE_BASE, namespace), { recursive: true });
  fs.writeFileSync(fileFor(namespace, id), JSON.stringify(data, null, 2));
}

const mode = useKV ? 'kv' : 'file';
// Durable across requests? KV always; file mode only when NOT on Vercel
// (local disk persists; Vercel's /tmp does not).
const persistent = useKV || !process.env.VERCEL;

module.exports = { read, write, useKV, mode, persistent, DATA_DIR };
