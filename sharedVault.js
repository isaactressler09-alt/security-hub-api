const express = require('express');
const jwt = require('jsonwebtoken');
const SharedVault = require('../models/SharedVault');
const router = express.Router();

/* ------------------------
   AUTH MIDDLEWARE
------------------------ */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, email }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* ------------------------
   CREATE SHARED VAULT
------------------------ */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { vaultName, joinPassword } = req.body;
    if (!vaultName || !joinPassword) {
      return res.status(400).json({ error: 'Missing vaultName or joinPassword' });
    }

    const vault = await SharedVault.create({
      owner: req.user.userId,
      vaultName,
      joinPassword,
      members: [
        {
          userId: req.user.userId,
          email: req.user.email,
          role: 'owner',
          status: 'online'
        }
      ]
    });

    res.json({ ok: true, vaultId: vault._id });
  } catch (err) {
    res.status(500).json({ error: 'Error creating vault' });
  }
});

/* ------------------------
   JOIN SHARED VAULT
------------------------ */
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const { vaultId, password } = req.body;
    if (!vaultId || !password) {
      return res.status(400).json({ error: 'Missing vaultId or password' });
    }

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    if (vault.joinPassword !== password) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    // Already in vault?
    const existing = vault.members.find(m => m.userId === req.user.userId);
    if (existing) {
      existing.status = 'online';
      await vault.save();
      return res.json({ ok: true, message: 'Already a member' });
    }

    // Add new member
    vault.members.push({
      userId: req.user.userId,
      email: req.user.email,
      role: 'member',
      status: 'online'
    });

    await vault.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error joining vault' });
  }
});

/* ------------------------
   LEAVE SHARED VAULT
------------------------ */
router.post('/leave', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.body;
    const vault = await SharedVault.findById(vaultId);

    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    // Remove user
    vault.members = vault.members.filter(m => m.userId !== req.user.userId);

    // If owner leaves → vault is deleted
    if (vault.owner === req.user.userId) {
      await vault.deleteOne();
      return res.json({ ok: true, deleted: true });
    }

    await vault.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error leaving vault' });
  }
});

/* ------------------------
   KICK A MEMBER
   (owner only)
------------------------ */
router.post('/kick', authMiddleware, async (req, res) => {
  try {
    const { vaultId, userId } = req.body;

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    if (vault.owner !== req.user.userId) {
      return res.status(403).json({ error: 'Only owner can kick members' });
    }

    vault.members = vault.members.filter(m => m.userId !== userId);
    await vault.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error kicking member' });
  }
});

/* ------------------------
   UPDATE STATUS
------------------------ */
router.post('/status', authMiddleware, async (req, res) => {
  try {
    const { vaultId, status } = req.body;

    const valid = ['online', 'idle', 'offline'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const member = vault.members.find(m => m.userId === req.user.userId);
    if (!member) return res.status(403).json({ error: 'Not a member of this vault' });

    member.status = status;
    await vault.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error updating status' });
  }
});

/* ------------------------
   GET VAULT OVERVIEW
------------------------ */
router.get('/:vaultId', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const vault = await SharedVault.findById(vaultId);

    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    res.json({
      vaultName: vault.vaultName,
      owner: vault.owner,
      members: vault.members
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching vault data' });
  }
});

module.exports = router;
