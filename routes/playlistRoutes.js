const express = require('express');
const router = express.Router();
const {
  createPlaylist,
  addAudioToPlaylist,
  getPublicPlaylists,
  getMyPlaylists,
  getPlaylistDetails,
} = require('../controllers/playlistController');
const { verifyToken, optionalToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Create playlist
router.post('/', verifyToken, upload.single('image'), createPlaylist);

// Add audio to playlist (only playlist creator)
router.post('/:playlistId/add-audio', verifyToken, addAudioToPlaylist);

// Public view of playlists (No token required)
router.get('/public', getPublicPlaylists);

// Authenticated view of playlists (user's private, unlisted & public playlists)
router.get('/my-playlists', verifyToken, getMyPlaylists);

// Get playlist details with audios (supports optional auth for private playlist check)
router.get('/:playlistId', optionalToken, getPlaylistDetails);

module.exports = router;
