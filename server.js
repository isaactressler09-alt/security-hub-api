require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const vaultRoutes = require('./routes/vault');

const app = express();

// Allow frontends to talk to this API
app.use(cors({ origin: true, credentials: true }));

// Parse JSON bodies
app.use(express.json());

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);

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
