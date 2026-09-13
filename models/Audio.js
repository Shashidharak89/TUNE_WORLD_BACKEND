const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Audio name is required'],
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    audioUrl: {
      type: String,
      required: [true, 'Audio URL is required'],
    },
    thumbnailImageUrl: {
      type: String,
      default: '',
    },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'public',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Audio', audioSchema);
