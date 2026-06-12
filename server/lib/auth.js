// Lightweight name-based identification. The client sends the resolved
// name in an `x-user-name` header; we re-resolve it canonically server-side.

const { validateName, ADMINS } = require('./names');

function identify(req, res, next) {
  // Prefer the header; fall back to a query param for download links
  // (anchor/window navigation cannot send custom headers).
  const raw = req.header('x-user-name') || req.query.__name || '';
  const result = validateName(raw);
  if (result.valid) {
    req.user = {
      name: result.canonicalName,
      role: result.role,
      isAdmin: ADMINS.includes(result.canonicalName),
      canEdit: result.canEdit,
    };
  } else {
    req.user = null;
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Name not recognised.' });
  }
  next();
}

// PUT guard: only the named member may modify their own data, and Julien
// (view-only admin) may never write.
function canWriteMember(req, member) {
  if (!req.user) return false;
  if (!req.user.canEdit) return false; // Julien blocked from all writes
  return req.user.name === member;
}

module.exports = { identify, requireUser, canWriteMember };
