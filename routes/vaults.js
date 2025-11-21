// routes/vaults.js
const express = require('express');
const jwt = require('jsonwebtoken');
const Vault = require('../models/Vault');
const User = require('../models/User');

const router = express.Router();

// Reuse the same auth style as your other routes
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Assuming your /auth/login signed: { userId, email }
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * GET /api/vaults
 * List all vaults the current user owns or is a member of
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.userId;

    const vaults = await Vault.find({
      $or: [
        { ownerId: userId },
        { 'members.userId': userId }
      ]
    }).select('_id name type ownerId');

    res.json({ vaults });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list vaults' });
  }
});

/**
 * POST /api/vaults/create
 * Create a new vault (personal or pro-shared)
 * body: { name?, type? }
 */
router.post('/create', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const email = req.userEmail || '';
    const { name, type } = req.body;

    const vault = new Vault({
      ownerId: userId,
      name: name || 'New Vault',
      type: type === 'pro-shared' ? 'pro-shared' : 'personal',
      members: [
        {
          userId,
          email,
          role: 'owner',
          lastSeenAt: new Date()
        }
      ],
      encryptedData: null
    });

    await vault.save();
    res.json({ vault });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create vault' });
  }
});

/**
 * GET /api/vaults/:vaultId
 * Return the encrypted blob of one vault (if user has access)
 */
router.get('/:vaultId', auth, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const userId = req.userId;

    const vault = await Vault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const isOwner = vault.ownerId.toString() === userId;
    const isMember = vault.members.some(
      m => m.userId && m.userId.toString() === userId
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    res.json({ vault: vault.encryptedData });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load vault' });
  }
});

/**
 * POST /api/vaults/:vaultId/save
 * Save encrypted blob into a vault
 * body: { ct, iv }
 */
router.post('/:vaultId/save', auth, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const userId = req.userId;
    const { ct, iv } = req.body;

    if (!ct || !iv) {
      return res.status(400).json({ error: 'Missing ct / iv' });
    }

    const vault = await Vault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const isOwner = vault.ownerId.toString() === userId;
    const isMember = vault.members.some(
      m => m.userId && m.userId.toString() === userId
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    vault.encryptedData = { ct, iv };
    await vault.save();

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save vault' });
  }
});

module.exports = router;
