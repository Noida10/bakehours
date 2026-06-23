// Pluggable key/value persistence. Backend is auto-selected:
//   1. Upstash Redis (Vercel KV or a direct Upstash DB) if REST env vars exist.
//      Strongly consistent — recommended.
//   2. Vercel Blob if a Blob read/write token is present.
//   3. JSON files under /data otherwise. On Vercel the project FS is read-only,
//      so this falls back to /tmp, which is EPHEMERAL — data is lost on cold
//      starts. Configure Redis (or Blob) for real persistence.
// Keys are namespaced as "<namespace>:<id>", e.g. "sprints:2026-W22".

const fs = require('fs');
const path = require('path');
const redisStore = require('./redisStore');
const blobStore = require('./blobStore');

const useRedis = redisStore.available;
const useBlob = !useRedis && blobStore.available;
const useFile = !useRedis && !useBlob;

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const NAMESPACES = ['sprints', 'vacations', 'projects', 'meta'];

// File-mode location. Project FS is read-only on Vercel, so fall back to /tmp.
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
  if (useRedis) return redisStore.read(namespace, id);
  if (useBlob) return blobStore.read(namespace, id);
  try {
    return JSON.parse(fs.readFileSync(fileFor(namespace, id), 'utf8'));
  } catch {
    return null;
  }
}

async function write(namespace, id, data) {
  if (useRedis) return redisStore.write(namespace, id, data);
  if (useBlob) return blobStore.write(namespace, id, data);
  fs.mkdirSync(path.join(FILE_BASE, namespace), { recursive: true });
  fs.writeFileSync(fileFor(namespace, id), JSON.stringify(data, null, 2));
  return undefined;
}

const mode = useRedis ? 'redis' : useBlob ? 'blob' : 'file';
// Durable across requests? Redis/Blob always; file mode only off-Vercel.
const persistent = useRedis || useBlob || !process.env.VERCEL;

// Startup banner — visible in Vercel's function logs so the active backend
// (and any misconfiguration) is obvious at a glance.
const redisVars = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'].filter(
  (k) => process.env[k]
);
const tokenVars = Object.keys(process.env).filter((k) =>
  /READ_WRITE_TOKEN$/.test(k)
);
console.log(
  `[store] backend=${mode} persistent=${persistent} onVercel=${!!process.env.VERCEL}`
);
console.log(
  `[store] redis url vars=${redisVars.join(',') || '(none)'} | blob token vars=${
    tokenVars.join(',') || '(none)'
  }`
);
if (mode === 'file' && process.env.VERCEL) {
  console.warn(
    '[store] WARNING: on Vercel in FILE mode — data is written to /tmp and is ' +
      'WIPED on cold starts. Connect Upstash Redis (or Blob) and REDEPLOY.'
  );
}

module.exports = { read, write, useRedis, useBlob, mode, persistent, DATA_DIR };
