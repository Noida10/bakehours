// Effective (runtime) roster. Base dev members ship in code; admins can add
// more, which are persisted under the "meta:roster" key. Also owns name
// resolution so new members and login aliases are matched everywhere.

const { read, write } = require('./store');
const {
  BASE_DEV_MEMBERS,
  ADMINS,
  ALIASES,
  roleFor,
  canEdit,
  resolveNameWith,
} = require('./names');

let cache = null;
let cacheAt = 0;
const TTL_MS = 3000;

async function loadExtra() {
  const meta = await read('meta', 'roster');
  return meta && Array.isArray(meta.extraMembers) ? meta.extraMembers : [];
}

// { devMembers, allNames, extra } — devMembers are everyone with a data row.
async function getRoster(force = false) {
  if (!force && cache && Date.now() - cacheAt < TTL_MS) return cache;
  const extra = await loadExtra();
  const devMembers = [...BASE_DEV_MEMBERS, ...extra];
  cache = { devMembers, allNames: [...devMembers, 'Julien'], extra };
  cacheAt = Date.now();
  return cache;
}

function invalidate() {
  cache = null;
}

async function getDevMembers() {
  return (await getRoster()).devMembers;
}

async function resolveName(input) {
  const { allNames } = await getRoster();
  return resolveNameWith(input, allNames, ALIASES);
}

async function hasDataRow(name) {
  const { devMembers } = await getRoster();
  return devMembers.includes(name);
}

async function validateName(input) {
  const canonicalName = await resolveName(input);
  if (!canonicalName) {
    return { valid: false, canonicalName: null, role: null };
  }
  const { devMembers } = await getRoster();
  return {
    valid: true,
    canonicalName,
    role: roleFor(canonicalName),
    canEdit: canEdit(canonicalName),
    hasDataRow: devMembers.includes(canonicalName),
    isAdmin: ADMINS.includes(canonicalName),
  };
}

// --- Mutations (admin only, enforced in routes) ------------------------

function normalizeMemberName(raw) {
  const name = String(raw || '').trim();
  if (!name) return null;
  // Title-case-ish: keep as typed but collapse whitespace.
  return name.replace(/\s+/g, ' ');
}

async function addMember(raw) {
  const name = normalizeMemberName(raw);
  if (!name) return { ok: false, error: 'Name required' };

  const { devMembers } = await getRoster(true);
  // Reject duplicates (case-insensitive) and clashes with reserved names.
  const lower = name.toLowerCase();
  if (devMembers.some((m) => m.toLowerCase() === lower) || lower === 'julien') {
    return { ok: false, error: 'That member already exists' };
  }
  if (ALIASES[lower]) {
    return { ok: false, error: 'That name is reserved' };
  }

  const meta = (await read('meta', 'roster')) || { extraMembers: [] };
  meta.extraMembers = [...(meta.extraMembers || []), name];
  await write('meta', 'roster', meta);
  invalidate();
  return { ok: true, name };
}

async function removeMember(raw) {
  const name = normalizeMemberName(raw);
  if (!name) return { ok: false, error: 'Name required' };
  const lower = name.toLowerCase();

  // Only admin-added members can be removed; base members are permanent.
  if (BASE_DEV_MEMBERS.some((m) => m.toLowerCase() === lower)) {
    return { ok: false, error: 'Built-in members cannot be removed' };
  }
  const meta = (await read('meta', 'roster')) || { extraMembers: [] };
  const before = (meta.extraMembers || []).length;
  meta.extraMembers = (meta.extraMembers || []).filter(
    (m) => m.toLowerCase() !== lower
  );
  if (meta.extraMembers.length === before) {
    return { ok: false, error: 'Member not found' };
  }
  await write('meta', 'roster', meta);
  invalidate();
  return { ok: true, name };
}

module.exports = {
  ADMINS,
  getRoster,
  getDevMembers,
  resolveName,
  hasDataRow,
  validateName,
  addMember,
  removeMember,
  invalidate,
};
