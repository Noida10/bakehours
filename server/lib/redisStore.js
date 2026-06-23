// Upstash Redis persistence backend — strongly consistent and fast, the right
// fit for this app's small key→JSON records. Works with credentials from
// Vercel KV *or* a direct Upstash database (both expose a REST URL + token).

const { Redis } = require('@upstash/redis');

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const available = !!(URL && TOKEN);

let redis = null;
if (available) {
  redis = new Redis({ url: URL, token: TOKEN });
}

function keyFor(namespace, id) {
  return `${namespace}:${id}`;
}

async function read(namespace, id) {
  try {
    const v = await redis.get(keyFor(namespace, id));
    return v ?? null; // @upstash/redis auto-parses JSON values
  } catch (e) {
    console.error(`[redis] read ${namespace}:${id} FAILED — ${(e && e.message) || e}`);
    throw e;
  }
}

async function write(namespace, id, data) {
  try {
    await redis.set(keyFor(namespace, id), data); // auto-serialized to JSON
    console.log(`[redis] write ${namespace}:${id}: ok`);
  } catch (e) {
    console.error(`[redis] write ${namespace}:${id} FAILED — ${(e && e.message) || e}`);
    throw e;
  }
}

module.exports = { read, write, available };
