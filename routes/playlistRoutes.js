const express = require('express');
const router = express.Router();
const {
  createPlaylist,
  addAudioToPlaylist,
  getPublicPlaylists,
  getMyPlaylists,
  getPlaylistDetails,
  updatePlaylist,
  deletePlaylist,
  removeAudioFromPlaylist,
} = require('../controllers/playlistController');
const { verifyToken, optionalToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Middleware wrapper to handle Multer playlist cover upload errors cleanly as JSON
const handlePlaylistUpload = (req, res, next) => {
  const uploadSingle = upload.single('image');
  uploadSingle(req, res, (err) => {
    if (err) {
      console.error('Multer Playlist Upload Error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'Playlist cover image size exceeds the upload limit.',
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

// Create playlist
router.post('/', verifyToken, handlePlaylistUpload, createPlaylist);

// Update playlist (name, visibility, cover image)
router.put('/:id', verifyToken, handlePlaylistUpload, updatePlaylist);

// Delete playlist
router.delete('/:id', verifyToken, deletePlaylist);

// Add audio to playlist (only playlist creator)
router.post('/:playlistId/add-audio', verifyToken, addAudioToPlaylist);

// Remove audio from playlist (only playlist creator)
router.delete('/:playlistId/remove-audio/:audioId', verifyToken, removeAudioFromPlaylist);

// Public view of playlists (No token required)
router.get('/public', getPublicPlaylists);

// Authenticated view of playlists (user's private, unlisted & public playlists)
router.get('/my-playlists', verifyToken, getMyPlaylists);

// Get playlist details with audios (supports optional auth for private playlist check)
router.get('/:playlistId', optionalToken, getPlaylistDetails);

module.exports = router;
