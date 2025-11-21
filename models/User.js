const mongoose = require('mongoose');

const VaultSchema = new mongoose.Schema({
  ct: String,   // ciphertext
  iv: String    // AES IV
}, { _id: false });

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true }, // login password (hashed)
  salt: { type: String, required: true },         // salt used for master key derivation
  vault: { type: VaultSchema, default: null },    // encrypted vault { ct, iv }
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
