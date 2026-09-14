const fs = require('fs');
const path = require('path');
const Audio = require('../models/Audio');
const AudioPlaylist = require('../models/AudioPlaylist');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');

/**
 * Upload Audio Chunk
 * POST /api/audio/upload-chunk
 * Header: Authorization: Bearer <jwt>
 * Multipart/form-data: uploadId, chunkIndex, totalChunks, chunk (file)
 */
const uploadAudioChunk = async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks } = req.body;

    if (!uploadId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({
        success: false,
        message: 'uploadId, chunkIndex, and totalChunks are required',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Chunk file is required',
      });
    }

    const tempDir = path.join(__dirname, '../uploads/temp', uploadId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}.tmp`);
    fs.writeFileSync(chunkPath, req.file.buffer);

    res.status(200).json({
      success: true,
      uploadId,
      chunkIndex: parseInt(chunkIndex, 10),
      totalChunks: parseInt(totalChunks, 10),
      message: `Chunk ${chunkIndex} uploaded successfully`,
    });
  } catch (error) {
    console.error('Error in uploadAudioChunk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save audio chunk',
      error: error.message,
    });
  }
};

/**
 * Complete Chunked Audio Upload
 * POST /api/audio/complete-chunked-upload
 * Header: Authorization: Bearer <jwt>
 * JSON Body: { uploadId, totalChunks, name, visibility, thumbnailImageUrl }
 */
const completeChunkedUpload = async (req, res) => {
  try {
    const { uploadId, totalChunks, name, visibility, thumbnailImageUrl } = req.body;

    if (!uploadId || !totalChunks || !name) {
      return res.status(400).json({
        success: false,
        message: 'uploadId, totalChunks, and name are required',
      });
    }

    const tempDir = path.join(__dirname, '../uploads/temp', uploadId);
    if (!fs.existsSync(tempDir)) {
      return res.status(400).json({
        success: false,
        message: 'No chunked upload session found for this uploadId',
      });
    }

    const total = parseInt(totalChunks, 10);
    const chunkBuffers = [];

    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(tempDir, `chunk_${i}.tmp`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({
          success: false,
          message: `Missing chunk ${i} of ${total} for uploadId ${uploadId}`,
        });
      }
      chunkBuffers.push(fs.readFileSync(chunkPath));
    }

    // Concatenate all chunks into a single complete audio buffer
    const fullAudioBuffer = Buffer.concat(chunkBuffers);

    // Upload concatenated audio to Cloudinary
    const audioUploadResult = await uploadToCloudinary(fullAudioBuffer, {
      folder: 'tune_world/audios',
      resource_type: 'video',
    });

    // Cleanup temp chunk files asynchronously
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}

    const validVisibilities = ['private', 'unlisted', 'public'];
    const audioVisibility = validVisibilities.includes(visibility) ? visibility : 'public';

    const newAudio = await Audio.create({
      name: name.trim(),
      userId: req.user.userId,
      audioUrl: audioUploadResult.secure_url,
      thumbnailImageUrl: thumbnailImageUrl || '',
      visibility: audioVisibility,
    });

    res.status(201).json({
      success: true,
      message: 'Chunked audio upload completed successfully',
      audio: newAudio,
    });
  } catch (error) {
    console.error('Error in completeChunkedUpload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete chunked audio upload',
      error: error.message,
    });
  }
};

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

/**
 * Generate Cloudinary Upload Signature
 * GET /api/audio/cloudinary-signature
 * Header: Authorization: Bearer <jwt>
 */
const getCloudinarySignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = req.query.folder || 'tune_world/audios';

    if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary configuration is missing in server .env environment variables',
      });
    }

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      success: true,
      timestamp,
      signature,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error('Error generating Cloudinary signature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
      error: error.message,
    });
  }
};

/**
 * Save Audio Metadata to MongoDB (Direct Upload Flow)
 * POST /api/audio/save-metadata
 * Header: Authorization: Bearer <jwt>
 * JSON Body: { name, audioUrl, thumbnailImageUrl, visibility }
 */
const saveAudioMetadata = async (req, res) => {
  try {
    const { name, audioUrl, thumbnailImageUrl, visibility } = req.body;

    if (!name || !audioUrl) {
      return res.status(400).json({
        success: false,
        message: 'Name and audioUrl are required',
      });
    }

    const validVisibilities = ['private', 'unlisted', 'public'];
    const audioVisibility = validVisibilities.includes(visibility) ? visibility : 'public';

    const newAudio = await Audio.create({
      name: name.trim(),
      userId: req.user.userId,
      audioUrl,
      thumbnailImageUrl: thumbnailImageUrl || '',
      visibility: audioVisibility,
    });

    res.status(201).json({
      success: true,
      message: 'Audio saved successfully',
      audio: newAudio,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save audio metadata',
      error: error.message,
    });
  }
};

/**
 * Update Audio (Name, Visibility, Thumbnail)
 * PUT /api/audio/:id
 * Header: Authorization: Bearer <jwt>
 */
const updateAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, visibility, thumbnailImageUrl } = req.body;

    const audio = await Audio.findById(id);
    if (!audio) {
      return res.status(404).json({
        success: false,
        message: 'Audio not found',
      });
    }

    // Ownership check
    if (audio.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit your own uploaded audio',
      });
    }

    if (name && name.trim() !== '') {
      audio.name = name.trim();
    }

    const validVisibilities = ['private', 'unlisted', 'public'];
    if (visibility && validVisibilities.includes(visibility)) {
      audio.visibility = visibility;
    }

    if (thumbnailImageUrl !== undefined) {
      audio.thumbnailImageUrl = thumbnailImageUrl;
    }

    await audio.save();

    res.status(200).json({
      success: true,
      message: 'Audio updated successfully',
      audio,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update audio',
      error: error.message,
    });
  }
};

/**
 * Delete Audio
 * DELETE /api/audio/:id
 * Header: Authorization: Bearer <jwt>
 */
const deleteAudio = async (req, res) => {
  try {
    const { id } = req.params;

    const audio = await Audio.findById(id);
    if (!audio) {
      return res.status(404).json({
        success: false,
        message: 'Audio not found',
      });
    }

    // Ownership check
    if (audio.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own uploaded audio',
      });
    }

    await Audio.findByIdAndDelete(id);

    // Clean up AudioPlaylist entries referencing this deleted audio
    await AudioPlaylist.deleteMany({ audioId: id });

    res.status(200).json({
      success: true,
      message: 'Audio deleted successfully',
      audioId: id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete audio',
      error: error.message,
    });
  }
};

/**
 * Bulk Delete Audios
 * POST /api/audio/bulk-delete
 * Header: Authorization: Bearer <jwt>
 * JSON Body: { audioIds: [...] }
 */
const bulkDeleteAudios = async (req, res) => {
  try {
    const { audioIds } = req.body;

    if (!audioIds || !Array.isArray(audioIds) || audioIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'audioIds must be a non-empty array of audio IDs',
      });
    }

    // Delete only audios owned by the authenticated user
    const userAudios = await Audio.find({
      _id: { $in: audioIds },
      userId: req.user.userId,
    }).select('_id');

    const validIds = userAudios.map((a) => a._id);

    if (validIds.length > 0) {
      await Audio.deleteMany({ _id: { $in: validIds } });
      await AudioPlaylist.deleteMany({ audioId: { $in: validIds } });
    }

    res.status(200).json({
      success: true,
      message: `${validIds.length} audio(s) deleted successfully`,
      deletedCount: validIds.length,
      deletedAudioIds: validIds,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete audios in bulk',
      error: error.message,
    });
  }
};

module.exports = {
  uploadAudio,
  uploadAudioChunk,
  completeChunkedUpload,
  getMyAudios,
  getPublicAudios,
  getCloudinarySignature,
  saveAudioMetadata,
  updateAudio,
  deleteAudio,
  bulkDeleteAudios,
};
