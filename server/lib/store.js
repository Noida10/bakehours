// Pluggable key/value persistence. Backend is auto-selected:
//   1. Redis (Vercel KV / Upstash) if its REST env vars are present.
//   2. Vercel Blob if a Blob read/write token is present.
//   3. JSON files under /data otherwise. On Vercel the project FS is read-only,
//      so this falls back to /tmp, which is EPHEMERAL — data is lost on cold
//      starts. Configure KV or Blob for real persistence.
// Keys are namespaced as "<namespace>:<id>", e.g. "sprints:2026-W22".

const fs = require('fs');
const path = require('path');
const blobStore = require('./blobStore');

// --- Redis / KV detection (accept Vercel KV or raw Upstash names) ---
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKV = !!(KV_URL && KV_TOKEN);

let kv = null;
if (useKV) {
  const { createClient } = require('@vercel/kv');
  kv = createClient({ url: KV_URL, token: KV_TOKEN });
}

// --- Blob detection (only when KV isn't configured) ---
const useBlob = !useKV && blobStore.available;

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const NAMESPACES = ['sprints', 'vacations', 'projects', 'meta'];

// File-mode location. Project FS is read-only on Vercel, so fall back to /tmp.
const useFile = !useKV && !useBlob;
const FILE_BASE = !useFile
  ? null
  : process.env.VERCEL
  ? path.join('/tmp', 'eitp-data')
  : DATA_DIR;

if (useFile) {
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
    return (await kv.get(`${namespace}:${id}`)) || null;
  }
  if (useBlob) {
    return blobStore.read(namespace, id);
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
  if (useBlob) {
    await blobStore.write(namespace, id, data);
    return;
  }
  fs.mkdirSync(path.join(FILE_BASE, namespace), { recursive: true });
  fs.writeFileSync(fileFor(namespace, id), JSON.stringify(data, null, 2));
}

const mode = useKV ? 'kv' : useBlob ? 'blob' : 'file';
// Durable across requests? KV/Blob always; file mode only off-Vercel.
const persistent = useKV || useBlob || !process.env.VERCEL;

// Startup banner — visible in Vercel's function logs so the active backend
// (and any misconfiguration) is obvious at a glance.
const tokenVars = Object.keys(process.env).filter((k) =>
  /READ_WRITE_TOKEN$/.test(k)
);
console.log(
  `[store] backend=${mode} persistent=${persistent} onVercel=${!!process.env.VERCEL}`
);
console.log(
  `[store] KV vars present=${useKV} | blob token vars=${
    tokenVars.length ? tokenVars.join(',') : '(none)'
  }`
);
if (mode === 'file' && process.env.VERCEL) {
  console.warn(
    '[store] WARNING: on Vercel in FILE mode — data is written to /tmp and is ' +
      'WIPED on cold starts. Connect a Blob or KV store and REDEPLOY to persist.'
  );
}

module.exports = { read, write, useKV, useBlob, mode, persistent, DATA_DIR };
