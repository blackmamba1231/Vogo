// API Configuration

// You can override this with environment variables in production
const API_CONFIG = {
  // Base API URL - replace with your production URL when deploying
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  
  // API endpoints
  endpoints: {
    // Chat endpoints
    chat: {
      start: '/chat/start',
      message: '/chat/message',
      conversation: '/chat',
    },
    
    // WooCommerce endpoints
    woocommerce: {
      products: '/woocommerce/products',
      categories: '/woocommerce/categories',
    },
    
    // Calendar endpoints
    calendar: {
      events: '/calendar/events',
      schedule: '/calendar/schedule',
    },
    
    // Operator endpoints
    operator: {
      request: '/chat/operator'
    }
  },
  
  // Request timeouts in milliseconds
  timeouts: {
    default: 30000, // 30 seconds
    chat: 60000,    // 60 seconds for chat requests (as they might take longer)
  }
};

export default API_CONFIG;
