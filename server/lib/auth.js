// Lightweight name-based identification. The client sends the resolved
// name in an `x-user-name` header; we re-resolve it canonically server-side
// against the (dynamic) roster.

const { validateName, ADMINS } = require('./roster');

async function identify(req, res, next) {
  try {
    // Prefer the header; fall back to a query param for download links
    // (anchor/window navigation cannot send custom headers).
    const raw = req.header('x-user-name') || req.query.__name || '';
    const result = await validateName(raw);
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
  } catch (err) {
    next(err);
  }
}

function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Name not recognised.' });
  }
  next();
}

// Admin-only guard (Anmol or Julien) for shared-management endpoints.
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

// PUT guard for member data: only the named member may modify their own
// data, and Julien (view-only admin) may never write member data.
function canWriteMember(req, member) {
  if (!req.user) return false;
  if (!req.user.canEdit) return false; // Julien blocked from member writes
  return req.user.name === member;
}

module.exports = { identify, requireUser, requireAdmin, canWriteMember };
