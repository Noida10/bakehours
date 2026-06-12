// Pluggable key/value persistence.
//   - On Vercel (KV env vars present): Vercel KV (Upstash Redis).
//   - Locally / anywhere else: JSON files under /data.
// Keys are namespaced as "<namespace>:<id>", e.g. "sprints:2026-W22".

const fs = require('fs');
const path = require('path');

const useKV = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

let kv = null;
if (useKV) {
  // Lazy require so local dev doesn't need the package installed.
  kv = require('@vercel/kv').kv;
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const NAMESPACES = ['sprints', 'vacations', 'projects'];

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

module.exports = { read, write, useKV, mode, DATA_DIR };
