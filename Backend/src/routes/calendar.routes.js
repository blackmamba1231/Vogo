const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const CalendarEvent = require('../models/calendar-event.model');
const calendarService = require('../services/calendar.service');

// Apply auth middleware to all calendar routes
router.use(authMiddleware);

// Get all calendar events for the user
router.get('/', async (req, res) => {
  try {
    const events = await calendarService.getUserEvents(req.user.id);
    
    res.status(200).json({
      error: false,
      data: { events }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      error: true,
      message: 'Error retrieving events'
    });
  }
});

// Get a specific event
router.get('/:eventId', async (req, res) => {
  try {
    const event = await calendarService.getEvent(req.params.eventId, req.user.id);
    
    if (!event) {
      return res.status(404).json({
        error: true,
        message: 'Event not found'
      });
    }
    
    res.status(200).json({
      error: false,
      data: { event }
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      error: true,
      message: 'Error retrieving event'
    });
  }
});

// Create a new calendar event
router.post('/', async (req, res) => {
  try {
    const { title, description, startDateTime, endDateTime, location, serviceType } = req.body;
    
    // Validate required fields
    if (!title || !startDateTime) {
      return res.status(400).json({
        error: true,
        message: 'Title and start date/time are required'
      });
    }
    
    // Set default end time if not provided (1 hour after start)
    const start = new Date(startDateTime);
    const end = endDateTime ? new Date(endDateTime) : new Date(start.getTime() + 60 * 60 * 1000);
    
    const eventDetails = {
      title,
      description,
      startDateTime: start,
      endDateTime: end,
      location,
      serviceType
    };
    
    const event = await calendarService.createEvent(
      req.user.id,
      null, // No conversation ID if created directly
      eventDetails
    );
    
    res.status(201).json({
      error: false,
      message: 'Event created successfully',
      data: { event }
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      error: true,
      message: 'Error creating event'
    });
  }
});

// Update event status
router.patch('/:eventId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid status. Must be one of: pending, confirmed, cancelled, completed'
      });
    }
    
    const event = await calendarService.updateEventStatus(
      req.params.eventId,
      req.user.id,
      status
    );
    
    res.status(200).json({
      error: false,
      message: 'Event status updated',
      data: { event }
    });
  } catch (error) {
    console.error('Update event status error:', error);
    res.status(500).json({
      error: true,
      message: 'Error updating event status'
    });
  }
});

// Delete an event
router.delete('/:eventId', async (req, res) => {
  try {
    const success = await calendarService.deleteEvent(
      req.params.eventId,
      req.user.id
    );
    
    if (!success) {
      return res.status(404).json({
        error: true,
        message: 'Event not found or could not be deleted'
      });
    }
    
    res.status(200).json({
      error: false,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting event'
    });
  }
});

// Connect Google Calendar
router.post('/connect/google', async (req, res) => {
  try {
    // This would typically redirect to Google OAuth flow
    // For now, just a placeholder endpoint
    res.status(200).json({
      error: false,
      message: 'Please implement OAuth flow for Google Calendar integration'
    });
  } catch (error) {
    console.error('Connect Google Calendar error:', error);
    res.status(500).json({
      error: true,
      message: 'Error connecting to Google Calendar'
    });
  }
});

module.exports = router;
