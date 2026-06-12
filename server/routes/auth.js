const express = require('express');
const { validateName, getRoster } = require('../lib/roster');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

// Validate a freely-typed name, returning the canonical name + role.
router.get(
  '/validate-name',
  asyncHandler(async (req, res) => {
    const result = await validateName(req.query.name || '');
    if (!result.valid) {
      const { allNames } = await getRoster();
      return res.json({ valid: false, validNames: allNames });
    }
    res.json({
      valid: true,
      canonicalName: result.canonicalName,
      role: result.role,
      isAdmin: result.isAdmin,
      canEdit: result.canEdit,
      hasDataRow: result.hasDataRow,
    });
  })
);

// Roster metadata (dev members in display order + all names).
router.get(
  '/roster',
  asyncHandler(async (req, res) => {
    const { devMembers, allNames } = await getRoster();
    res.json({ devMembers, allNames });
  })
);

module.exports = router;
