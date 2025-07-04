require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

// Import config
const connectDB = require('./config/database');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const calendarRoutes = require('./routes/calendar.routes');
const wooCommerceRoutes = require('./routes/woocommerce.routes');
const ticketRoutes = require('./routes/ticket.routes');
const adminRoutes = require('./routes/admin.routes');

// Import cron jobs
const { initCronJobs } = require('./utils/cronJobs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'https://vogo-five.vercel.app', 'https://vogo-vwtu.vercel.app', 'https://vogo-chatbot.vogo.family'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev', { stream: logger.stream }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Connect to MongoDB
connectDB();



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/woocommerce', wooCommerceRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: true,
    message: err.message || 'Internal Server Error',
  });
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  
  // Initialize cron jobs
  initCronJobs();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err.name, err.message);
  
  // Close server & exit process
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

module.exports = app;
