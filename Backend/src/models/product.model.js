const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  shortDescription: String,
  price: String,
  regularPrice: String,
  salePrice: String,
  stockStatus: String,
  categories: [{
    id: Number,
    name: String,
    slug: String
  }],
  tags: [{
    id: Number,
    name: String,
    slug: String
  }],
  images: [String],
  attributes: [Object],
  permalink: String,
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
productSchema.index({ 
  name: 'text', 
  shortDescription: 'text',
  'categories.name': 'text',
  'categories.slug': 'text',
  'tags.name': 'text'
});

// Add index on categories for faster filtering
productSchema.index({ 'categories.id': 1 });
productSchema.index({ 'categories.slug': 1 });

module.exports = mongoose.model('Product', productSchema);
