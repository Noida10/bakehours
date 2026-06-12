const express = require('express');
const { validateName, ALL_NAMES, DEV_MEMBERS } = require('../lib/names');

const router = express.Router();

// Validate a freely-typed name, returning the canonical name + role.
router.get('/validate-name', (req, res) => {
  const result = validateName(req.query.name || '');
  if (!result.valid) {
    return res.json({ valid: false, validNames: ALL_NAMES });
  }
  res.json({
    valid: true,
    canonicalName: result.canonicalName,
    role: result.role,
    isAdmin: result.isAdmin,
    canEdit: result.canEdit,
    hasDataRow: result.hasDataRow,
  });
});

// Roster metadata (used by the admin views for ordering).
router.get('/roster', (req, res) => {
  res.json({ devMembers: DEV_MEMBERS, allNames: ALL_NAMES });
});

module.exports = router;
