const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const logger = require('../utils/logger');

// Use the global Redis client that's initialized in server.js
const getRedisClient = () => {
  if (!global.redisClient) {
    logger.warn('Global Redis client not available in auth middleware');
    return null;
  }
  return global.redisClient;
};

const authMiddleware = async (req, res, next) => {
  try{
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: true,
        message: 'Invalid or expired token'
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error'
    });
  }
};

// Role-based access control middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: true,
        message: 'Access denied: insufficient permissions'
      });
    }
    next();
  };
};

module.exports = { authMiddleware, authorizeRoles };
