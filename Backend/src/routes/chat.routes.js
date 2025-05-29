const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Apply auth middleware to all chat routes
router.use(authMiddleware);

// Chat routes
router.post('/start', chatController.startConversation);
router.post('/message', chatController.sendMessage);
router.get('/:conversationId', chatController.getConversation);
router.get('/', chatController.getConversations);

module.exports = router;
