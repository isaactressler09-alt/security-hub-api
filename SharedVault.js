const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    status: { type: String, enum: ['online', 'idle', 'offline'], default: 'offline' },
    lastActive: { type: Date, default: Date.now }
}, { _id: false });

const SharedVaultSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vaultName: { type: String, required: true },

    // Hashed vault join password (not the master password!)
    vaultPasswordHash: { type: String, required: true },

    // Members of the shared vault
    members: { type: [MemberSchema], default: [] },

    // Encrypted shared vault contents
    vaultData: {
        ct: { type: String, default: "" },
        iv: { type: String, default: "" }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SharedVault', SharedVaultSchema);
