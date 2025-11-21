const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Middleware: checks JWT token and loads user ID
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/vault → get encrypted vault
router.get('/', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ vault: user.vault });
});

// POST /api/vault → save encrypted vault
router.post('/', authMiddleware, async (req, res) => {
  const { ct, iv } = req.body;

  if (!ct || !iv) {
    return res.status(400).json({ error: 'Missing ct or iv' });
  }

  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.vault = { ct, iv };
  user.updatedAt = new Date();
  await user.save();

  res.json({ ok: true });
});

// POST /api/vault/reset → clears vault if user forgets master password
router.post('/reset', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.vault = null;
  user.updatedAt = new Date();
  await user.save();

  res.json({ ok: true });
});

module.exports = router;
