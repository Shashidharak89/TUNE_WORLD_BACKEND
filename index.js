require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const audioRoutes = require('./routes/audioRoutes');
const playlistRoutes = require('./routes/playlistRoutes');

const app = express();

// Database connection
connectDB();

// Core Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Tune World Backend API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/playlists', playlistRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  const status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE' || status === 413) {
    message = 'Request or audio file size is too large (maximum allowed size is 100MB).';
  }

  res.status(status).json({
    success: false,
    message,
    error: err.message,
  });
});

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`Tune World Backend running on port ${PORT}`);
});
