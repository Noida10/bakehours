const express = require('express');
const { getCatalog, setCatalog } = require('../lib/catalog');
const { requireAdmin } = require('../lib/auth');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

// Any signed-in user can read the shared project list (members need it for
// the project dropdown).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getCatalog());
  })
);

// Admin (Anmol & Julien) can replace the list.
router.put(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await setCatalog((req.body && req.body.projects) || []);
    res.json(data);
  })
);

module.exports = router;
