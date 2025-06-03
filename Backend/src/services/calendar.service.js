const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const User = require('../models/user.model');
const CalendarEvent = require('../models/calendar-event.model');
const { JWT } = require('google-auth-library');

// Service account credentials
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Handle the private key with or without newlines
const getServiceAccountKey = () => {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!key) {
    console.error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not set in environment variables');
    return null;
  }
  return key.replace(/\\n/g, '\n');
};

const SERVICE_ACCOUNT_PRIVATE_KEY = getServiceAccountKey();
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

// Create JWT client for service account
const getServiceAccountClient = async () => {
  try {
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error('Google service account credentials not properly configured');
    }

    const auth = new JWT({
      email: SERVICE_ACCOUNT_EMAIL,
      key: SERVICE_ACCOUNT_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    
    // Get a new access token
    await auth.authorize();
    return auth;
  } catch (error) {
    console.error('Error creating service account client:', error);
    throw new Error('Failed to authenticate with Google Calendar API');
  }
};

class CalendarService {
  // Create Google Calendar API client
  async getCalendarClient(userId) {
    try {
      // Get user from database
      const user = await User.findById(userId);
      
      if (!user || !user.googleRefreshToken) {
        throw new Error('User not authorized for Google Calendar');
      }
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        refresh_token: user.googleRefreshToken
      });
      
      return google.calendar({ version: 'v3', auth: oauth2Client });
    } catch (error) {
      console.error('Get calendar client error:', error);
      throw error;
    }
  }
  
  // Create a calendar event
  async createEvent(userId, conversationId, eventDetails, guestId = null) {
    try {
      if (!eventDetails.startDateTime || !eventDetails.endDateTime) {
        throw new Error('Missing required date fields');
      }
  
      // Ensure we have Date objects
      const start = eventDetails.startDateTime instanceof Date 
        ? new Date(eventDetails.startDateTime) 
        : new Date(eventDetails.startDateTime);
        
      const end = eventDetails.endDateTime instanceof Date 
        ? new Date(eventDetails.endDateTime) 
        : new Date(eventDetails.endDateTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Invalid date format:', { 
          start: eventDetails.startDateTime, 
          end: eventDetails.endDateTime 
        });
        throw new Error('Invalid date format');
      }
      const {
        title,
        startDateTime,
        endDateTime,
        location,
        description
      } = eventDetails;
      
      // Create event in database
      const eventData = {
        conversationId: conversationId,
        title: eventDetails.title,
        description: eventDetails.description,
        // Store dates in UTC
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        location: eventDetails.location,
        status: 'pending',  // Using 'pending' as it's a valid enum value in the schema
        timeZone: eventDetails.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        timeZoneOffset: eventDetails.timeZoneOffset || new Date().getTimezoneOffset() / -60,
        serviceType: eventDetails.serviceType || 'general',
        // Add timestamps
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('Creating event with data:', JSON.stringify(eventData, null, 2));

      // Add userId or guestId based on authentication
      if (userId) {
        eventData.userId = userId;
      } else if (guestId) {
        eventData.guestId = guestId;
      } else {
        throw new Error('Either userId or guestId is required');
      }

      const calendarEvent = new CalendarEvent(eventData);
      
      // Save to database
      await calendarEvent.save();
      
      // Add event to Google Calendar using service account
      try {
        console.log('Initializing Google Calendar service...');
        const auth = await getServiceAccountClient();
        const calendar = google.calendar({ version: 'v3', auth });
        
        // Get user email if available
        let userEmail = null;
        if (userId) {
          // Handle both MongoDB ObjectIds and WordPress user IDs (strings)
          let user = null;
          try {
            // First try direct MongoDB ID lookup
            user = await User.findById(userId).catch(() => null);
            
            // If not found and userId is a string, try WordPress user ID
            if (!user && typeof userId === 'string') {
              console.log('Trying to find user by WordPress ID:', userId);
              user = await User.findOne({ wpUserId: userId }).catch(() => null);
            }
            
            userEmail = user?.email;
            console.log('User email for calendar invite:', userEmail || 'Not found');
          } catch (userError) {
            console.error('Error finding user for calendar invite:', userError);
          }
        }
        
        // Create event with user as attendee if email is available
        const event = {
          summary: title,
          location: location || 'Auto Service Center',
          description: description + (eventDetails.serviceType ? `\n\nService Type: ${eventDetails.serviceType}` : ''),
          start: {
            dateTime: start.toISOString(),
            timeZone: 'Europe/Bucharest',
          },
          end: {
            dateTime: end.toISOString(),
            timeZone: 'Europe/Bucharest',
          },
          // Add user as attendee if email is available
          attendees: userEmail ? [
            { 
              email: userEmail,
              responseStatus: 'accepted',
              organizer: false,
              self: false
            }
          ] : [],
          // Make sure the event is visible to the user
          visibility: 'public',
          transparency: 'opaque',
          // Use custom reminders
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 },  // 24 hours before
              { method: 'popup', minutes: 30 },       // 30 minutes before
            ],
          },
        };
        
        console.log('Creating Google Calendar event with data:', JSON.stringify({
          calendarId: CALENDAR_ID,
          event: {
            ...event,
            description: event.description.substring(0, 100) + '...' // Truncate for logs
          }
        }, null, 2));
        
        const response = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          sendUpdates: 'all',
          requestBody: event,
        });
        
        console.log('Google Calendar event created successfully:', {
          eventId: response.data.id,
          htmlLink: response.data.htmlLink,
          hangoutLink: response.data.hangoutLink
        });
        
        // Update calendar event with Google event ID
        calendarEvent.googleEventId = response.data.id;
        calendarEvent.googleCalendarLink = response.data.htmlLink;
        await calendarEvent.save();
        
        // If user email is available, add as guest
        if (userEmail) {
          try {
            await calendar.events.patch({
              calendarId: CALENDAR_ID,
              eventId: response.data.id,
              sendUpdates: 'all',
              requestBody: {
                attendees: [
                  { email: userEmail, responseStatus: 'accepted' }
                ]
              }
            });
            console.log('Added user as attendee to the event');
          } catch (guestError) {
            console.error('Error adding user as attendee:', guestError);
          }
        }
        
      } catch (error) {
        console.error('Error creating Google Calendar event:', {
          message: error.message,
          code: error.code,
          errors: error.errors,
          stack: error.stack
        });
        // Don't fail the whole operation if Google Calendar fails
      }
      
      // Send email notification to business
      // Handle WordPress user IDs (strings) vs MongoDB ObjectIds
      let userInfo = null;
      if (userId) {
        try {
          // First try to find by exact ID match (for MongoDB ObjectIds)
          userInfo = await User.findById(userId).catch(() => null);
          
          if (!userInfo) {
            // If not found and userId is a string, try to find by wpUserId field
            if (typeof userId === 'string') {
              userInfo = await User.findOne({ wpUserId: userId }).catch(() => null);
            }
          }
          
          console.log('User info for notification:', userInfo ? 'Found' : 'Not found');
        } catch (userError) {
          console.error('Error finding user for notification:', userError);
        }
      }
      
      await this.sendNotificationEmail(calendarEvent, userInfo);
      
      return calendarEvent;
    } catch (error) {
      console.error('Create event error:', error);
      throw error;
    }
  }
  
  // Send notification email
  async sendNotificationEmail(event, user) {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || !process.env.NOTIFICATION_EMAIL) {
        console.warn('Email configuration is missing. Skipping notification email.');
        return false;
      }
      
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      
      const startDate = event.startDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const startTime = event.startDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Prepare customer info section based on whether user is available
      let customerInfo = '<h3>Guest User</h3>';
      if (user) {
        customerInfo = `
          <h3>Customer Information:</h3>
          <p><strong>Name:</strong> ${user.firstName || 'Not provided'} ${user.lastName || ''}</p>
          <p><strong>Email:</strong> ${user.email || 'Not provided'}</p>
          <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
        `;
      }
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_EMAIL,
        subject: `New Appointment: ${event.title}`,
        html: `
          <h2>New Appointment Request</h2>
          <p><strong>Service:</strong> ${event.title}</p>
          <p><strong>Date:</strong> ${startDate}</p>
          <p><strong>Time:</strong> ${startTime}</p>
          <p><strong>Location:</strong> ${event.location || 'Not specified'}</p>
          <p><strong>Details:</strong> ${event.description || 'No additional details'}</p>
          ${customerInfo}
          <p><strong>Appointment ID:</strong> ${event._id}</p>
        `
      };
      
      await transporter.sendMail(mailOptions);
      
      // Update notification status
      event.notificationSent = true;
      await event.save();
      
      return true;
    } catch (error) {
      console.error('Send notification email error:', error);
      return false;
    }
  }
  
  // Get all events for a user
  async getUserEvents(userId) {
    try {
      return await CalendarEvent.find({ userId }).sort({ startDateTime: 1 });
    } catch (error) {
      console.error('Get user events error:', error);
      throw error;
    }
  }
  
  // Get a specific event
  async getEvent(eventId, userId) {
    try {
      return await CalendarEvent.findOne({ _id: eventId, userId });
    } catch (error) {
      console.error('Get event error:', error);
      throw error;
    }
  }
  
  // Update event status
  async updateEventStatus(eventId, userId, status) {
    try {
      const event = await CalendarEvent.findOne({ _id: eventId, userId });
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      event.status = status;
      await event.save();
      
      return event;
    } catch (error) {
      console.error('Update event status error:', error);
      throw error;
    }
  }
  
  // Delete an event
  async deleteEvent(eventId, userId) {
    try {
      const event = await CalendarEvent.findOne({ _id: eventId, userId });
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // If event is in Google Calendar, delete it there too
      if (event.googleEventId) {
        try {
          const calendar = await this.getCalendarClient(userId);
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: event.googleEventId
          });
        } catch (error) {
          console.error('Google Calendar delete error:', error);
          // Continue even if Google Calendar delete fails
        }
      }
      
      // Delete from database
      await CalendarEvent.deleteOne({ _id: eventId });
      
      return true;
    } catch (error) {
      console.error('Delete event error:', error);
      throw error;
    }
  }
}

module.exports = new CalendarService();
