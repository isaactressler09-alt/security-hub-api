// models/Vault.js
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String },
  role: { type: String, enum: ['owner', 'member'], default: 'member' },
  lastSeenAt: { type: Date }
}, { _id: false });

const vaultSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    default: 'Personal Vault'
  },
  type: {
    type: String,
    enum: ['personal', 'pro-shared'],
    default: 'personal'
  },
  // For shared vaults later (hashed via bcrypt)
  vaultPasswordHash: {
    type: String,
    default: null
  },
  members: {
    type: [memberSchema],
    default: []
  },
  // Encrypted blob: { passwords: [], notes: [] } encrypted client-side
  encryptedData: {
    ct: { type: String, default: null },
    iv: { type: String, default: null }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

vaultSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Vault', vaultSchema);
