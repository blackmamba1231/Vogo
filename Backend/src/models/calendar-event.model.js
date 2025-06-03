const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  userId: {
    type: String,
    ref: 'User',
    required: false
  },
  guestId: {
    type: String,
    required: false,
    default: null
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  startDateTime: {
    type: Date,
    required: true
  },
  endDateTime: {
    type: Date,
    required: true
  },
  location: {
    type: String
  },
  serviceType: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  googleEventId: {
    type: String
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  ticketCreated: {
    type: Boolean,
    default: false
  },
  ticketId: {
    type: String
  }
}, {
  timestamps: true
});

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);

module.exports = CalendarEvent;
