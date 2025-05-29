const { createClient } = require('redis');
const logger = require('../utils/logger');

// Create a singleton Redis client
let redisClient = null;

// Redis client configuration
const redisOptions = {
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1', // Using IP instead of hostname
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    connectTimeout: 15000, // 15 seconds timeout
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Too many Redis reconnection attempts');
        return new Error('Too many Redis reconnection attempts');
      }
      return Math.min(retries * 500, 5000); // Exponential backoff
    }
  },
  password: process.env.REDIS_PASSWORD || undefined
};

// Get Redis client (creates one if it doesn't exist)
const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = createClient(redisOptions);
    
    // Set up event handlers
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
    
    redisClient.on('connect', () => {
      logger.info(`Redis Connected: ${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`);
    });
    
    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
    
    // Connect to Redis
    try {
      await redisClient.connect();
    } catch (error) {
      logger.error(`Redis connection error: ${error.message}`);
      // We'll return the client anyway, and let the reconnection strategy handle reconnection
    }
  }
  
  return redisClient;
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
});

module.exports = getRedisClient;
