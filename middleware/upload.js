const multer = require('multer');

// Memory storage to keep buffer in memory before uploading to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Max 50MB per file
  },
});

module.exports = upload;
