'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WhisperRecorder } from '../../utils/whisper';

// Extend the Window interface to include webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }

  interface SpeechRecognitionEvent extends Event {
    results: {
      isFinal: boolean;
      [key: number]: {
        transcript: string;
      };
    }[];
    resultIndex: number;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    // Note: state is not part of the standard Web Speech API
    // but some implementations might have it
    state?: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: Event) => void;
    onend: () => void;
    onaudiostart: () => void;
    onsoundstart: () => void;
    onspeechstart: () => void;
    onspeechend: () => void;
    onsoundend: () => void;
    onaudioend: () => void;
    onnomatch: () => void;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }
}
import styles from './FloatingWidget.module.css';
import chatAPI, { Message, Conversation, Product, MessageMetadata } from '../../services/api';

interface ActionButton {
  type: 'link' | 'button';
  text: string;
  url?: string;
  action?: string;
  style?: 'primary' | 'secondary';
  icon?: string;
}

interface MessageWithMetadata extends Message {
  metadata?: {
    actions?: ActionButton[];
    shouldRedirect?: boolean;
    redirectUrl?: string;
    appointmentDetails?: {
      formattedDate: string;
      formattedTime: string;
      serviceType: string;
      [key: string]: any;
    };
    products?: Product[];
    [key: string]: any;
  };
}
import ProductCard from '../ProductCard';
import { getFromStorage, saveToStorage, removeFromStorage, getSessionId } from '../../utils/storage';

const FloatingWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const whisperRecorder = useMemo(() => {
    return new WhisperRecorder({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
      model: 'whisper-1',
      language: 'en'
    });
  }, []);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageWithMetadata[]>([]);
  const safeMessages = messages || []; // Ensure messages is always an array
  const [products, setProducts] = useState<Product[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [calendarData, setCalendarData] = useState<{
    date?: string;
    time?: string;
    reason?: string;
  }>({});

  // Handle auto-redirect when shouldRedirect is true
  useEffect(() => {
    const lastMessage = messages[messages.length - 1] as MessageWithMetadata | undefined;
    console.log('Last message:', lastMessage);
    
    const metadata = lastMessage?.metadata;
    console.log('Message metadata:', metadata);
    
    const redirectUrl = metadata?.redirectUrl;
    const shouldRedirect = metadata?.shouldRedirect;
    
    console.log('Redirect check:', { shouldRedirect, redirectUrl });
    
    if (shouldRedirect && redirectUrl) {
      console.log('Attempting to redirect to:', redirectUrl);
      
      // First, try to notify the parent window if we're in an iframe
      try {
        if (window.parent && window.parent !== window) {
          console.log('Widget is in iframe, sending message to parent');
          window.parent.postMessage({
            type: 'VOGO_WIDGET_REDIRECT',
            url: redirectUrl
          }, '*');
        }
      } catch (e) {
        console.error('Error sending postMessage to parent:', e);
      }
      
      // Add a small delay to allow the UI to update
      const timer = setTimeout(() => {
        console.log('Opening URL in new tab:', redirectUrl);
        
        // Try to directly change location if we're in the top window
        if (window === window.top) {
          try {
            console.log('Widget is in top window, redirecting directly');
            window.location.href = redirectUrl;
            return;
          } catch (e) {
            console.error('Error redirecting directly:', e);
          }
        }
        
        // If direct redirect didn't work, try to open in a new tab
        try {
          const newWindow = window.open(redirectUrl, '_blank', 'noopener,noreferrer');
          
          // If popup was blocked, update the message with clickable link
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            console.log('Popup was blocked, updating message with clickable link');
            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages];
              const lastIndex = updatedMessages.length - 1;
              if (lastIndex >= 0) {
                updatedMessages[lastIndex] = {
                  ...updatedMessages[lastIndex],
                  content: `Your appointment was scheduled! <a href="${redirectUrl}" target="_blank" rel="noopener noreferrer" style="color: #0070f3; text-decoration: underline; font-weight: bold;">Click here to view in Google Calendar</a>`,
                  metadata: {
                    ...(updatedMessages[lastIndex].metadata || {}),
                    shouldRedirect: false, // Prevent infinite redirect attempts
                    redirectUrl: undefined
                  }
                };
              }
              return updatedMessages;
            });
          }
        } catch (e) {
          console.error('Error opening new tab:', e);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // Handle action button clicks
  const handleActionClick = (action: string, metadata?: MessageWithMetadata['metadata']) => {
    if (!metadata) return;
    
    switch (action) {
      case 'retry_scheduling':
        // Handle retry scheduling
        window.location.reload();
        break;
      case 'contact_support':
        // Handle contact support
        window.open('mailto:support@vogo.com', '_blank');
        break;
      case 'send_details':
        // Handle sending details
        if (metadata?.appointmentDetails) {
          const { formattedDate, formattedTime, serviceType } = metadata.appointmentDetails;
          const subject = `Appointment Details: ${serviceType} on ${formattedDate} at ${formattedTime}`;
          const body = `Here are your appointment details:\n\n` +
            `Service: ${serviceType}\n` +
            `Date: ${formattedDate}\n` +
            `Time: ${formattedTime}\n` +
            `Location: Vogo Service Center\n\n` +
            `Please arrive 10 minutes before your scheduled time.`;
          
          window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        }
        break;
      default:
        console.log('Unknown action:', action);
    }
  };
  
  // Cleanup function for component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Load conversation from storage on component mount
  useEffect(() => {
    const savedConversationId = getFromStorage('conversationId');
    if (savedConversationId) {
      fetchConversation(savedConversationId);
    }
    
    // Initialize messages as empty array if not already set
    setMessages(prev => Array.isArray(prev) ? prev : []);
    
    // Scroll to bottom on initial load
    scrollToBottom();
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    // Use setTimeout to ensure the DOM has been updated
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  // Fetch conversation history
  const fetchConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      const data = await chatAPI.getConversation(conversationId);
      
      // Log the raw data for debugging
      console.log('Raw conversation data:', JSON.stringify(data, null, 2));
      
      setConversation(data);
      
      // Ensure messages is always an array
      const messages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(messages);
      
      // Log the conversation data for debugging
      console.log('Fetched conversation data:', { 
        id: data._id || data.conversationId,
        messages: messages.length,
        foodProducts: data.foodProducts?.length || 0,
        hasFoodProducts: !!data.foodProducts,
        dataKeys: Object.keys(data)
      });
      
      // Set products if available in the conversation
      if (data.foodProducts && Array.isArray(data.foodProducts) && data.foodProducts.length > 0) {
        console.log('Setting products from fetched conversation:', data.foodProducts);
        setProducts(data.foodProducts);
      } else {
        console.log('No food products found in fetched conversation');
        setProducts([]); // Clear products if none found
      }
    } catch (err) {
      console.error('Error fetching conversation:', err);
      setError('Failed to load conversation history');
      // Clear storage if conversation not found
      removeFromStorage('conversationId');
    } finally {
      setLoading(false);
    }
  };
   interface WordPressUser {
    logged_in: boolean;
    ID?: string | number;
    // Add other WordPress user properties as needed
    [key: string]: any;
  }

  const [wpUser, setWpUser] = useState<WordPressUser | null>(null);

  useEffect(() => {
    fetch("https://vogo.family/wp-json/chatbot/v1/user", {
      credentials: "include"// this includes WordPress login cookies
    })
      .then(res => res.json())
      .then(data => {
        console.log("Auth check response:", data);
        if (data.logged_in) {
          console.log("Logged in user:", data);
          setWpUser(data);
          // Pass the user ID to the chat component if needed
        } else {
          console.log("User not logged in");
          setWpUser(null);
        }
      })
      .catch(err => {
        console.error("Auth check failed", err);
        setWpUser(null);
      });
  }, []);
  // Process conversation data when it changes
  useEffect(() => {
    if (conversation) {
      // Check if the last message has a redirect URL
      const lastMessage = conversation.messages?.[conversation.messages.length - 1];
      const metadata = lastMessage?.metadata;
      
      if (metadata?.shouldRedirect && metadata.redirectUrl) {
        console.log('Redirecting to:', metadata.redirectUrl);
        // Open the calendar URL in a new tab
        window.open(metadata.redirectUrl, '_blank', 'noopener,noreferrer');
      }
      
      // Process and update products if available
      if (conversation.foodProducts && Array.isArray(conversation.foodProducts)) {
        console.log('Found food products in conversation:', conversation.foodProducts);
        
        const processedProducts = conversation.foodProducts.map((product: any) => {
          try {
            console.log('Processing product:', product);
            
            // Handle ID - check all possible ID fields
            const productId = (
              product.id || 
              product._id || 
              product.productId || 
              Math.random().toString(36).substr(2, 9)
            ).toString();
            
            // Handle name
            const productName = product.name || 'Unnamed Product';
            
            // Handle description - check all possible description fields
            const description = (
              product.description || 
              product.shortDescription || 
              product.short_description || 
              ''
            );
            
            // Handle prices - check all possible price fields
            const salePrice = product.salePrice || product.sale_price || '';
            const regularPrice = (
              product.regularPrice || 
              product.regular_price || 
              product.price || 
              '0'
            );
            const displayPrice = salePrice || regularPrice;
            
            // Handle images - check all possible image fields
            let imageSrc = '';
            const images: string[] = [];
            
            // Check for direct image string
            if (typeof product.image === 'string' && product.image.trim() !== '') {
              imageSrc = product.image;
              images.push(imageSrc);
            } 
            // Check for images array
            else if (Array.isArray(product.images) && product.images.length > 0) {
              // Handle both string and object image formats
              product.images.forEach((img: any) => {
                if (typeof img === 'string' && img.trim() !== '') {
                  images.push(img);
                } else if (img && (img.src || img.url)) {
                  const imgUrl = (img.src || img.url).toString().trim();
                  if (imgUrl) {
                    images.push(imgUrl);
                  }
                }
              });
              
              // Set the first image as the main image if we have any
              if (images.length > 0) {
                imageSrc = images[0];
              }
            }
            
            // Handle categories - extract names from category objects if needed
            const categories: string[] = [];
            if (Array.isArray(product.categories)) {
              product.categories.forEach((cat: any) => {
                if (typeof cat === 'string' && cat.trim() !== '') {
                  categories.push(cat);
                } else if (cat && (cat.name || cat.title)) {
                  const catName = (cat.name || cat.title).trim();
                  if (catName) categories.push(catName);
                }
              });
            }
            
            // Handle URL - check all possible URL fields
            const url = (
              product.url || 
              product.permalink || 
              (productId ? `#${productId}` : '#')
            );
            
            // Build the final product object with proper typing
            const processedProduct: Product & { 
              _id: string; 
              _original: any;
              _error?: string;
            } = {
              id: productId,
              _id: productId, // For backward compatibility
              name: productName,
              description: description,
              price: displayPrice.toString(),
              regular_price: regularPrice.toString(),
              image: imageSrc,
              images: images,
              url: url,
              categories: categories,
              // Include all original product data for debugging
              _original: product
            };
            
            console.log('Processed product:', processedProduct);
            return processedProduct;
            
          } catch (error) {
            console.error('Error processing product:', error, 'Product data:', product);
            // Return a minimal valid product object even if there was an error
            const errorProductId = Math.random().toString(36).substr(2, 9);
            return {
              id: errorProductId,
              _id: errorProductId,
              name: 'Error loading product',
              description: '',
              price: '0',
              regular_price: '0',
              image: '',
              images: [],
              url: '#',
              categories: [],
              // Ensure all required fields from Product interface are present
              _error: 'Error processing product',
              _original: product,
              // Add any additional required fields from the Product interface
              short_description: '',
              permalink: '#'
            };
          }
        });
        
        console.log('Processed products:', processedProducts);
        
        // Attach products to the last assistant message
        const messages = conversation.messages || [];
        let updatedMessages = [...messages];
        
        // Find the last assistant message
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          if (updatedMessages[i].role === 'assistant') {
            // Attach products to this message's metadata
            updatedMessages[i] = {
              ...updatedMessages[i],
              metadata: {
                ...(updatedMessages[i].metadata || {}),
                products: processedProducts
              }
            };
            break;
          }
        }
        
        // Update messages with products attached to the relevant message
        setMessages(updatedMessages);
        // Keep the products state for backward compatibility
        setProducts(processedProducts);
      } else {
        console.log('No products found in conversation');
        setProducts([]);
        // Still need to update messages
        setMessages(conversation.messages || []);
      }
      
      // Check if an operator has been assigned
      if (conversation.operatorAssigned) {
        // When operator is assigned, we might want to show a different UI state
        console.log('Human operator has been assigned to this conversation');
      }
    }
  }, [conversation]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    };
    
    // Add user message to the conversation immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    
    try {
      setLoading(true);
      setError(null);
      
      let response: Conversation;
      
      if (!conversation) {
        // Start a new conversation

        console.log('Starting new conversation with message:', inputValue);
        // Pass the WordPress user ID if available
        const userId = wpUser?.user_id;
        console.log('User ID:', userId);
        
        response = await chatAPI.startConversation(inputValue, userId);
        console.log('New conversation started:', {
          id: response._id || response.conversationId,
          messages: response.messages?.length,
          foodProducts: response.foodProducts?.length
        });
        
        if (response.conversationId || response._id) {
          const conversationId = response.conversationId || response._id;
          saveToStorage('conversationId', conversationId);
        }
      } else {
        // Continue existing conversation
        const conversationId = conversation.conversationId || conversation._id;
        console.log('Sending message to conversation:', conversationId);
        response = await chatAPI.sendMessage(conversationId, inputValue);
        console.log('Message sent, response:', {
          id: response._id || response.conversationId,
          messages: response.messages?.length,
          foodProducts: response.foodProducts?.length,
          hasFoodProducts: !!response.foodProducts,
          responseKeys: Object.keys(response)
        });
      }
      
      // Update conversation state with the latest response
      setConversation(response);
      
      // Ensure we have the latest messages
      let latestMessages = Array.isArray(response.messages) ? [...response.messages] : [];
      console.log('Processing latest messages:', latestMessages);
      
      // Log the message state before we make any changes
      console.log('Messages before processing metadata:', JSON.stringify(latestMessages, null, 2));

      // Check for redirect in the response itself (not just in messages)
      // Also check for metadata in the last message from the response
      const lastResponseMessage = latestMessages.length > 0 ? latestMessages[latestMessages.length - 1] : null;
      
      // Log all potential sources of redirect information
      console.log('Response object redirect info:', {
        shouldRedirect: response.shouldRedirect,
        redirectUrl: response.redirectUrl
      });
      
      if (lastResponseMessage?.metadata) {
        console.log('Last message metadata:', lastResponseMessage.metadata);
      }
      
      // Check if the last message has metadata with appointment details
      if (lastResponseMessage?.metadata?.appointmentDetails?.googleCalendarLink) {
        const calendarLink = lastResponseMessage.metadata.appointmentDetails.googleCalendarLink;
        console.log('Found calendar link in appointment details:', calendarLink);
        
        // Add redirect info to the message metadata
        latestMessages[latestMessages.length - 1] = {
          ...latestMessages[latestMessages.length - 1],
          content: `${latestMessages[latestMessages.length - 1].content} <div style="margin-top: 10px;"><a href="${calendarLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 8px 16px; background-color: #4285F4; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">📅 View in Calendar</a></div>`,
          metadata: {
            ...(latestMessages[latestMessages.length - 1]?.metadata || {}),
            shouldRedirect: true,
            redirectUrl: calendarLink
          }
        };
        console.log('Updated last message with calendar link and button');
      }
      // Check for redirect in the response itself
      else if (response.shouldRedirect && response.redirectUrl) {
        console.log('Found redirect in response object:', response.redirectUrl);
        if (latestMessages.length > 0) {
          latestMessages[latestMessages.length - 1] = {
            ...latestMessages[latestMessages.length - 1],
            content: `${latestMessages[latestMessages.length - 1].content} <div style="margin-top: 10px;"><a href="${response.redirectUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 8px 16px; background-color: #4285F4; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">📅 View in Calendar</a></div>`,
            metadata: {
              ...(latestMessages[latestMessages.length - 1]?.metadata || {}),
              shouldRedirect: true,
              redirectUrl: response.redirectUrl
            }
          };
          console.log('Updated last message with redirect button');
        }
      }
      // Check if metadata exists in the last message
      else if (lastResponseMessage?.metadata?.shouldRedirect && lastResponseMessage?.metadata?.redirectUrl) {
        console.log('Found redirect in message metadata:', lastResponseMessage.metadata.redirectUrl);
        // Add a button to the message content
        latestMessages[latestMessages.length - 1] = {
          ...latestMessages[latestMessages.length - 1],
          content: `${latestMessages[latestMessages.length - 1].content} <div style="margin-top: 10px;"><a href="${lastResponseMessage.metadata.redirectUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 8px 16px; background-color: #4285F4; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">📅 View in Calendar</a></div>`
        };
        console.log('Added button to message with existing redirect metadata');
      }
      
      // If there are no messages but we got products, create an assistant message
      if (latestMessages.length === 0 && response.foodProducts && Array.isArray(response.foodProducts) && response.foodProducts.length > 0) {
        console.log('No messages but found products, creating assistant message');
        latestMessages.push({
          role: 'assistant' as const,
          content: 'I found some products that might interest you:',
          timestamp: new Date().toISOString()
        });
      }
      
      // Process and attach products to the latest assistant message if available
      // Only process products if they're in the current response
      const hasProducts = response.foodProducts && Array.isArray(response.foodProducts) && response.foodProducts.length > 0;
      console.log('Has products in this response:', hasProducts);
      
      // IMPORTANT: For backward compatibility, make sure existing code paths still work
      // Legacy code might not have the hasProducts flag, so we'll make sure to handle that
      
      // Generate a unique message ID for this response to properly track products
      const responseMessageId = `msg_${Date.now()}`;
      console.log('Generated message ID for this response:', responseMessageId);
      
      if (hasProducts) {
        console.log('Found food products in response:', response.foodProducts);
        console.log('Response structure:', JSON.stringify(response, null, 2));
        
        // Process the products for consistent formatting
        // Using non-null assertion since we've already checked with hasProducts
        const processedProducts = (response.foodProducts || []).map((product: any) => {
          try {
            // Handle ID - check all possible ID fields
            const productId = (
              product.id || 
              product._id || 
              product.productId || 
              Math.random().toString(36).substr(2, 9)
            ).toString();
            
            // Handle name
            const productName = product.name || 'Unnamed Product';
            
            // Handle description - check all possible description fields
            const description = (
              product.description || 
              product.shortDescription || 
              product.short_description || 
              ''
            );
            
            // Handle prices - check all possible price fields
            const salePrice = product.salePrice || product.sale_price || '';
            const regularPrice = (
              product.regularPrice || 
              product.regular_price || 
              product.price || 
              '0'
            );
            const displayPrice = salePrice || regularPrice;
            
            // Handle images - check all possible image fields
            let imageSrc = '';
            const images: string[] = [];
            
            // Check for direct image string
            if (typeof product.image === 'string' && product.image.trim() !== '') {
              imageSrc = product.image;
              images.push(imageSrc);
            } 
            // Check for images array
            else if (Array.isArray(product.images) && product.images.length > 0) {
              // Handle both string and object image formats
              product.images.forEach((img: any) => {
                if (typeof img === 'string' && img.trim() !== '') {
                  images.push(img);
                } else if (img && (img.src || img.url)) {
                  const imgUrl = (img.src || img.url).toString().trim();
                  if (imgUrl) {
                    images.push(imgUrl);
                  }
                }
              });
              
              // Set the first image as the main image if we have any
              if (images.length > 0) {
                imageSrc = images[0];
              }
            }
            
            // Handle categories - extract names from category objects if needed
            const categories: string[] = [];
            if (Array.isArray(product.categories)) {
              product.categories.forEach((cat: any) => {
                if (typeof cat === 'string' && cat.trim() !== '') {
                  categories.push(cat);
                } else if (cat && (cat.name || cat.title)) {
                  const catName = (cat.name || cat.title).trim();
                  if (catName) categories.push(catName);
                }
              });
            }
            
            // Handle URL - check all possible URL fields
            const url = (
              product.url || 
              product.permalink || 
              (productId ? `#${productId}` : '#')
            );
            
            // Build the final product object with proper typing
            const processedProduct: Product & { 
              _id: string; 
              _original: any;
              _error?: string;
            } = {
              id: productId,
              _id: productId, // For backward compatibility
              name: productName,
              description: description,
              price: displayPrice.toString(),
              regular_price: regularPrice.toString(),
              image: imageSrc,
              images: images,
              url: url,
              categories: categories,
              // Include all original product data for debugging
              _original: product
            };
            
            console.log('Processed product:', processedProduct);
            return processedProduct;
            
          } catch (error) {
            console.error('Error processing product:', error, 'Product data:', product);
            // Return a minimal valid product object even if there was an error
            const errorProductId = Math.random().toString(36).substr(2, 9);
            return {
              id: errorProductId,
              _id: errorProductId,
              name: 'Error loading product',
              description: '',
              price: '0',
              regular_price: '0',
              image: '',
              images: [],
              url: '#',
              categories: [],
              // Ensure all required fields from Product interface are present
              _error: 'Error processing product',
              _original: product,
              // Add any additional required fields from the Product interface
              short_description: '',
              permalink: '#'
            };
          }
        });
        
        console.log('Processed products:', processedProducts);
        
        // Attach products to the latest assistant message FROM THIS RESPONSE ONLY
        // Find the most recent message from THIS response only
        let foundAssistantMessage = false;
        
        console.log('About to attach products to message. Latest messages:', JSON.stringify(latestMessages, null, 2));
        
        for (let i = latestMessages.length - 1; i >= 0; i--) {
          // Check if this message is a new assistant message from THIS response - using the messageId we set earlier
          if (latestMessages[i].role === 'assistant' && latestMessages[i].metadata?.messageId === responseMessageId) {
            console.log('Found NEW assistant message to attach products to at index:', i);
            foundAssistantMessage = true;
            // Tag this message with the products, keeping the messageId intact
            latestMessages[i] = {
              ...latestMessages[i],
              metadata: {
                ...(latestMessages[i].metadata || {}),
                products: processedProducts,
                isNewMessage: undefined // Clear the temporary flag
              }
            };
            console.log('Products attached to message with ID:', latestMessages[i].metadata?.messageId);
            break;
          }
        }
        
        // If no assistant message was found (unusual but possible), create one
        if (!foundAssistantMessage) {
          console.log('No assistant message found, creating one with products');
          const newAssistantMessage: MessageWithMetadata = {
            role: 'assistant' as const,
            content: 'I found some products that might interest you:',
            timestamp: new Date().toISOString(),
            metadata: {
              messageId: responseMessageId, // Use the same message ID as this response
              products: processedProducts
            }
          };
          latestMessages.push(newAssistantMessage);
          console.log('Added new assistant message with products');
        }
        
        // Keep products in state for backward compatibility
        setProducts(processedProducts);
      } else {
        console.log('No products found in response');
        setProducts([]);
        
        // If no products in current response, make sure new assistant messages don't show products
        if (latestMessages.length > 0) {
          // This is a new response, so we need to mark new messages to track them
          const isNewResponse = true;
          
          // Mark which messages are from this new response vs existing messages
          latestMessages = latestMessages.map(msg => {
            // Find existing messages that should keep their products
            if (msg.timestamp && new Date(msg.timestamp).getTime() < Date.now() - 2000) {
              // This is an existing message, preserve its state exactly as is
              return msg;
            } else {
              // This is a new message from the current response - add a message ID
              return {
                ...msg,
                metadata: {
                  ...(msg.metadata || {}),
                  isNewMessage: true, // Mark as a new message
                  messageId: responseMessageId, // Associate message with this response
                  products: undefined // New messages shouldn't have products unless explicitly provided
                }
              };
            }
          });
        }
      }
      
      // Update messages with the processed messages
      console.log('Setting final messages with attached products:', latestMessages);
      setMessages(latestMessages);
      
      // If we're in calendar mode and have all the data, hide the calendar UI
      if (showCalendar && calendarData.date && calendarData.time && calendarData.reason) {
        setShowCalendar(false);
      }
    } catch (err: any) {
      setError('Failed to send message. Please try again.');
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };
  // Add this function in your component file, before the component definitio
  // Handle preset question click
  const handleQuestionClick = (question: string) => {
    setInputValue(question);
  };
  
  // Request a human operator
  const requestHumanOperator = async () => {
    if (!conversation) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const updatedConversation = await chatAPI.requestOperator(
        conversation.conversationId, 
        'User requested human assistance'
      );
      
      setConversation(updatedConversation);
      
      // Add system message to inform user
      setMessages(prev => [
        ...prev, 
        {
          role: 'system',
          content: 'A human operator has been notified and will join this conversation shortly.'
        }
      ]);
    } catch (err) {
      setError('Failed to request human operator. Please try again.');
      console.error('Error requesting operator:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Submit calendar appointment
  const submitCalendarAppointment = async (reasonInput: string) => {
    if (!conversation || !calendarData.date || !calendarData.time) return;
    
    const reason = calendarData.reason || reasonInput;
    
    setLoading(true);
    setError(null);
    
    try {
      await chatAPI.scheduleAppointment(
        conversation.conversationId,
        calendarData.date,
        calendarData.time,
        reason
      );
      
      // Add system message to confirm appointment
      setMessages(prev => [
        ...prev, 
        {
          role: 'system',
          content: `Your appointment has been scheduled for ${calendarData.date} at ${calendarData.time}. Reason: ${reason}`
        }
      ]);
      
      // Reset calendar UI
      setShowCalendar(false);
      setCalendarData({});
    } catch (err) {
      setError('Failed to schedule appointment. Please try again.');
      console.error('Error scheduling appointment:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopRecording = useCallback(async () => {
    if (!isListening) {
      console.log('Not stopping - not currently listening');
      return '';
    }
    
    console.log('Stopping recording...');
    setIsProcessing(true);
    
    try {
      const transcription = await whisperRecorder.stopRecording();
      console.log('Recording stopped, transcription:', transcription || '[Empty]');
      
      if (transcription && transcription.trim()) {
        setInputValue(prev => {
          const newValue = prev ? `${prev} ${transcription}`.trim() : transcription.trim();
          console.log('Updated input value with transcription');
          return newValue;
        });
      }
      
      setError(null);
      return transcription || '';
    } catch (error) {
      console.error('Error during recording/transcription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process recording';
      setError(errorMessage);
      return '';
    } finally {
      setIsListening(false);
      setIsProcessing(false);
    }
  }, [isListening, whisperRecorder]);

  const startRecording = useCallback(async () => {
    if (isListening) {
      console.log('Already recording, not starting again');
      return false;
    }
    
    try {
      console.log('Starting recording...');
      await whisperRecorder.startRecording();
      console.log('Recording started successfully');
      setError(null);
      setIsListening(true);
      
      // Auto-stop after 30 seconds of total recording time as a safety measure
      const safetyTimer = setTimeout(() => {
        if (isListening) {
          console.log('Maximum recording time reached, stopping...');
          stopRecording();
        }
      }, 30000);
      
      return () => {
        console.log('Cleaning up recording timer');
        clearTimeout(safetyTimer);
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setError(errorMessage);
      setIsListening(false);
      return false;
    }
  }, [isListening, whisperRecorder, stopRecording]);
  
  const toggleVoiceRecognition = useCallback(async () => {
    console.log('toggleVoiceRecognition called, isListening:', isListening);
    
    try {
      if (isListening) {
        console.log('Stopping existing recording...');
        await stopRecording();
      } else {
        console.log('Starting new recording...');
        const started = await startRecording();
        if (!started) {
          console.log('Failed to start recording');
          return;
        }
      }
    } catch (error) {
      console.error('Error in toggleVoiceRecognition:', error);
      setError('Failed to toggle voice recording');
    }
  }, [isListening, whisperRecorder]);

  const toggleWidget = () => {
    setIsOpen(!isOpen);
  };

  const closeWidget = () => {
    setIsOpen(false);
  };
  
  // Clear conversation and start over
  const resetConversation = () => {
    setConversation(null);
    setMessages([]);
    setProducts([]);
    setShowCalendar(false);
    setCalendarData({});
    removeFromStorage('conversationId');
  };

  // Filter out product information from message content
  const filterProductInfo = (content: string): string => {
    if (!content) return '';
    
    // Check if the message contains product listings
    if (content.includes('Here are some options from our menu:') || 
        content.includes('Here are some Asian food options from our menu:')) {
      
      // Extract the introduction part before the product listings
      const introMatch = content.match(/^([\s\S]*?)(?:Here are some options from our menu:|Here are some Asian food options from our menu:)/i);
      let intro = introMatch ? introMatch[1].trim() : '';
      
      // Extract the conclusion part after the product listings
      const conclusionMatch = content.match(/(?:Would you like more information|Would you like to place an order|Can I help you with anything else)([\s\S]*)$/i);
      let conclusion = conclusionMatch ? conclusionMatch[0].trim() : '';
      
      // If we have both intro and conclusion, combine them
      if (intro && conclusion) {
        return intro + '\n\n' + conclusion;
      }
      // If we only have a conclusion, return that
      else if (conclusion) {
        return conclusion;
      }
      // If we only have an intro, return that
      else if (intro) {
        return intro;
      }
      // If we couldn't extract anything meaningful, return a generic message
      else {
        return 'Here are some products from our menu that match your request:';
      }
    }
    
    // If no product listings detected, return the original content
    return content;
  };

  // Simple function to format message with basic markdown
  const formatMessage = (content: string): string => {
    if (!content) return '';
    
    // Convert markdown links to HTML links
    content = content.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert markdown bold to HTML bold
    content = content.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown italic to HTML italic
    content = content.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    
    // Convert markdown headers
    content = content.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    content = content.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    content = content.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    
    // Convert newlines to <br>
    content = content.replace(/\n/g, '<br>');
    
    return content;
  };

  return (
    <div className={styles.floatingWidget}>
      {/* Collapsed Widget Button */}
      {!isOpen && (
        <button 
          className={styles.widgetButton} 
          onClick={toggleWidget}
          aria-label="Open chat widget"
        >
          <span className={styles.buttonIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </span>
          <span className={styles.buttonText}>Ask Vogo</span>
        </button>
      )}

      {/* Expanded Chat Widget */}
      {isOpen && (
        <div className={styles.widgetContainer}>
          <div className={styles.widgetHeader}>
            <div className={styles.headerTitle}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                <path d="M21 12a9 9 0 0 1-9 9"></path>
                <path d="M12 7a5 5 0 0 0-5 5"></path>
              </svg>
              <span>Ask Vogo</span>
            </div>
            <div className={styles.headerActions}>
            {conversation && (
              <button 
                className={styles.resetButton} 
                onClick={resetConversation}
                aria-label="Start new chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
              </button>
            )}
            <button 
              className={styles.minimizeButton} 
              onClick={toggleWidget}
              aria-label="Minimize chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button 
              className={styles.closeButton} 
              onClick={closeWidget}
              aria-label="Close chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            </div>
          </div>
          
          <div className={styles.widgetBody}>
            {safeMessages.length === 0 ? (
              <>
                <div className={styles.aiIntro}>
                  <div className={styles.aiAvatar}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                      <path d="M21 12a9 9 0 0 1-9 9"></path>
                      <path d="M12 7a5 5 0 0 0-5 5"></path>
                    </svg>
                  </div>
                  <div className={styles.aiMessage}>
                    <p>Hi! I'm Vogo, AI assistant</p>
                    <p>How can I help you today?</p>
                  </div>
                </div>
                
                <div className={styles.commonQuestions}>
                  <p className={styles.sectionTitle}>Common questions are:</p>
                  <div className={styles.questionButtons}>
                    <button 
                      className={styles.questionButton} 
                      onClick={() => handleQuestionClick('Can you recommend a pizza place?')}
                    >
                      Can You Recommend me a Pizza Place?
                    </button>
                    <button 
                      className={styles.questionButton}
                      onClick={() => handleQuestionClick('I need to schedule an appointment for tomorrow')}
                    >
                      Schedule an appointment
                    </button>
                    <button 
                      className={styles.questionButton}
                      onClick={() => {
                        handleQuestionClick('I need to speak with a human representative');
                        // Auto-submit after setting input value
                        setTimeout(() => {
                          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                          handleSubmit(fakeEvent);
                          // Request human operator after message is sent
                          setTimeout(requestHumanOperator, 1500);
                        }, 100);
                      }}
                    >
                      Talk to a human operator
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.chatMessages} id="chatMessages">
                {safeMessages.map((msg: MessageWithMetadata, index: number) => (
                  <div 
                    key={index} 
                    className={`${styles.messageContainer} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}
                  >
                    {msg.role === 'user' ? (
                      <div className={styles.messageContent}>
                        <p>{msg.content}</p>
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <div className={styles.messageContent}>
                        <div className={styles.aiAvatar}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                            <path d="M21 12a9 9 0 0 1-9 9"></path>
                            <path d="M12 7a5 5 0 0 0-5 5"></path>
                          </svg>
                        </div>
                        <div>
                          {/* Use dangerouslySetInnerHTML to render markdown content properly */}
                          <p dangerouslySetInnerHTML={{ __html: formatMessage(filterProductInfo(msg.content)) }}></p>
                          
                          {/* Display products if present in message metadata */}
                          {msg.metadata?.products && Array.isArray(msg.metadata.products) && msg.metadata.products.length > 0 && (
                            <div className={styles.productRecommendations}>
                              <h4 style={{ fontSize: '14px', color: '#666', margin: '8px 4px', fontWeight: 'normal' }}>
                                Found {msg.metadata.products.length} product{msg.metadata.products.length > 1 ? 's' : ''} for you:
                              </h4>
                              <div className={styles.productsGrid}>
                                {msg.metadata.products.map((product, index) => {
                                  // Log product info for debugging
                                   try {
                                    // Ensure product has required fields with proper typing
                                    const safeProduct: Product = {
                                      id: product.id || product._id || `product-${index}`,
                                      name: product.name || 'Unnamed Product',
                                      description: product.description || product.short_description || '',
                                      price: product.price || product.regular_price || '0',
                                      image: product.image || (product.images && Array.isArray(product.images) && product.images.length > 0 ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.src) : null),
                                      url: product.url || product.permalink || '#',
                                      categories: Array.isArray(product.categories) 
                                        ? product.categories 
                                        : [],
                                      // Include any additional fields that might be needed
                                      _id: product._id || '',
                                      short_description: product.short_description || '',
                                      regular_price: product.regular_price || '',
                                      images: product.images || [],
                                      permalink: product.permalink || ''
                                    };
                                    
                                    console.log('Using safe product:', JSON.stringify(safeProduct, null, 2));
                                    
                                    return (
                                      <div key={safeProduct.id} className={styles.productCardWrapper}>
                                        <ProductCard key={safeProduct.id} product={safeProduct} compact={true} />
                                      </div>
                                    );
                                  } catch (error) {
                                    console.error('Error rendering product card:', error, product);
                                    return (
                                      <div key={`error-${index}`} className={styles.productError}>
                                        <p>Could not display product: {product.name || 'Unknown'}</p>
                                        <p>Price: {product.price || product.regular_price || 'N/A'}</p>
                                        {(product.url || product.permalink) && (product.url || product.permalink) !== '#' && (
                                          <a href={product.url || product.permalink} target="_blank" rel="noopener noreferrer">
                                            View Product
                                          </a>
                                        )}
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                                {msg.metadata.products.length > 2 ? 'Scroll horizontally to see more products' : ''}
                              </div>
                            </div>
                          )}
                          
                          {/* Render action buttons if available */}
                          {msg.metadata?.actions && Array.isArray(msg.metadata.actions) && msg.metadata.actions.length > 0 && (
                            <div className={styles.actionButtons}>
                              {msg.metadata.actions.map((action: ActionButton, actionIndex: number) => (
                                action.type === 'link' ? (
                                  <a
                                    key={actionIndex}
                                    href={action.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${styles.actionButton} ${action.style === 'primary' ? styles.primaryButton : styles.secondaryButton}`}
                                    onClick={() => {
                                      // Handle auto-redirect if needed
                                      if (msg.metadata?.shouldRedirect && msg.metadata?.redirectUrl) {
                                        window.open(msg.metadata.redirectUrl, '_blank');
                                      }
                                    }}
                                  >
                                    {action.text}
                                  </a>
                                ) : (
                                  <button
                                    key={actionIndex}
                                    className={`${styles.actionButton} ${action.style === 'primary' ? styles.primaryButton : styles.secondaryButton}`}
                                    onClick={() => {
                                      if (action.action) {
                                        handleActionClick(action.action, msg.metadata);
                                      }
                                    }}
                                  >
                                    {action.text}
                                  </button>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : msg.role === 'system' ? (
                      <div className={`${styles.messageContent} ${styles.systemMessage}`}>
                        <p>{msg.content}</p>
                      </div>
                    ) : msg.role === 'operator' ? (
                      <div className={`${styles.messageContent} ${styles.operatorMessage}`}>
                        <p>{msg.content}</p>
                      </div>
                    ) : (
                      <div className={`${styles.messageContent} ${styles.operatorMessage}`}>
                        <p>{msg.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Products are now displayed within their associated message */}
                
                {/* Calendar scheduling UI */}
                {showCalendar && (
                  <div className={styles.calendarWidget}>
                    <h4 className={styles.calendarTitle}>Schedule an Appointment</h4>
                    <div className={styles.calendarForm}>
                      <div className={styles.calendarField}>
                        <label>Date:</label>
                        <div className={calendarData.date ? styles.calendarInputFilled : styles.calendarInput}>
                          {calendarData.date || 'Please enter a date'}
                        </div>
                      </div>
                      <div className={styles.calendarField}>
                        <label>Time:</label>
                        <div className={calendarData.time ? styles.calendarInputFilled : styles.calendarInput}>
                          {calendarData.time || 'Please enter a time'}
                        </div>
                      </div>
                      <div className={styles.calendarField}>
                        <label>Reason:</label>
                        <div className={calendarData.reason ? styles.calendarInputFilled : styles.calendarInput}>
                          {calendarData.reason || 'Please enter reason for appointment'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {loading && (
                  <div className={styles.loadingIndicator}>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                  </div>
                )}
                {error && (
                  <div className={styles.errorMessage}>
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>Dismiss</button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          <div className={styles.widgetFooter}>
            <form className={styles.chatForm} onSubmit={handleSubmit}>
              <div className={styles.inputContainer}>
                <input
                  type="text"
                  className={styles.userInput}
                  placeholder="Tell us how we can help..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (inputValue.trim() && !loading) {
                        handleSubmit(e as any);
                      }
                    }
                  }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={`${styles.voiceButton} ${isListening ? styles.listening : ''} ${isProcessing ? styles.processing : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleVoiceRecognition();
                  }}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                  disabled={loading || isProcessing}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  aria-busy={isProcessing}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                  {isListening && <span className={styles.recordingPulse}></span>}
                </button>
                <button 
                  type="submit" 
                  className={styles.sendButton}
                  disabled={loading || !inputValue.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </form>
            <div className={styles.disclaimer}>
              {conversation?.operatorAssigned ? 'A human operator will assist you shortly' : 'AI may produce inaccurate information'}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  
};

export default FloatingWidget;
