const express = require('express');
const router = express.Router();
const { authMiddleware, authorizeRoles } = require('../middleware/auth.middleware');
const ticketService = require('../services/ticket.service');
const Conversation = require('../models/conversation.model');

// Apply auth middleware to all ticket routes
router.use(authMiddleware);

// Get ticket status
router.get('/:ticketId/status', async (req, res) => {
  try {
    const ticketStatus = await ticketService.getTicketStatus(req.params.ticketId);
    
    res.status(200).json({
      error: false,
      data: ticketStatus
    });
  } catch (error) {
    console.error('Get ticket status error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting ticket status'
    });
  }
});

// Request human operator handover
router.post('/handover', async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;
    
    if (!conversationId) {
      return res.status(400).json({
        error: true,
        message: 'Conversation ID is required'
      });
    }
    
    // Get conversation
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    
    if (!conversation) {
      return res.status(404).json({
        error: true,
        message: 'Conversation not found'
      });
    }
    
    // If already assigned to operator
    if (conversation.operatorAssigned) {
      return res.status(200).json({
        error: false,
        message: 'Conversation already assigned to a human operator',
        data: {
          ticketId: conversation.ticketId
        }
      });
    }
    
    // Create ticket
    const ticketId = await ticketService.createTicket(
      userId,
      conversation._id,
      conversation.messages
    );
    
    // Update conversation
    conversation.operatorAssigned = true;
    conversation.ticketId = ticketId;
    
    // Add system message
    const handoverMessage = {
      role: 'system',
      content: 'Your conversation has been transferred to a human operator. Please wait for their response.'
    };
    
    conversation.messages.push(handoverMessage);
    await conversation.save();
    
    res.status(200).json({
      error: false,
      message: 'Conversation successfully handed over to a human operator',
      data: {
        ticketId
      }
    });
  } catch (error) {
    console.error('Handover error:', error);
    res.status(500).json({
      error: true,
      message: 'Error handing over conversation'
    });
  }
});

// Admin/operator routes

// Get all assigned tickets (for operators)
router.get('/assigned', authorizeRoles('admin', 'operator'), async (req, res) => {
  try {
    // Find conversations assigned to this operator
    const operatorId = req.user.id;
    
    const assignedConversations = await Conversation.find({
      operatorId,
      operatorAssigned: true
    }).sort({ lastMessageAt: -1 });
    
    res.status(200).json({
      error: false,
      data: {
        assignedConversations
      }
    });
  } catch (error) {
    console.error('Get assigned tickets error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting assigned tickets'
    });
  }
});

// Send operator reply to conversation
router.post('/:ticketId/reply', authorizeRoles('admin', 'operator'), async (req, res) => {
  try {
    const { message } = req.body;
    const operatorId = req.user.id;
    const ticketId = req.params.ticketId;
    
    // Find the conversation with this ticket ID
    const conversation = await Conversation.findOne({ ticketId });
    
    if (!conversation) {
      return res.status(404).json({
        error: true,
        message: 'Conversation not found for this ticket'
      });
    }
    
    // Add operator message to conversation
    conversation.messages.push({
      role: 'operator',
      content: message,
      timestamp: new Date()
    });
    
    // Update conversation
    conversation.lastMessageAt = new Date();
    if (!conversation.operatorId) {
      conversation.operatorId = operatorId;
    }
    
    await conversation.save();
    
    // Send message to external ticketing system if needed
    if (!ticketId.startsWith('FB-')) {
      await ticketService.sendMessageToTicket(
        ticketId,
        message,
        operatorId
      );
    }
    
    res.status(200).json({
      error: false,
      message: 'Reply sent successfully',
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('Send operator reply error:', error);
    res.status(500).json({
      error: true,
      message: 'Error sending reply'
    });
  }
});

// Close ticket and end conversation
router.post('/:ticketId/close', authorizeRoles('admin', 'operator'), async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    
    // Find the conversation with this ticket ID
    const conversation = await Conversation.findOne({ ticketId });
    
    if (!conversation) {
      return res.status(404).json({
        error: true,
        message: 'Conversation not found for this ticket'
      });
    }
    
    // Close conversation
    conversation.isActive = false;
    
    // Add closing message
    conversation.messages.push({
      role: 'system',
      content: 'This conversation has been closed by the operator.',
      timestamp: new Date()
    });
    
    await conversation.save();
    
    res.status(200).json({
      error: false,
      message: 'Ticket closed successfully'
    });
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({
      error: true,
      message: 'Error closing ticket'
    });
  }
});

module.exports = router;
