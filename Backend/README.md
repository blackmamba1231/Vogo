# Vogo-Family Backend

Backend server for the Vogo-Family AI-powered chatbot system with multilingual support, service booking capabilities, and human handover functionality.

## Architecture

### Tech Stack
- **Server**: Node.js with Express.js
- **Database**: MongoDB for storing conversation history and user data
- **Authentication**: JWT for secure session handling
- **Caching**: Redis for fast data access
- **NLP**: OpenAI's GPT models for natural language processing
- **Scheduling**: Node-cron for background tasks
- **Data Sync**: Axios for API communication
- **Integrations**: 
  - WooCommerce API for product/service data
  - Google Calendar for scheduling
  - External ticketing systems for human handover

### Directory Structure
```
Backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # API controllers
│   ├── middleware/       # Custom middleware
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── utils/            # Utilities and helpers
│   └── server.js         # Main server file
├── logs/                 # Application logs
├── tests/                # Test files
├── .env.example          # Environment variables template
├── package.json          # Dependencies
└── README.md             # Documentation
```

## Features

- **AI-Powered Chatbot**: Natural language processing with OpenAI
- **Multilingual Support**: English, French, and Romanian
- **Conversation Management**: Storing and retrieving chat history
- **Authentication**: User registration and JWT authentication
- **Calendar Integration**: Schedule appointments with Google Calendar
- **WooCommerce Integration**: Search and interact with products/services
- **Human Handover**: Transfer complex queries to human operators
- **Ticketing System**: Integration with external ticketing systems
- **Voice & Text Support**: Multiple input methods
- **Caching**: Redis for performance optimization
- **Scheduled Tasks**: Background processing with cron jobs

## Main Workflows

1. **Service Booking**:
   - User asks about service in their location
   - Chatbot asks for issue details
   - Chatbot suggests nearby services
   - User requests scheduling
   - Chatbot adds event to calendar and notifies service provider

2. **Restaurant Search & Food Ordering**:
   - User asks about restaurants in their location
   - Chatbot suggests restaurants and menus
   - User selects items for order
   - Chatbot processes order through WooCommerce

3. **Human Handover**:
   - Complex queries are identified
   - Conversation transferred to human operator
   - Ticket created in external system
   - Operator continues conversation through ticket interface

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB
- Redis
- OpenAI API key
- WooCommerce store with API access
- Google OAuth credentials (for Calendar integration)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and configure with your credentials
4. Start the server:
   ```
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Environment Variables

Key environment variables to configure:
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT signing
- `OPENAI_API_KEY`: OpenAI API key
- `REDIS_HOST` & `REDIS_PORT`: Redis connection details
- `WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`: WooCommerce API credentials
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `EMAIL_*`: Email notification settings
- `TICKETING_API_*`: Ticketing system integration details

## API Endpoints

### Authentication
- `POST /api/auth/register`: Register new user
- `POST /api/auth/login`: User login
- `GET /api/auth/me`: Get current user
- `POST /api/auth/logout`: User logout

### Chat
- `POST /api/chat/start`: Start a new conversation
- `POST /api/chat/message`: Send a message
- `GET /api/chat/:conversationId`: Get conversation history
- `GET /api/chat`: Get all conversations for user

### Calendar
- `GET /api/calendar`: Get all calendar events
- `GET /api/calendar/:eventId`: Get specific event
- `POST /api/calendar`: Create a new event
- `PATCH /api/calendar/:eventId/status`: Update event status
- `DELETE /api/calendar/:eventId`: Delete an event

### WooCommerce
- `GET /api/woocommerce/restaurants`: Search restaurants
- `GET /api/woocommerce/services`: Search services
- `GET /api/woocommerce/products/:productId`: Get product details
- `GET /api/woocommerce/products`: Search products
- `POST /api/woocommerce/cart/add`: Add item to cart
- `GET /api/woocommerce/cart`: Get cart contents

### Tickets
- `GET /api/tickets/:ticketId/status`: Get ticket status
- `POST /api/tickets/handover`: Request human operator
- `GET /api/tickets/assigned`: Get assigned tickets (operators)
- `POST /api/tickets/:ticketId/reply`: Send operator reply
- `POST /api/tickets/:ticketId/close`: Close ticket

## Testing

Run tests with:
```
npm test
```

## License

[License information]
