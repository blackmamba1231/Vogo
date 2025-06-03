const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const Conversation = require('../models/conversation.model');
// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use the global Redis client that's initialized in server.js
let redisClient;

// Function to get Redis client
const getRedisClient = () => {
  if (!global.redisClient) {
    logger.warn('Global Redis client not available in OpenAI service');
    return null;
  }
  return global.redisClient;
};

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600;

class OpenAIService {
  // Add this to openai.service.js

  // In openai.service.js, update the checkSchedulingIntent function:

async checkSchedulingIntent(message, conversationId ) {
  try {
     const conversation = await Conversation.findOne({ _id: conversationId });
        if (!conversation) {
          return res.status(404).json({
            error: true,
            message: 'Conversation not found'
          });
        }

    const prompt = `Analyze the following message for scheduling intent and extract details. 
    Return a JSON object with these fields:
    - isScheduling (boolean): true if the message is about scheduling an appointment
    - serviceType (string): type of service (e.g., "brake service", "oil change")
    - hasDate (boolean): true if a date is mentioned
    - hasTime (boolean): true if a time is mentioned
    - dateTime (string): ISO string of the date/time if found, null otherwise
    - location (string): location or service center mentioned, if any

    Message: "${message}"
    consider the previous conversations also '${conversation.messages}' for proper state conservation of the conversations
    so if the previous conversations also you are provided with the isScheduling (boolean), serviceType (string), hasDate (boolean), hasTime (boolean), dateTime (string), location (string) then consider those also in your final response
    Example response for "I need a brake service in Alba Iulia tomorrow at 10 AM":
    {
      "isScheduling": true,
      "serviceType": "brake service",
      "hasDate": true,
      "hasTime": true,
      "dateTime": "2025-05-28T10:00:00.000Z",
      "location": "Alba Iulia"
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: "You are a helpful assistant that analyzes messages for scheduling intent." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log("Scheduling Intent :",result);
    // Ensure all required fields are present
    return {
      isScheduling: Boolean(result.isScheduling),
      serviceType: result.serviceType || null,
      hasDate: Boolean(result.hasDate),
      hasTime: Boolean(result.hasTime),
      dateTime: result.dateTime || null,
      location: result.location || null,
      hasDateTime: result.hasDate && result.hasTime
    };
  } catch (error) {
    console.error('Error checking scheduling intent:', error);
    return {
      isScheduling: false,
      serviceType: null,
      hasDate: false,
      hasTime: false,
      dateTime: null,
      location: null,
      hasDateTime: false
    };
  }
}

/**
 * Check if the message is requesting human operator
 * @param {string} message - User's message
 * @returns {Promise<boolean>} True if requesting human operator
 */
async isHumanOperatorRequested(message) {
  try {
    const prompt = `Determine if this message is requesting to speak with a human operator or representative.
Message: "${message}"

Respond with JSON in this format:
{
  "isHumanRequested": true/false,
  "reason": "Brief reason for the request"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return result.isHumanRequested === true;
  } catch (error) {
    console.error('Error checking human operator request:', error);
    return false;
  }
}
  // Translate user message to Romanian for WooCommerce search
  async translateToRomanian(text) {
    try {
      if (!text) return '';
      
      // Check if the text is already in Romanian
      const detectedLanguage = await this.detectLanguage(text);
      if (detectedLanguage === 'ro') return text;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a translator. Translate the following text to Romanian accurately and concisely. Only respond with the translated text, nothing else."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      });
      
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  }

  // Check if user is requesting human operator
  async checkForHumanOperatorRequest(message, language = 'en') {
    try {
      const humanOperatorPrompts = {
        en: "Determine if the user is explicitly asking to speak with a human operator or customer service representative. Respond with 'YES' or 'NO'.",
        fr: "Déterminez si l'utilisateur demande explicitement à parler à un opérateur humain ou à un représentant du service client. Répondez par 'YES' ou 'NO'.",
        ro: "Determinați dacă utilizatorul cere în mod explicit să vorbească cu un operator uman sau cu un reprezentant al serviciului clienți. Răspundeți cu 'YES' sau 'NO'."
      };

      const prompt = humanOperatorPrompts[language] || humanOperatorPrompts.en;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 5
      });
      
      const response = completion.choices[0].message.content.trim().toUpperCase();
      return response === 'YES';
    } catch (error) {
      console.error('Human operator request check error:', error);
      return false;
    }
  }

  // Generate a natural introduction for product recommendations
  async generateProductIntroduction(userMessage, productType, productCount, language = 'en') {
    try {
      const prompts = {
        en: `Generate a natural, conversational response to a user asking about ${productType}. 
            I have found ${productCount} products to show them. 
            Your response should be friendly and helpful, mentioning that you've found some options they might like.
            Do NOT list the products - they will be shown separately as product cards.
            Keep your response concise (max 2-3 sentences) and end with an offer to help further.
            
            User message: "${userMessage}"
            `,
        ro: `Generează un răspuns natural, conversațional pentru un utilizator care întreabă despre ${productType}. 
            Am găsit ${productCount} produse pentru a le arăta. 
            Răspunsul tău ar trebui să fie prietenos și util, menționând că ai găsit câteva opțiuni care le-ar putea plăcea.
            NU enumera produsele - acestea vor fi afișate separat ca și carduri de produs.
            Păstrează răspunsul concis (maxim 2-3 propoziții) și încheie cu o ofertă de a ajuta în continuare.
            
            Mesajul utilizatorului: "${userMessage}"
            `
      };

      const prompt = prompts[language] || prompts.en;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });
      console.log('extra ai tuning');
      return completion.choices[0].message.content.trim();
    } catch (error) {
      logger.error(`Error generating product introduction: ${error.message}`);
      return null;
    }
  }

  // Extract detailed food category information from message
  async extractFoodCategory(message, language = 'en') {
    try {
      // Define available food categories based on the website structure
      const availableCategories = [
        "Pizza", "Burger", "Pasta", "Asian Food", "Vegan-Fit-Sport", 
        "Desserts", "Drinks", "Breakfast", "Traditional", "Italian"
      ];
      
      const foodCategoryPrompts = {
        en: `Analyze the message and determine what type of food or cuisine the user is looking for. 
            Available categories in our system are: ${availableCategories.join(', ')}.
            Return a JSON object with these properties:
            - category: The most likely food category from our available categories, or a custom one if none match
            - confidence: A number between 0-1 indicating how confident you are
            - specificItems: Array of specific food items mentioned (if any)
            
            For example, if someone asks about "Asian food" or "sushi", the category would be "Asian Food".
            If they ask about "traditional Romanian food" or "ciorba", the category would be "Traditional".
            If they ask about "Italian food" or "pasta", the category would be "Italian".
            
            Respond with ONLY the JSON object, nothing else.`,
        
        ro: `Analizează mesajul și determină ce tip de mâncare sau bucătărie caută utilizatorul. 
            Categoriile disponibile în sistemul nostru sunt: ${availableCategories.join(', ')}.
            Returnează un obiect JSON cu aceste proprietăți:
            - category: Categoria de mâncare cea mai probabilă din categoriile noastre disponibile, sau una personalizată dacă niciuna nu se potrivește
            - confidence: Un număr între 0-1 care indică cât de sigur ești
            - specificItems: Array de preparate specifice menționate (dacă există)
            
            De exemplu, dacă cineva întreabă despre "mâncare asiatică" sau "sushi", categoria ar fi "Asian Food".
            Dacă întreabă despre "mâncare tradițională românească" sau "ciorbă", categoria ar fi "Traditional".
            Dacă întreabă despre "mâncare italiană" sau "paste", categoria ar fi "Italian".
            
            Răspunde DOAR cu obiectul JSON, nimic altceva.`
      };

      const prompt = foodCategoryPrompts[language] || foodCategoryPrompts.en;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });
      
      const responseText = completion.choices[0].message.content.trim();
      
      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(responseText);
        logger.info(`AI food category extraction: ${JSON.stringify(parsedResponse)}`);
        return parsedResponse;
      } catch (parseError) {
        logger.error(`Error parsing AI food category response: ${parseError.message}`);
        logger.error(`Raw response: ${responseText}`);
        return null;
      }
    } catch (error) {
      logger.error(`Food category extraction error: ${error.message}`);
      return null;
    }
  }
  
  // Extract product query from message
  async extractProductQuery(message, language = 'en') {
    try {
      const productQueryPrompts = {
        en: "Extract the main product or service the user is looking for. If there's no clear product/service query, respond with 'NONE'. Return only the product query, nothing else.",
        fr: "Extrayez le principal produit ou service que l'utilisateur recherche. S'il n'y a pas de recherche claire de produit/service, répondez 'NONE'. Retournez uniquement la requête de produit, rien d'autre.",
        ro: "Extrageți principalul produs sau serviciu pe care utilizatorul îl caută. Dacă nu există o interogare clară de produs/serviciu, răspundeți cu 'NONE'. Returnați doar interogarea produsului, nimic altceva."
      };

      const prompt = productQueryPrompts[language] || productQueryPrompts.en;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      });
      
      const response = completion.choices[0].message.content.trim();
      return response === 'NONE' ? null : response;
    } catch (error) {
      console.error('Product query extraction error:', error);
      return null;
    }
  }

  // Process user message and generate response
  async processMessage(messages, sessionId, language = 'en') {
    try {
      // Get Redis client
      redisClient = getRedisClient();
      
      // Cache key for this conversation
      const cacheKey = `chat:${sessionId}:${messages.length}`;
      
      // Check cache first
      if (redisClient) {
        const cachedResponse = await redisClient.get(cacheKey);
        if (cachedResponse) {
          return JSON.parse(cachedResponse);
        }
      }
      
      // System messages for different languages
      const systemMessages = {
        en: "You are Vogo, a helpful assistant for Vogo Family services. You can help with booking services, ordering food, finding restaurants, and managing calendars. You have access to our store's inventory through the WooCommerce API. Always recommend actual products and services from our store when appropriate. If a user wants to speak to a human operator, create a ticket and arrange for handover. Always be helpful, concise, and friendly.",
        fr: "Vous êtes Vogo, un assistant utile pour les services de Vogo Family. Vous pouvez aider à réserver des services, commander de la nourriture, trouver des restaurants et gérer des calendriers. Vous avez accès à l'inventaire de notre magasin via l'API WooCommerce. Recommandez toujours des produits et services réels de notre magasin lorsque cela est approprié. Si un utilisateur souhaite parler à un opérateur humain, créez un ticket et organisez un transfert. Soyez toujours serviable, concis et amical.",
        ro: "Ești Vogo, un asistent util pentru serviciile Vogo Family. Poți ajuta cu rezervarea serviciilor, comanda de mâncare, găsirea restaurantelor și gestionarea calendarelor. Ai acces la inventarul magazinului nostru prin API-ul WooCommerce. Recomandă întotdeauna produse și servicii reale din magazinul nostru când este cazul. Dacă un utilizator dorește să vorbească cu un operator uman, creează un bilet și organizează predarea. Fii întotdeauna de ajutor, concis și prietenos."
      };
      
      // Add system message based on language
      const systemMessage = systemMessages[language] || systemMessages.en;
      
      // Prepare messages for OpenAI
      const formattedMessages = [
        { role: 'system', content: systemMessage },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];
      
      // Check if the user is requesting a human operator
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        const isHumanOperatorRequested = await this.checkForHumanOperatorRequest(lastUserMessage.content, language);
        
        if (isHumanOperatorRequested) {
          return {
            role: 'assistant',
            content: 'I understand you want to speak with a human operator. I\'ll arrange that for you right away. A ticket has been created and a team member will contact you soon.',
            metadata: {
              requiresHumanOperator: true
            }
          };
        }
      }
      
      // Extract product query and get recommendations from WooCommerce if applicable
      
      
      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 500
      });
      
      const response = completion.choices[0].message;
      
      // Cache the response if Redis is available
      if (redisClient) {
        try {
          await redisClient.set(cacheKey, JSON.stringify(response), {
            EX: CACHE_TTL
          });
        } catch (cacheError) {
          logger.error('Redis caching error:', cacheError);
          // Continue even if caching fails
        }
      }
      
      return response;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to process message with AI');
    }
  }
  
  // Detect language of the user's message
  async detectLanguage(text) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a language detection system. Respond with only 'en', 'fr', or 'ro' depending on whether the text is in English, French, or Romanian. If unsure or for any other language, respond with 'en'."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 5
      });
      
      const detectedLanguage = completion.choices[0].message.content.trim().toLowerCase();
      return ['en', 'fr', 'ro'].includes(detectedLanguage) ? detectedLanguage : 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default to English on error
    }
  }
  
  // Detect user intent from message
  async detectIntent(message, language = 'en') {
    try {
      // Get Redis client
      redisClient = getRedisClient();
      
      const cacheKey = `intent:${message.substring(0, 50)}:${language}`;
      
      // Check cache first
      if (redisClient) {
        const cachedIntent = await redisClient.get(cacheKey);
        if (cachedIntent) {
          return cachedIntent;
        }
      }
      
      const intentPrompts = {
        en: "Categorize this message into one of these intents: 'calendar_event', 'shopping_list', 'restaurant_search', 'food_order', 'service_booking', 'other'. Respond with ONLY the intent name.",
        fr: "Catégorisez ce message dans l'une de ces intentions: 'calendar_event', 'shopping_list', 'restaurant_search', 'food_order', 'service_booking', 'other'. Répondez UNIQUEMENT avec le nom de l'intention.",
        ro: "Încadrați acest mesaj într-una dintre aceste intenții: 'calendar_event', 'shopping_list', 'restaurant_search', 'food_order', 'service_booking', 'other'. Răspundeți DOAR cu numele intenției."
      };
      
      const intentPrompt = intentPrompts[language] || intentPrompts.en;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: intentPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      });
      
      const intent = completion.choices[0].message.content.trim().toLowerCase();
      
      // Validate intent
      const validIntents = ['calendar_event', 'shopping_list', 'restaurant_search', 'food_order', 'service_booking', 'other'];
      const finalIntent = validIntents.includes(intent) ? intent : 'general';
      
      // Cache the intent if Redis is available
      if (redisClient) {
        try {
          await redisClient.set(cacheKey, finalIntent, {
            EX: CACHE_TTL
          });
        } catch (cacheError) {
          logger.error('Redis caching error:', cacheError);
          // Continue even if caching fails
        }
      }
      
      return finalIntent;
    } catch (error) {
      console.error('Intent detection error:', error);
      return 'general'; // Default intent on error
    }
  }
  /**
 * Filter relevant products based on user query using OpenAI
 * @param {string} userQuery - The original user query
 * @param {Array} products - Array of product objects to filter
 * @param {string} language - Language code (default: 'en')
 * @returns {Promise<Array>} Filtered array of relevant products
 */
async filterRelevantProducts(userQuery, products, language = 'en') {
  try {
    if (!products || products.length === 0) return [];
    
    // If there are only a few products, no need to filter
    if (products.length <= 3) return products;
    
    // Prepare product list for the prompt
    const productList = products.map((p, index) => 
      `ID: ${index + 1}\nName: ${p.name}\nDescription: ${p.description || ''}\n---`
    ).join('\n');

    const prompt = `You are a helpful assistant that filters products based on user queries.
    
User Query: "${userQuery}"

Products:
${productList}

Instructions:
1. Analyze which products are most relevant to the user's query.
2. Return ONLY the IDs of the most relevant products (1-3 max), one per line.
3. Only include products that directly match what the user is asking for.
4. Exclude ingredients or unrelated products.

Return ONLY the numbers of the most relevant products, one per line.`;
    console.log("filtering products ");
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 50
    });
    console.log("filtering...");
    const response = completion.choices[0].message.content.trim();
    console.log("response got for filtering products");
    const relevantIndices = response
      .split('\n')
      .map(line => parseInt(line.trim()) - 1) // Convert to 0-based index
      .filter(idx => !isNaN(idx) && idx >= 0 && idx < products.length);
    
    // Return the filtered products
    return relevantIndices.map(idx => products[idx]);
  } catch (error) {
    console.error('Error filtering products with OpenAI:', error);
    // Return original products if there's an error
    return products;
  }
}
 

  // Extract location from message
  async extractLocation(message, language = 'en') {
    try {
      // Get Redis client
      redisClient = getRedisClient();
      
      const cacheKey = `location:${message.substring(0, 50)}:${language}`;
      
      // Check cache first
      if (redisClient) {
        const cachedLocation = await redisClient.get(cacheKey);
        if (cachedLocation) {
          return cachedLocation === 'null' ? null : cachedLocation;
        }
      }
      
      const locationPrompts = {
        en: "Extract any location or place mentioned in this message. If no location is mentioned, respond with 'NONE'. Only return the location name, nothing else.",
        fr: "Extrayez tout lieu ou endroit mentionné dans ce message. Si aucun lieu n'est mentionné, répondez 'NONE'. Retournez uniquement le nom du lieu, rien d'autre.",
        ro: "Extrageți orice locație sau loc menționat în acest mesaj. Dacă nu este menționată nicio locație, răspundeți cu 'NONE'. Returnați doar numele locației, nimic altceva."
      };
      
      const locationPrompt = locationPrompts[language] || locationPrompts.en;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: locationPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      });
      
      const location = completion.choices[0].message.content.trim();
      const finalLocation = location === 'NONE' ? null : location;
      
      // Cache the location if Redis is available
      if (redisClient) {
        try {
          await redisClient.set(cacheKey, finalLocation || 'null', {
            EX: CACHE_TTL
          });
        } catch (cacheError) {
          logger.error('Redis caching error:', cacheError);
          // Continue even if caching fails
        }
      }
      
      return finalLocation;
    } catch (error) {
      console.error('Location extraction error:', error);
      return null;
    }
  }
}

module.exports = new OpenAIService();
