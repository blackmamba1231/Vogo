const axios = require('axios');
const User = require('../models/user.model');
const Conversation = require('../models/conversation.model');

class TicketService {
  constructor() {
    this.apiUrl = process.env.TICKETING_API_URL;
    this.apiKey = process.env.TICKETING_API_KEY;
  }
  
  // Create API client with authentication
  getApiClient() {
    return axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  // Create a new ticket in the ticketing system
  async createTicket(ticketDataOrUserId, conversationIdParam, messagesParam) {
    try {
      let ticketData;

      // Check if we're receiving a direct ticket data object or the old parameters
      if (typeof ticketDataOrUserId === 'object' && ticketDataOrUserId !== null) {
        // We're receiving a direct ticket data object
        ticketData = ticketDataOrUserId;
        
        // Make sure we have the conversationId in the ticket data
        if (ticketData.conversationId) {
          // Get conversation for additional data if needed
          const conversation = await Conversation.findById(ticketData.conversationId);
          
          if (!conversation) {
            console.log(`Conversation not found for ID: ${ticketData.conversationId}`);
          } else if (!ticketData.priority) {
            // Use conversation to determine priority if not already set
            ticketData.priority = this.determinePriority(conversation);
          }
        }
      } else {
        // We're using the old parameter style (userId, conversationId, messages)
        const userId = ticketDataOrUserId;
        const conversationId = conversationIdParam;
        const messages = messagesParam;
        
        // Get user details
        const user = await User.findById(userId);
        if (!user) {
          throw new Error('User not found');
        }
        
        // Get conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        
        // Format messages for the ticket system
        const formattedMessages = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));
        
        // Create ticket payload
        ticketData = {
          subject: `Chat Support Request - ${user.email}`,
          requester: {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phone || ''
          },
          conversation_history: formattedMessages,
          metadata: {
            conversationId: conversationId.toString(),
            language: conversation.language,
            intent: conversation.intent,
            location: conversation.location || ''
          },
          priority: this.determinePriority(conversation),
          source: 'chatbot'
        };
      }
      
      // Make API request to ticketing system
      const api = this.getApiClient();
      const response = await api.post('/tickets', ticketData);
      
      // Return ticket ID
      return response.data.id;
    } catch (error) {
      console.error('Create ticket error:', error);
      
      // Fallback - generate a local ticket ID if external system fails
      const fallbackId = `FB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Log the error with fallback ID for later syncing
      console.log(`Created fallback ticket ID: ${fallbackId} for later sync`);
      
      return fallbackId;
    }
  }
  
  // Send a message to an existing ticket
  async sendMessageToTicket(ticketId, message, userId) {
    try {
      // Check if ticket ID is valid
      if (!ticketId) {
        console.warn('Cannot send message: No ticket ID provided');
        return false;
      }
      
      // Skip external API if it's a fallback ticket ID
      if (typeof ticketId === 'string' && ticketId.startsWith('FB-')) {
        console.log(`Message queued for fallback ticket ${ticketId}`);
        return true;
      }
      
      // Get user details
      const user = await User.findById(userId);
      
      // Create message payload
      const messageData = {
        ticket_id: ticketId,
        content: message,
        sender: {
          name: user ? `${user.firstName} ${user.lastName}` : 'User',
          email: user ? user.email : 'unknown',
          type: 'customer'
        }
      };
      
      // Make API request to ticketing system
      const api = this.getApiClient();
      await api.post(`/tickets/${ticketId}/messages`, messageData);
      
      return true;
    } catch (error) {
      console.error('Send message to ticket error:', error);
      return false;
    }
  }
  
  // Get ticket status
  async getTicketStatus(ticketId) {
    try {
      // Skip external API if it's a fallback ticket ID
      if (ticketId.startsWith('FB-')) {
        return { status: 'pending' };
      }
      
      // Make API request to ticketing system
      const api = this.getApiClient();
      const response = await api.get(`/tickets/${ticketId}`);
      
      return {
        status: response.data.status,
        assignee: response.data.assignee,
        updated_at: response.data.updated_at
      };
    } catch (error) {
      console.error('Get ticket status error:', error);
      return { status: 'unknown' };
    }
  }
  
  // Determine ticket priority based on conversation
  determinePriority(conversation) {
    // Check for urgent keywords in messages
    const urgentKeywords = ['urgent', 'emergency', 'immediately', 'asap', 'critical'];
    
    const hasUrgentKeywords = conversation.messages.some(msg => {
      if (msg.role !== 'user') return false;
      const content = msg.content.toLowerCase();
      return urgentKeywords.some(keyword => content.includes(keyword));
    });
    
    if (hasUrgentKeywords) return 'high';
    
    // Check conversation intent
    if (conversation.intent === 'service_booking') return 'medium';
    
    return 'normal';
  }
  
  // Sync pending tickets (for cron job)
  async syncPendingTickets() {
    try {
      // Find conversations with fallback ticket IDs
      const pendingConversations = await Conversation.find({
        ticketId: { $regex: '^FB-' },
        operatorAssigned: true
      });
      
      let syncCount = 0;
      
      for (const conversation of pendingConversations) {
        try {
          // Create a real ticket
          const userId = conversation.userId;
          const ticketId = await this.createTicket(
            userId,
            conversation._id,
            conversation.messages
          );
          
          // If a real ticket was created (non-fallback ID)
          if (!ticketId.startsWith('FB-')) {
            // Update conversation with real ticket ID
            conversation.ticketId = ticketId;
            await conversation.save();
            syncCount++;
          }
        } catch (error) {
          console.error(`Failed to sync ticket for conversation ${conversation._id}:`, error);
        }
      }
      
      return { syncCount };
    } catch (error) {
      console.error('Sync pending tickets error:', error);
      return { syncCount: 0, error: error.message };
    }
  }
}

module.exports = new TicketService();
