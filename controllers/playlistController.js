const Playlist = require('../models/Playlist');
const Audio = require('../models/Audio');
const AudioPlaylist = require('../models/AudioPlaylist');
const { uploadToCloudinary } = require('../config/cloudinary');

/**
 * Create Playlist
 * POST /api/playlists
 * Header: Authorization: Bearer <jwt>
 * Form-data / JSON: name, visibility, image (file, optional) or imageUrl
 */
const createPlaylist = async (req, res) => {
  try {
    const { name, visibility, imageUrl } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Playlist name is required',
      });
    }

    let finalImageUrl = imageUrl || '';

    // If an image file was uploaded with multer
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: 'tune_world/playlists',
        resource_type: 'image',
      });
      finalImageUrl = uploadResult.secure_url;
    }

    const validVisibilities = ['private', 'unlisted', 'public'];
    const playlistVisibility = validVisibilities.includes(visibility) ? visibility : 'public';

    const playlist = await Playlist.create({
      name: name.trim(),
      visibility: playlistVisibility,
      userId: req.user.userId,
      imageUrl: finalImageUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Playlist created successfully',
      playlist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create playlist',
      error: error.message,
    });
  }
};

/**
 * Add Audio to Playlist
 * POST /api/playlists/:playlistId/add-audio
 * Header: Authorization: Bearer <jwt>
 * Body: { audioId }
 */
const addAudioToPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { audioId } = req.body;

    if (!audioId) {
      return res.status(400).json({
        success: false,
        message: 'audioId is required',
      });
    }

    // Check playlist existence
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    // Strict Ownership Check: Only playlist creator can add music
    if (playlist.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the creator of this playlist can add music to it',
      });
    }

    // Check audio existence (User can add any audio: theirs or anyone else's)
    const audio = await Audio.findById(audioId);
    if (!audio) {
      return res.status(404).json({
        success: false,
        message: 'Audio not found',
      });
    }

    // Check if audio already added to playlist
    const existingEntry = await AudioPlaylist.findOne({ playlistId, audioId });
    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Audio is already present in this playlist',
      });
    }

    const audioPlaylist = await AudioPlaylist.create({
      playlistId,
      audioId,
    });

    res.status(201).json({
      success: true,
      message: 'Audio added to playlist successfully',
      entry: audioPlaylist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add audio to playlist',
      error: error.message,
    });
  }
};

/**
 * Public View of Playlists (No Auth Token Required)
 * GET /api/playlists/public
 * Query: page (required), pageSize (required), search (optional)
 */
const getPublicPlaylists = async (req, res) => {
  try {
    const { page, pageSize, search } = req.query;

    if (!page || !pageSize) {
      return res.status(400).json({
        success: false,
        message: 'Both page and pageSize query parameters are required',
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(pageSize, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'page and pageSize must be positive integers',
      });
    }

    const query = { visibility: 'public' };

    if (search && search.trim() !== '') {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const totalItems = await Playlist.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limitNum);

    const playlists = await Playlist.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      pagination: {
        page: pageNum,
        pageSize: limitNum,
        totalItems,
        totalPages,
      },
      playlists,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching public playlists',
      error: error.message,
    });
  }
};

/**
 * Authenticated User View of Playlists (Returns user's private, unlisted & public playlists)
 * GET /api/playlists/my-playlists
 * Header: Authorization: Bearer <jwt>
 * Query: page (required), pageSize (required), search (optional)
 */
const getMyPlaylists = async (req, res) => {
  try {
    const { page, pageSize, search } = req.query;

    if (!page || !pageSize) {
      return res.status(400).json({
        success: false,
        message: 'Both page and pageSize query parameters are required',
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(pageSize, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'page and pageSize must be positive integers',
      });
    }

    const query = { userId: req.user.userId };

    if (search && search.trim() !== '') {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const totalItems = await Playlist.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limitNum);

    const playlists = await Playlist.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      pagination: {
        page: pageNum,
        pageSize: limitNum,
        totalItems,
        totalPages,
      },
      playlists,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user playlists',
      error: error.message,
    });
  }
};

/**
 * Get Playlist Details with Paginated Audios
 * GET /api/playlists/:playlistId
 * Optional Header: Authorization: Bearer <jwt>
 * Query: page (required), pageSize (required), search (optional)
 */
const getPlaylistDetails = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { page, pageSize, search } = req.query;

    if (!page || !pageSize) {
      return res.status(400).json({
        success: false,
        message: 'Both page and pageSize query parameters are required',
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(pageSize, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'page and pageSize must be positive integers',
      });
    }

    const playlist = await Playlist.findById(playlistId).populate('userId', 'name email');
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    // Permission check for private playlists
    if (playlist.visibility === 'private') {
      const currentUserId = req.user ? req.user.userId : null;
      if (!currentUserId || playlist.userId._id.toString() !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This playlist is private.',
        });
      }
    }

    // Fetch AudioPlaylist junction records
    const audioPlaylistEntries = await AudioPlaylist.find({ playlistId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'audioId',
        populate: { path: 'userId', select: 'name email' },
      });

    let audios = audioPlaylistEntries
      .map((entry) => entry.audioId)
      .filter((audio) => audio !== null);

    // Apply search filter if keyword provided
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      audios = audios.filter((audio) => searchRegex.test(audio.name));
    }

    const totalItems = audios.length;
    const totalPages = Math.ceil(totalItems / limitNum);

    const paginatedAudios = audios.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.status(200).json({
      success: true,
      playlist,
      pagination: {
        page: pageNum,
        pageSize: limitNum,
        totalItems,
        totalPages,
      },
      audios: paginatedAudios,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching playlist details',
      error: error.message,
    });
  }
};

/**
 * Update Playlist (Name, Visibility, Image)
 * PUT /api/playlists/:id
 * Header: Authorization: Bearer <jwt>
 */
const updatePlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, visibility, imageUrl } = req.body;

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    // Ownership check
    if (playlist.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit your own playlist',
      });
    }

    if (name && name.trim() !== '') {
      playlist.name = name.trim();
    }

    const validVisibilities = ['private', 'unlisted', 'public'];
    if (visibility && validVisibilities.includes(visibility)) {
      playlist.visibility = visibility;
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: 'tune_world/playlists',
        resource_type: 'image',
      });
      playlist.imageUrl = uploadResult.secure_url;
    } else if (imageUrl !== undefined) {
      playlist.imageUrl = imageUrl;
    }

    await playlist.save();

    res.status(200).json({
      success: true,
      message: 'Playlist updated successfully',
      playlist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update playlist',
      error: error.message,
    });
  }
};

/**
 * Delete Playlist
 * DELETE /api/playlists/:id
 * Header: Authorization: Bearer <jwt>
 */
const deletePlaylist = async (req, res) => {
  try {
    const { id } = req.params;

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    // Ownership check
    if (playlist.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own playlist',
      });
    }

    await Playlist.findByIdAndDelete(id);

    // Clean up AudioPlaylist entries associated with this playlist
    await AudioPlaylist.deleteMany({ playlistId: id });

    res.status(200).json({
      success: true,
      message: 'Playlist deleted successfully',
      playlistId: id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete playlist',
      error: error.message,
    });
  }
};

/**
 * Remove Audio from Playlist
 * DELETE /api/playlists/:playlistId/remove-audio/:audioId
 * Header: Authorization: Bearer <jwt>
 */
const removeAudioFromPlaylist = async (req, res) => {
  try {
    const { playlistId, audioId } = req.params;

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    // Ownership check
    if (playlist.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the playlist creator can remove music from it',
      });
    }

    await AudioPlaylist.findOneAndDelete({ playlistId, audioId });

    res.status(200).json({
      success: true,
      message: 'Audio removed from playlist successfully',
      playlistId,
      audioId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove audio from playlist',
      error: error.message,
    });
  }
};

module.exports = {
  createPlaylist,
  addAudioToPlaylist,
  getPublicPlaylists,
  getMyPlaylists,
  getPlaylistDetails,
  updatePlaylist,
  deletePlaylist,
  removeAudioFromPlaylist,
};
