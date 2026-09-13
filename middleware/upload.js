const multer = require('multer');

// Memory storage to keep buffer in memory before uploading to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Max 100MB per file
    fieldSize: 100 * 1024 * 1024, // Max 100MB per field
  },
});

module.exports = upload;
