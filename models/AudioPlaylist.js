const mongoose = require('mongoose');

const audioPlaylistSchema = new mongoose.Schema(
  {
    audioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audio',
      required: true,
    },
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

// Prevent duplicate audio in the same playlist
audioPlaylistSchema.index({ playlistId: 1, audioId: 1 }, { unique: true });

module.exports = mongoose.model('AudioPlaylist', audioPlaylistSchema);
