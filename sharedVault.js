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
   LIST VAULTS YOU BELONG TO
------------------------ */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const vaults = await SharedVault.find({
      "members.userId": req.user.userId
    }).select('vaultName owner members');

    res.json({ vaults });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching vault list' });
  }
});

/* ------------------------
   CREATE SHARED VAULT
------------------------ */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { vaultName, joinPassword } = req.body;
    if (!vaultName || !joinPassword) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const vault = await SharedVault.create({
      owner: req.user.userId,
      vaultName,
      joinPassword,
      vault: { ct: null, iv: null },
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
   LOAD ENCRYPTED VAULT
------------------------ */
router.get('/:vaultId', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const vault = await SharedVault.findById(vaultId);

    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const isMember = vault.members.some(
      m => m.userId === req.user.userId
    );
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this vault' });
    }

    res.json({
      vault: vault.vault || { ct: null, iv: null },
      vaultName: vault.vaultName,
      owner: vault.owner,
      members: vault.members
    });
  } catch (err) {
    res.status(500).json({ error: 'Error loading vault' });
  }
});

/* ------------------------
   SAVE ENCRYPTED VAULT
------------------------ */
router.post('/:vaultId/save', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { ct, iv } = req.body;

    if (!ct || !iv) {
      return res.status(400).json({ error: 'Missing ciphertext' });
    }

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const isMember = vault.members.some(
      m => m.userId === req.user.userId
    );
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member' });
    }

    vault.vault = { ct, iv };
    await vault.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error saving vault' });
  }
});

/* ------------------------
   INVITE (email)
------------------------ */
router.post('/:vaultId/invite', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { email } = req.body;

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    if (vault.owner !== req.user.userId) {
      return res.status(403).json({ error: 'Only owner can invite' });
    }

    // no email sending yet — frontend handles join via vaultId+password
    res.json({ ok: true, message: 'Invite simulated (email sending not implemented)' });
  } catch (err) {
    res.status(500).json({ error: 'Invite error' });
  }
});

/* ------------------------
   JOIN SHARED VAULT
------------------------ */
router.post('/:vaultId/join', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { joinPassword } = req.body;

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    if (vault.joinPassword !== joinPassword) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    const existing = vault.members.find(m => m.userId === req.user.userId);
    if (!existing) {
      vault.members.push({
        userId: req.user.userId,
        email: req.user.email,
        role: 'member',
        status: 'online'
      });
    } else {
      existing.status = 'online';
    }

    await vault.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Join error' });
  }
});

/* ------------------------
   LEAVE
------------------------ */
router.post('/:vaultId/leave', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const vault = await SharedVault.findById(vaultId);

    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    vault.members = vault.members.filter(
      m => m.userId !== req.user.userId
    );

    if (vault.owner === req.user.userId) {
      await vault.deleteOne();
      return res.json({ ok: true, deleted: true });
    }

    await vault.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Leave error' });
  }
});

/* ------------------------
   KICK MEMBER
------------------------ */
router.post('/:vaultId/kick', authMiddleware, async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { userId } = req.body;

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    if (vault.owner !== req.user.userId) {
      return res.status(403).json({ error: 'Only owner can kick members' });
    }

    vault.members = vault.members.filter(m => m.userId !== userId);
    await vault.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Kick error' });
  }
});

/* ------------------------
   GET MEMBERS
------------------------ */
router.get('/:vaultId/members', authMiddleware, async (req, res) => {
  try {
    const vault = await SharedVault.findById(req.params.vaultId);

    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    res.json({ members: vault.members });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching members' });
  }
});

module.exports = router;
