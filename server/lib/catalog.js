// Shared project catalog. Admins (Anmol & Julien) curate the list; members
// pick from it (or type a custom name) when logging project hours.
// Stored under the "meta:catalog" key as { projects: [{ name }] }.

const { read, write } = require('./store');

async function getCatalog() {
  const data = await read('meta', 'catalog');
  const projects = data && Array.isArray(data.projects) ? data.projects : [];
  return { projects };
}

// Replace the whole list (dedupe by name, drop blanks).
async function setCatalog(projects) {
  const seen = new Set();
  const clean = [];
  for (const p of projects || []) {
    const name = String((p && p.name) || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ name });
  }
  const data = { projects: clean };
  await write('meta', 'catalog', data);
  return data;
}

module.exports = { getCatalog, setCatalog };
