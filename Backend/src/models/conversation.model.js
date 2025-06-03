const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system', 'operator'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  schedulingState: {
    type: Object,
    default: null
  },
  userId: {
    type: String,
    ref: 'User'
  },
  sessionId: {
    type: String,
    required: true
  },
  messages: [messageSchema],
  language: {
    type: String,
    enum: ['en', 'fr', 'ro'],
    default: 'en'
  },
  intent: {
    type: String,
    enum: ['general', 'calendar_event', 'shopping_list', 'restaurant_search', 'food_order', 'service_booking', 'other'],
    default: 'general'
  },
  location: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  operatorAssigned: {
    type: Boolean,
    default: false
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ticketId: {
    type: String
  },
  foodProducts: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for faster queries
conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ sessionId: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
