const Audio = require('../models/Audio');
const { uploadToCloudinary } = require('../config/cloudinary');

/**
 * Upload Audio and Optional Thumbnail to Cloudinary & Save to MongoDB
 * POST /api/audio/upload
 * Header: Authorization: Bearer <jwt>
 * Multipart/form-data: name, visibility, audio (file), thumbnail (file, optional)
 */
const uploadAudio = async (req, res) => {
  try {
    const { name, visibility } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Audio name is required',
      });
    }

    if (!req.files || !req.files.audio || req.files.audio.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Audio file is required',
      });
    }

    const audioFile = req.files.audio[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

    // Upload audio to Cloudinary
    const audioUploadResult = await uploadToCloudinary(audioFile.buffer, {
      folder: 'tune_world/audios',
      resource_type: 'video', // Cloudinary processes audio under 'video' or 'auto'
    });

    let thumbnailImageUrl = '';
    if (thumbnailFile) {
      const thumbnailUploadResult = await uploadToCloudinary(thumbnailFile.buffer, {
        folder: 'tune_world/thumbnails',
        resource_type: 'image',
      });
      thumbnailImageUrl = thumbnailUploadResult.secure_url;
    }

    const validVisibilities = ['private', 'unlisted', 'public'];
    const audioVisibility = validVisibilities.includes(visibility) ? visibility : 'public';

    const newAudio = await Audio.create({
      name: name.trim(),
      userId: req.user.userId,
      audioUrl: audioUploadResult.secure_url,
      thumbnailImageUrl,
      visibility: audioVisibility,
    });

    res.status(201).json({
      success: true,
      message: 'Audio uploaded successfully',
      audio: newAudio,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to upload audio',
      error: error.message,
    });
  }
};

/**
 * Authenticated User Uploads View
 * GET /api/audio/my-audios
 * Header: Authorization: Bearer <jwt>
 * Query: page (required), pageSize (required), search (optional)
 */
const getMyAudios = async (req, res) => {
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

    const totalItems = await Audio.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limitNum);

    const audios = await Audio.find(query)
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
      audios,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching uploaded audios',
      error: error.message,
    });
  }
};

/**
 * Public View of Audios (No Auth Token Required)
 * GET /api/audio/public
 * Query: page (required), pageSize (required), search (optional)
 */
const getPublicAudios = async (req, res) => {
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

    const totalItems = await Audio.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limitNum);

    const audios = await Audio.find(query)
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
      audios,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching public audios',
      error: error.message,
    });
  }
};

module.exports = {
  uploadAudio,
  getMyAudios,
  getPublicAudios,
};
