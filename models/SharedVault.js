const mongoose = require('mongoose');

const SharedVaultSchema = new mongoose.Schema({
  owner: { type: String, required: true },    // userId of owner
  vaultName: { type: String, required: true },
  joinPassword: { type: String, required: true },

  // NEW — encrypted vault data
  vault: {
    ct: { type: String, default: null },
    iv: { type: String, default: null }
  },

  members: [
    {
      userId: String,
      email: String,
      role: { type: String, enum: ['owner', 'member'], default: 'member' },
      status: { type: String, enum: ['online', 'idle', 'offline'], default: 'offline' }
    }
  ]
});

module.exports = mongoose.model('SharedVault', SharedVaultSchema);
