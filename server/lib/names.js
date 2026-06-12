// Pure roster helpers and name-matching primitives. The *effective* roster
// (which can grow when admins add members) lives in roster.js; this module
// holds the fixed parts and stateless matching logic.

// The dev team members that ship by default. Admins can add more at runtime.
const BASE_DEV_MEMBERS = [
  'Anmol',
  'Vinay',
  'Roshan',
  'Chandrakesh',
  'Pawan',
  'Harit',
  'Sushobhita',
  'Divya',
];

// Julien is a view-only admin (manager) with no data row.
const ADMINS = ['Anmol', 'Julien'];

// Login aliases → canonical name. Lets people sign in with their handle or
// email local-part while reports still show the clean canonical name.
const ALIASES = {
  anmol224: 'Anmol',
  'anmol224@gmail.com': 'Anmol',
  julien779: 'Julien',
  'julien779@gmail.com': 'Julien',
};

function roleFor(canonicalName) {
  if (canonicalName === 'Anmol') return 'admin'; // editing admin (has data row)
  if (canonicalName === 'Julien') return 'admin'; // view-only admin (no data row)
  return 'member';
}

// Anmol can edit his own data; Julien cannot edit member data (view-only).
function canEdit(canonicalName) {
  return canonicalName !== 'Julien';
}

// Levenshtein distance for fuzzy matching of typed names.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// Resolve a freely-typed name against a roster + alias map. Pure function.
function resolveNameWith(input, names, aliases = {}) {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;

  // 1. Alias table (handles / emails).
  if (aliases[cleaned]) return aliases[cleaned];

  // 2. Exact (case-insensitive, trimmed) match.
  for (const name of names) {
    if (name.toLowerCase() === cleaned) return name;
  }

  // 3. Prefix / contains match for partial typing.
  for (const name of names) {
    const lower = name.toLowerCase();
    if (lower.startsWith(cleaned) || cleaned.startsWith(lower)) return name;
  }

  // 4. Fuzzy match using Levenshtein distance, scaled to name length.
  let best = null;
  let bestDist = Infinity;
  for (const name of names) {
    const dist = levenshtein(cleaned, name.toLowerCase());
    const threshold = Math.min(3, Math.max(1, Math.floor(name.length * 0.3)));
    if (dist <= threshold && dist < bestDist) {
      best = name;
      bestDist = dist;
    }
  }
  return best;
}

module.exports = {
  BASE_DEV_MEMBERS,
  ADMINS,
  ALIASES,
  roleFor,
  canEdit,
  levenshtein,
  resolveNameWith,
};
