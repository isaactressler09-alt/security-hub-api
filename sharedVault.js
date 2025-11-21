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

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;  // { userId, email }
    next();
  } catch {
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
      vaultData: null,  // encrypted {ct, iv}
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
    console.error(err);
    res.status(500).json({ error: 'Error creating vault' });
  }
});

/* ------------------------
   INVITE USER (email only)
------------------------ */
router.post('/invite', authMiddleware, async (req, res) => {
  try {
    const { vaultId, email } = req.body;

    if (!vaultId || !email) {
      return res.status(400).json({ error: 'Missing vaultId or email' });
    }

    const vault = await SharedVault.findById(vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    if (vault.owner !== req.user.userId) {
      return res.status(403).json({ error: 'Only owner can invite users' });
    }

    const exists = vault.members.find(m => m.email === email);
    if (exists) {
      return res.json({ ok: true, message: 'User already exists or pending' });
    }

    vault.members.push({
      userId: null,
      email,
      role: 'member',
      status: 'offline'
    });

    await vault.save();
    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error inviting user' });
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
      return res.status(403).json({ error: 'Incorrect join password' });
    }

    // if invited and entry is "pending"
    let member = vault.members.find(m => m.email === req.user.email);

    if (member) {
      member.userId = req.user.userId;
      member.status = 'online';
      await vault.save();
      return res.json({ ok: true });
    }

    // if joining without invite — still allow
    vault.members.push({
      userId: req.user.userId,
      email: req.user.email,
      role: 'member',
      status: 'online'
    });

    await vault.save();
    res.json({ ok: true });

  } catch (err) {
    console.error(err);
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

    // If owner leaves → delete vault
    if (vault.owner === req.user.userId) {
      await vault.deleteOne();
      return res.json({ ok: true, deleted: true });
    }

    // normal member leaves
    vault.members = vault.members.filter(m => m.userId !== req.user.userId);
    await vault.save();

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error leaving vault' });
  }
});

/* ------------------------
   KICK MEMBER (owner only)
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
    console.error(err);
    res.status(500).json({ error: 'Error kicking member' });
  }
});

/* ------------------------
   CHANGE USER STATUS
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
    if (!member) return res.status(403).json({ error: 'Not a member' });

    member.status = status;
    await vault.save();

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Status update failed' });
  }
});

/* ------------------------
   GET VAULT INFO (no data)
------------------------ */
router.get('/:vaultId', authMiddleware, async (req, res) => {
  try {
    const vault = await SharedVault.findById(req.params.vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    res.json({
      vaultName: vault.vaultName,
      owner: vault.owner,
      members: vault.members
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching vault data' });
  }
});

/* ------------------------
   GET ENCRYPTED VAULT DATA
------------------------ */
router.get('/:vaultId/data', authMiddleware, async (req, res) => {
  try {
    const vault = await SharedVault.findById(req.params.vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const isMember = vault.members.some(m => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    res.json({ vault: vault.vaultData || null });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading vault data' });
  }
});

/* ------------------------
   SAVE ENCRYPTED VAULT DATA
------------------------ */
router.post('/:vaultId/save', authMiddleware, async (req, res) => {
  try {
    const { ct, iv } = req.body;
    const vault = await SharedVault.findById(req.params.vaultId);

    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const isMember = vault.members.some(m => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    vault.vaultData = { ct, iv };
    await vault.save();

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error saving vault data' });
  }
});

module.exports = router;
