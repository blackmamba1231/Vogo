const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'vogo-backend' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
  ],
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Create a stream object for Morgan middleware
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
