const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  userId: { type: String, default: null },   // Set once user logs in
  email: { type: String, required: true },   // Used for invites
  role: { type: String, enum: ['owner', 'member'], default: 'member' },
  status: { type: String, enum: ['online', 'idle', 'offline'], default: 'offline' }
}, { _id: false });

const SharedVaultSchema = new mongoose.Schema({
  owner: { type: String, required: true },  // userId of owner
  vaultName: { type: String, required: true },
  joinPassword: { type: String, required: true }, // Password required for join()

  // Encrypted vault blob (same format as personal)
  vaultData: {
    ct: { type: String, default: null },
    iv: { type: String, default: null }
  },

  // All users with access
  members: { type: [MemberSchema], default: [] }

}, { timestamps: true });

module.exports = mongoose.model('SharedVault', SharedVaultSchema);
