const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true
  },
  parent: {
    type: Number,
    default: 0
  },
  count: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add text index for better search performance
categorySchema.index({ 
  name: 'text', 
  slug: 'text'
});

// Add index on slug for faster lookups
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });

module.exports = mongoose.model('Category', categorySchema);
