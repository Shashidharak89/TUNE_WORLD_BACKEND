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

// Universal CORS Middleware - Allow ALL Origins Dynamically
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const corsOptions = {
  origin: (origin, callback) => callback(null, true), // Dynamically allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
  res.header('Access-Control-Allow-Origin', '*');
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
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
