const express = require('express');
const router = express.Router();
const { uploadAudio, getMyAudios, getPublicAudios } = require('../controllers/audioController');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Middleware wrapper to handle Multer upload errors cleanly as JSON
const handleAudioUpload = (req, res, next) => {
  const uploadFields = upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]);

  uploadFields(req, res, (err) => {
    if (err) {
      console.error('Multer Audio Upload Error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'Audio or thumbnail file size exceeds the 100MB upload limit.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error',
      });
    }
    next();
  });
};

// Upload audio & thumbnail
router.post('/upload', verifyToken, handleAudioUpload, uploadAudio);

// Authenticated view of uploaded audios
router.get('/my-audios', verifyToken, getMyAudios);

// Public view of audios (No token required)
router.get('/public', getPublicAudios);

module.exports = router;
