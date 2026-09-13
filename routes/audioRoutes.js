const express = require('express');
const router = express.Router();
const { uploadAudio, getMyAudios, getPublicAudios } = require('../controllers/audioController');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Upload audio & thumbnail
router.post(
  '/upload',
  verifyToken,
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  uploadAudio
);

// Authenticated view of uploaded audios
router.get('/my-audios', verifyToken, getMyAudios);

// Public view of audios (No token required)
router.get('/public', getPublicAudios);

module.exports = router;
