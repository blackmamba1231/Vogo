// API service for communicating with the backend
import API_CONFIG from '../config/api';
import { getSessionId } from '../utils/storage';

// Base API URL from config
const BASE_URL = API_CONFIG.baseUrl;

// Types
export interface MessageMetadata {
  isAppointmentScheduled?: boolean;
  shouldRedirect?: boolean;
  redirectUrl?: string;
  appointmentDetails?: any;
  [key: string]: any;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'operator';
  content: string;
  timestamp?: Date | string;
  _id?: string;
  metadata?: MessageMetadata;
}

export interface Conversation {
  _id: string;
  conversationId: string;
  sessionId: string;
  messages: Message[];
  language: string;
  intent?: string;
  operatorAssigned?: boolean;
  foodProducts?: Product[];
  // Additional properties for redirects and appointments
  shouldRedirect?: boolean;
  redirectUrl?: string;
  isAppointmentScheduled?: boolean;
  appointmentDetails?: any;
  actions?: Array<{
    type: 'link' | 'button';
    text: string;
    url?: string;
    action?: string;
    style?: 'primary' | 'secondary';
    icon?: string;
  }>;
}

export interface Product {
  id: string | number;
  name: string;
  description: string;
  price: string;
  image: string | null;
  url: string;
  categories: string[];
  // Optional fields that might come from the backend
  _id?: string;
  short_description?: string;
  regular_price?: string;
  images?: Array<{ src: string }> | string[];
  permalink?: string;
}

// API methods
export const chatAPI = {
  // Start a new conversation
  startConversation: async (initialMessage: string, wpUserId?: string | number): Promise<Conversation> => {
    try {
      const sessionId = getSessionId();
      
      const requestBody: { initialMessage: string; sessionId: string; wpUserId?: string | number } = { 
        initialMessage, 
        sessionId 
      };
      
      if (wpUserId) {
        requestBody.wpUserId = wpUserId;
      }
      
      const response = await fetch(`${BASE_URL}${API_CONFIG.endpoints.chat.start}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const responseData = await response.json();
      console.log('Start conversation response:', responseData);
      
      if (responseData.error) {
        throw new Error(responseData.message || 'Unknown error occurred');
      }
      
      // The response might be in data.conversation or just data
      let conversation = responseData.data?.conversation || responseData.data;
      
      // If conversation is a string, parse it
      if (typeof conversation === 'string') {
        try {
          conversation = JSON.parse(conversation);
        } catch (e) {
          console.error('Error parsing conversation:', e);
        }
      }
      
      console.log('Extracted conversation:', {
        id: conversation?._id || conversation?.conversationId,
        messages: conversation?.messages?.length,
        foodProducts: conversation?.foodProducts?.length
      });
      
      // Ensure we have a conversationId
      if (conversation && !conversation.conversationId && conversation._id) {
        conversation.conversationId = conversation._id;
      }
      
      return conversation;
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  },

  // Send a message in an existing conversation
  sendMessage: async (conversationId: string, message: string): Promise<Conversation> => {
    try {
      const sessionId = getSessionId();
      
      const response = await fetch(`${BASE_URL}${API_CONFIG.endpoints.chat.message}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({ 
          conversationId, 
          sessionId,
          message,
          messageType: 'text'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const responseData = await response.json();
      console.log('Send message response:', responseData);
      
      if (responseData.error) {
        throw new Error(responseData.message || 'Unknown error occurred');
      }
      
      // The response might be in data.conversation or just data
      let conversation = responseData.data?.conversation || responseData.data;
      
      // If conversation is a string, parse it
      if (typeof conversation === 'string') {
        try {
          conversation = JSON.parse(conversation);
        } catch (e) {
          console.error('Error parsing conversation:', e);
        }
      }
      
      console.log('Extracted conversation:', {
        id: conversation?._id || conversation?.conversationId,
        messages: conversation?.messages?.length,
        foodProducts: conversation?.foodProducts?.length
      });
      
      // Ensure we have a conversationId
      if (conversation && !conversation.conversationId && conversation._id) {
        conversation.conversationId = conversation._id;
      }
      
      return conversation;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Get conversation history
  getConversation: async (conversationId: string): Promise<Conversation> => {
    try {
      const sessionId = getSessionId();
      
      const response = await fetch(`${BASE_URL}${API_CONFIG.endpoints.chat.conversation}/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get conversation');
      }

      const responseData = await response.json();
      console.log('Get conversation response:', responseData);
      
      if (responseData.error) {
        throw new Error(responseData.message || 'Unknown error occurred');
      }
      
      // The response might be in data.conversation or just data
      let conversation = responseData.data?.conversation || responseData.data;
      
      // If conversation is a string, parse it
      if (typeof conversation === 'string') {
        try {
          conversation = JSON.parse(conversation);
        } catch (e) {
          console.error('Error parsing conversation:', e);
        }
      }
      
      console.log('Extracted conversation:', {
        id: conversation?._id || conversation?.conversationId,
        messages: conversation?.messages?.length,
        foodProducts: conversation?.foodProducts?.length
      });
      
      // Ensure we have a conversationId
      if (conversation && !conversation.conversationId && conversation._id) {
        conversation.conversationId = conversation._id;
      }
      
      return conversation;
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  },

  // Get products from WooCommerce
  searchProducts: async (query: string, category: string = ''): Promise<Product[]> => {
    try {
      const sessionId = getSessionId();
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      if (category) params.append('category', category);
      
      const response = await fetch(`${BASE_URL}${API_CONFIG.endpoints.woocommerce.products}?${params.toString()}`, {
        headers: {
          'X-Session-ID': sessionId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search products');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Unknown error occurred');
      }
      
      return data.data.products;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  },

  // Request human operator assistance
  requestOperator: async (conversationId: string, reason: string = ''): Promise<Conversation> => {
    try {
      const sessionId = getSessionId();
      
      const response = await fetch(`${BASE_URL}${API_CONFIG.endpoints.operator.request}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({ 
          conversationId, 
          sessionId,
          reason
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request operator');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Unknown error occurred');
      }
      
      return data.data;
    } catch (error) {
      console.error('Error requesting operator:', error);
      throw error;
    }
  },
  
  // Schedule a calendar appointment
  scheduleAppointment: async (conversationId: string, date: string, time: string, reason: string): Promise<any> => {
    try {
      const sessionId = getSessionId();
      
      const response = await fetch(`${BASE_URL}${API_CONFIG.endpoints.calendar.schedule}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({ 
          conversationId, 
          sessionId,
          date,
          time,
          reason
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule appointment');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Unknown error occurred');
      }
      
      return data.data;
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      throw error;
    }
  }
};

export default chatAPI;
