// Canonical team roster, roles, and name-matching logic.
// Shared rules: case-insensitive, trimmed, fuzzy-friendly matching.

// Dev team members each get a sprint/vacation data row.
// Order here is the display order used in admin team tables.
const DEV_MEMBERS = [
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
const ALL_NAMES = [...DEV_MEMBERS, 'Julien'];

const ADMINS = ['Anmol', 'Julien'];

function roleFor(canonicalName) {
  if (canonicalName === 'Anmol') return 'admin'; // editing admin (has data row)
  if (canonicalName === 'Julien') return 'admin'; // view-only admin (no data row)
  return 'member';
}

// Anmol can edit; Julien cannot edit anything.
function canEdit(canonicalName) {
  return canonicalName !== 'Julien';
}

function hasDataRow(canonicalName) {
  return DEV_MEMBERS.includes(canonicalName);
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

// Resolve a freely-typed name to a canonical roster name, or null.
function resolveName(input) {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;

  // 1. Exact (case-insensitive, trimmed) match.
  for (const name of ALL_NAMES) {
    if (name.toLowerCase() === cleaned) return name;
  }

  // 2. Prefix / contains match for partial typing.
  for (const name of ALL_NAMES) {
    const lower = name.toLowerCase();
    if (lower.startsWith(cleaned) || cleaned.startsWith(lower)) return name;
  }

  // 3. Fuzzy match using Levenshtein distance, scaled to name length.
  let best = null;
  let bestDist = Infinity;
  for (const name of ALL_NAMES) {
    const dist = levenshtein(cleaned, name.toLowerCase());
    // Allow ~30% of the name length in edits (min 1, max 3).
    const threshold = Math.min(3, Math.max(1, Math.floor(name.length * 0.3)));
    if (dist <= threshold && dist < bestDist) {
      best = name;
      bestDist = dist;
    }
  }
  return best;
}

function validateName(input) {
  const canonicalName = resolveName(input);
  if (!canonicalName) {
    return { valid: false, canonicalName: null, role: null };
  }
  return {
    valid: true,
    canonicalName,
    role: roleFor(canonicalName),
    canEdit: canEdit(canonicalName),
    hasDataRow: hasDataRow(canonicalName),
    isAdmin: ADMINS.includes(canonicalName),
  };
}

module.exports = {
  DEV_MEMBERS,
  ALL_NAMES,
  ADMINS,
  roleFor,
  canEdit,
  hasDataRow,
  resolveName,
  validateName,
};
