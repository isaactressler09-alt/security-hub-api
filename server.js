require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Your existing routes
const authRoutes = require('./routes/auth');
const vaultRoutes = require('./routes/vault');

// NEW — multi-vault system routes
const vaultsRoutes = require('./routes/vaults');

const app = express();

// Allow frontends to talk to this API
app.use(cors({ origin: true, credentials: true }));

// Parse JSON bodies
app.use(express.json());

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);     // existing personal vault
app.use('/api/vaults', vaultsRoutes);   // NEW multi-vault system

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected.');
    app.listen(process.env.PORT, () => {
      console.log(`API running on port ${process.env.PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
