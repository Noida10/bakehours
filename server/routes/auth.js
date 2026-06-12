const express = require('express');
const { validateLogin, getRoster } = require('../lib/roster');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

// Validate a name typed at the sign-in screen (admins must use their code).
router.get(
  '/validate-name',
  asyncHandler(async (req, res) => {
    const result = await validateLogin(req.query.name || '');
    if (!result.valid) {
      const { loginNames } = await getRoster();
      return res.json({ valid: false, validNames: loginNames });
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
