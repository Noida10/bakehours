const express = require('express');
const { addMember, removeMember, getRoster } = require('../lib/roster');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

// Admin (Anmol & Julien): add a new team member.
router.post(
  '/members',
  asyncHandler(async (req, res) => {
    const result = await addMember(req.body && req.body.name);
    if (!result.ok) return res.status(400).json({ error: result.error });
    const { devMembers } = await getRoster(true);
    res.json({ added: result.name, devMembers });
  })
);

// Admin (Anmol & Julien): remove an admin-added member.
router.delete(
  '/members/:name',
  asyncHandler(async (req, res) => {
    const result = await removeMember(req.params.name);
    if (!result.ok) return res.status(400).json({ error: result.error });
    const { devMembers } = await getRoster(true);
    res.json({ removed: result.name, devMembers });
  })
);

module.exports = router;
