const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');
const Conversation = require('../models/conversation.model');
const CalendarEvent = require('../models/calendar-event.model');
const Product = require('../models/product.model');
const openAIService = require('../services/openai.service');
const woocommerceLocalService = require('../services/woocommerce-local.service');
const calendarService = require('../services/calendar.service');
const woocommerceService = require('../services/woocommerce.service');
const woocommerceSyncService = require('../services/woocommerce-sync.service');
const ticketService = require('../services/ticket.service');
const nodemailer = require('nodemailer');
const SYSTEM_PROMPT = `You are a helpful assistant for our business that provides products and services. 
- Maintain context of previous messages in the conversation.
- If the user refers to products or services mentioned earlier, use that context.
- When showing products, include clear names and prices.
- If the user wants to order, ask for any missing details (quantity, size, etc.).
- Be friendly and professional in all responses.
`;
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// Email transport configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Start a new conversation
exports.startConversation = async (req, res) => {
  try {
    const { initialMessage } = req.body;
    if (!initialMessage) {
      return res.status(400).json({
        error: true,
        message: 'Initial message is required'
      });
    }
    const sessionId = uuidv4();
    console.log(req.body.userId);
    // Detect language of initial message
    const language = await openAIService.detectLanguage(initialMessage);
    console.log('Language detected:', language);
    // Create new conversation with user ID if provided
    const conversationData = {
      sessionId,
      ...(req.body.userId && { userId: req.body.userId }),
      language,
      messages: [
        {
          role: 'user',
          content: initialMessage
        }
      ]
    };
    
    const conversation = new Conversation(conversationData);
    console.log('Conversation created:', conversation);
    // Process message with OpenAI
    let aiResponse = await openAIService.processMessage(
      conversation.messages,
      sessionId,
      language
    );
    const conversationId = conversation._id;
    const Prompt = `Determine if this message is requesting to do any of the following:
1. Product/service search
2. Ordering intent
3. Scheduling or making an appointment
4. Asking to show previous schedules or appointments
5.If it is a general intent
6.if the user wants to show the previous tickets 
7.if user wants to talk to a human representative

Respond in **valid JSON** format like this:
{
  "isScheduling": true/false,
  "isProductorServiceSearch": true/false,
  "isOrdering": true/false,
  "isPreviousSchedules": true/false,
  "isGeneral": true/false,
  "isPreviousTickets": true/false,
  "isHumanRepresentative": true/false
}
Only one of the above fields should be true. Be very smart and accurate in detection.
Respond with only valid JSON, no extra text, no markdown.
also consider previous converstations {${JSON.stringify(conversation)}} for proper state management of the chat because for example if our chatbot has replied with asking some missing infos (example : date or time) so you properly understand the intent properly by considering previous conversation messages also..
`;
let intent;
        //checking the user message with this prompt
        intent = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: [
            { role: "system", content: Prompt },
            { role: "user", content: initialMessage }
          ],
          temperature: 0.2
        });
        console.log("response from openai", intent.choices[0].message.content)
        let response;
        response = JSON.parse(intent.choices[0].message.content);
        
    // Detect intent first
    
    console.log('Intent detected:', response);
    if(response.isGeneral){
      aiResponse = await openAIService.processMessage(
        conversation.messages,
        sessionId,
        language
      );
      Object.assign(conversation, aiResponse.conversation);
      console.log('AI response for simple message:', aiResponse)
    }
    if (response.isScheduling) {
      if(conversation.userId == null){
        conversation.messages.push({
          role: 'assistant',
          content: "You must login first to schedule an appointment"
        })
        await conversation.save();
        const responseData = {
          error: false,
          data: {
            conversationId: conversation._id,
            sessionId,
            messages: conversation.messages,
            language,
            foodProducts: conversation.foodProducts || []
          }
        };
        
        console.log('Sending response with data:', JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);
        return;
      }
    }
    console.log("no scheduling intent was found proceeding with the product search");
    // Check for product search/order intent
  
    if (response.isProductorServiceSearch ) {
      console.log("product search intent was found proceeding with the product search")
      const intentHandled = await handleIntent(conversation, initialMessage, aiResponse);
      if (intentHandled && intentHandled.aiResponse) {
        console.log("after intentHandle response:",intentHandled.aiResponse)
        aiResponse = intentHandled.aiResponse;
        Object.assign(conversation, intentHandled.conversation);
        console.log("done with the product searching");
      }
    }
    if(response.isOrdering){
      let schedulingInfo;
      schedulingInfo = await openAIService.checkSchedulingIntent(initialMessage, conversationId);
      console.log("scheduling info: ", schedulingInfo)
      console.log(" ordering intent detected")
      const schedulingResult = await handleSchedulingFlow(conversation, initialMessage, schedulingInfo);
      
      // Add AI response to conversation
      conversation.messages.push({
        role: 'assistant',
        content: schedulingResult.aiResponse.content,
        timestamp: new Date()
      });
      
      // Save the updated conversation
      await conversation.save();
      
      // Return the complete response
      return res.status(200).json({
        error: false,
        data: {
          conversationId: conversation._id,
          sessionId: conversation.sessionId,
          messages: conversation.messages,
          language: conversation.language,
          ...(schedulingResult.aiResponse.metadata || {})
        }
      });
    }
    if(response.isPreviousSchedules){
      if(conversation.userId == null){
        conversation.messages.push({
          role: 'assistant',
          content: "You must login to see your previous schedules"
        })
        await conversation.save();
        const responseData = {
          error: false,
          data: {
            conversationId: conversation._id,
            sessionId,
            messages: conversation.messages,
            language,
            foodProducts: conversation.foodProducts || []
          }
        };
        
        console.log('Sending response with data:', JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);
        return;
      }else{
        try {
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          
          // Query calendar events from the database
          const events = await CalendarEvent.find({
            $or: [
              { userId: conversation.userId }
            ],
            startDateTime: { $gte: oneYearAgo, $lte: now },
            status: { $ne: 'cancelled' }
          }).sort({ startDateTime: 1 });
      
          const schedules = events.map(event => ({
            summary: event.title,
            start: event.startDateTime,
            end: event.endDateTime,
            status: event.status,
            description: event.description,
            location: event.location
          }));
      
          let message = schedules.length > 0 
            ? "Here are your previous schedules:\n" + 
              schedules.map((s, i) => 
                `${i+1}. ${s.summary} - From ${new Date(s.start).toLocaleString()} to ${new Date(s.end).toLocaleString()}`
              ).join('\n')
            : "You don't have any previous schedules.";
      
          conversation.messages.push({
            role: 'assistant',
            content: message
          });
          await conversation.save();
      
          const responseData = {
            error: false,
            data: {
              conversationId: conversation._id,
              sessionId,
              messages: conversation.messages,
              language,
              foodProducts: conversation.foodProducts || []
            }
          };
          
          console.log('Sending response with data:', JSON.stringify(responseData, null, 2));
          res.status(200).json(responseData);
          return;
        } catch (error) {
          console.error('Error fetching calendar events:', error);
          conversation.messages.push({
            role: 'assistant',
            content: "Sorry, I couldn't fetch your previous schedules. Please try again later."
          });
          await conversation.save();
          
          const responseData = {
            error: false,
            data: {
              conversationId: conversation._id,
              sessionId,
              messages: conversation.messages,
              language,
              foodProducts: conversation.foodProducts || []
            }
          };
          
          res.status(200).json(responseData);
          return;
        }
      }

    }
   
    
    // NOW add the potentially modified AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse.content
    });
    
    console.log('Conversation after AI response:', conversation);
    
    // Extract location if mentioned
    const location = await openAIService.extractLocation(initialMessage, language);
    if (location) {
      conversation.location = location;
    }
    console.log("location mentioned in the chat:" + location);
    // Save conversation
    await conversation.save();
    
    // Prepare response data with conversation and any food products
    const responseData = {
      error: false,
      data: {
        conversationId: conversation._id,
        sessionId,
        messages: conversation.messages,
        language,
        foodProducts: conversation.foodProducts || []
      }
    };
    
    console.log('Sending response with data:', JSON.stringify(responseData, null, 2));
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({
      error: true,
      message: 'Error starting conversation'
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, message, messageType = 'text' } = req.body;  
    
    // Find conversation
    const conversation = await Conversation.findOne({ _id: conversationId });
    if (!conversation) {
      return res.status(404).json({
        error: true,
        message: 'Conversation not found'
      });
    }
    
    // Add user message to conversation
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    conversation.messages.push(userMessage);
    conversation.lastMessageAt = new Date();
    
    let aiResponse;

    if (!conversation.operatorAssigned) {
      try {
        // Prepare messages for AI with system prompt
        const messagesForAI = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...conversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        ];
        aiResponse = await openAIService.processMessage(messagesForAI, conversation.sessionId, conversation.language);

        // Check for scheduling intent
        //open api propmt to check if the intent is scheduling or product/service search only
        const Prompt = `Determine if this message is requesting to do any of the following:
1. Product/service search
2. Ordering intent
3. Scheduling or making an appointment
4. Asking to show previous schedules or appointments
5.If it is a general intent
6.if the user wants to show the previous tickets 
7.if user wants to talk to a human representative

Respond in **valid JSON** format like this:
{
  "isScheduling": true/false,
  "isProductorServiceSearch": true/false,
  "isOrdering": true/false,
  "isPreviousSchedules": true/false,
  "isGeneral": true/false,
  "isPreviousTickets": true/false,
  "isHumanRepresentative": true/false
}
Only one of the above fields should be true. Be very smart and accurate in detection.
Respond with only valid JSON, no extra text, no markdown.
also consider previous converstations {${JSON.stringify(conversation)}} for proper state management of the chat because for example if our chatbot has replied with asking some missing infos (example : date or time) so you properly understand the intent properly by considering previous conversation messages also..
`;
let intent;
        //checking the user message with this prompt
        intent = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: [
            { role: "system", content: Prompt },
            { role: "user", content: message }
          ],
          temperature: 0.2
        });
        console.log("response from openai", intent.choices[0].message.content)
        //parse the response.choices[0].message.content to json {
  // "isScheduling": false,
  // "isProductorServiceSearch": true,
  // "isOrdering": false,
  // "isPreviousSchedules": false,
  // "isGeneral": false
  // }
  let response;
  try {
    // Parse the response content to JSON
    response = JSON.parse(intent.choices[0].message.content);
    console.log("Parsed intent:", response);
  } catch (error) {
    console.error("Error parsing OpenAI response:", error);
    // Fallback to default intent if parsing fails
    response = {
      isScheduling: false,
      isProductorServiceSearch: false,
      isOrdering: false,
      isPreviousSchedules: false,
      isGeneral: true
    };
  }

  if(response.isGeneral){
    aiResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    aiResponse = aiResponse.choices[0].message.content;
    console.log('AI response for simple message:', aiResponse)
  }
  if (response.isScheduling) {
    if(conversation.userId == null){
      conversation.messages.push({
        role: 'assistant',
        content: "You must login first to schedule an appointment"
      })
      await conversation.save();
      const responseData = {
        error: false,
        data: {
          conversationId: conversation._id,
          sessionId: conversation.sessionId,
          messages: conversation.messages,
          language: conversation.language,
          foodProducts: conversation.foodProducts || []
        }
      };
      
      console.log('Sending response with data:', JSON.stringify(responseData, null, 2));
      res.status(200).json(responseData);
      return;
    }else{
      let schedulingInfo;
          schedulingInfo = await openAIService.checkSchedulingIntent(message, conversationId);
          console.log("scheduling info: ", schedulingInfo)
          const schedulingResult = await handleSchedulingFlow(conversation, message, schedulingInfo);
          
          // Add AI response to conversation
          conversation.messages.push({
            role: 'assistant',
            content: schedulingResult.aiResponse.content,
            timestamp: new Date()
          });
          
          // Save the updated conversation
          await conversation.save();
          
          // Return the complete response
          return res.status(200).json({
            error: false,
            data: {
              conversationId: conversation._id,
              sessionId: conversation.sessionId,
              messages: conversation.messages,
              language: conversation.language,
              ...(schedulingResult.aiResponse.metadata || {})
            }
          });
    }
  }
  console.log("no scheduling intent was found proceeding with the product search");
  // Check for product search/order intent

  if (response.isProductorServiceSearch ) {
    console.log("product search intent was found proceeding with the product search")
    const intentHandled = await handleIntent(conversation, message, aiResponse);
    if (intentHandled && intentHandled.aiResponse) {
      console.log("after intentHandle response:",intentHandled.aiResponse)
      aiResponse = intentHandled.aiResponse.content;
      Object.assign(conversation, intentHandled.conversation);
      console.log("done with the product searching");
    }
  }
  if(response.isOrdering){
    let schedulingInfo;
    schedulingInfo = await openAIService.checkSchedulingIntent(message, conversationId);
    console.log("scheduling info: ", schedulingInfo)
    console.log(" ordering intent detected")
    const schedulingResult = await handleSchedulingFlow(conversation, message, schedulingInfo);
    
    // Add AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: schedulingResult.aiResponse.content,
      timestamp: new Date()
    });
    
    // Save the updated conversation
    await conversation.save();
    
    // Return the complete response
    return res.status(200).json({
      error: false,
      data: {
        conversationId: conversation._id,
        sessionId: conversation.sessionId,
        messages: conversation.messages,
        language: conversation.language,
        ...(schedulingResult.aiResponse.metadata || {})
      }
    });
  }
  if(response.isPreviousSchedules){
    if(conversation.userId == null){
      conversation.messages.push({
        role: 'assistant',
        content: "You must login to see your previous schedules"
      })
      await conversation.save();
      const responseData = {
        error: false,
        data: {
          conversationId: conversation._id,
          sessionId: conversation.sessionId,
          messages: conversation.messages,
          language: conversation.language,
          foodProducts: conversation.foodProducts || []
        }
      };
      
      console.log('Sending response with data:', JSON.stringify(responseData, null, 2));
      res.status(200).json(responseData);
      return;
    }else{
      try {
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        
        // Query calendar events from the database
        const events = await CalendarEvent.find({
          $or: [
            { userId: conversation.userId },
            { guestId: conversation.guestId }
          ],
          startDateTime: { $gte: oneYearAgo, $lte: now },
          status: { $ne: 'cancelled' }
        }).sort({ startDateTime: 1 });
    
        const schedules = events.data.items.map(event => ({
          summary: event.summary,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          status: event.status
        }));
    
        let message = schedules.length > 0 
          ? "Here are your previous schedules:\n" + 
            schedules.map((s, i) => 
              `${i+1}. ${s.summary} - From ${new Date(s.start).toLocaleString()} to ${new Date(s.end).toLocaleString()}`
            ).join('\n')
          : "You don't have any previous schedules.";
    
        conversation.messages.push({
          role: 'assistant',
          content: message
        });
        await conversation.save();
    
        const responseData = {
          error: false,
          data: {
            conversationId: conversation._id,
            sessionId: conversation.sessionId,
            messages: conversation.messages,
            language: conversation.language,
            foodProducts: conversation.foodProducts || []
          }
        };
        
        console.log('Sending response with data:', JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);
        return;
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        conversation.messages.push({
          role: 'assistant',
          content: "Sorry, I couldn't fetch your previous schedules. Please try again later."
        });
        await conversation.save();
        
        const responseData = {
          error: false,
          data: {
            conversationId: conversation._id,
            sessionId: conversation.sessionId,
            messages: conversation.messages,
            language: conversation.language,
            foodProducts: conversation.foodProducts || []
          }
        };
        
        res.status(200).json(responseData);
        return;
      }
    }

  }
        // Add AI response to conversation
        conversation.messages.push({
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error processing message with OpenAI:', error);
        aiResponse = {
          content: "I'm having trouble processing your request. Please try again or contact support if the issue persists."
        };
        conversation.messages.push({
          role: 'assistant',
          content: aiResponse.content,
          timestamp: new Date()
        });
      }
    }

    // Save and return updated conversation
    await conversation.save();
    const updatedConversation = await Conversation.findById(conversation._id).lean().exec();
    console.log("done with the message sending");
    
    res.json({
      success: true,
      data: {
        ...updatedConversation,
        foodProducts: updatedConversation.foodProducts || []
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: true,
      message: 'Error sending message: ' + error.message
    });
  }
};

async function handleSchedulingFlow(conversation, userMessage, schedulingInfo) {
  try {
    console.log('Scheduling info received:', JSON.stringify(schedulingInfo, null, 2));
    
    // If we already have all scheduling info, create the appointment
    if (schedulingInfo.hasDate && schedulingInfo.hasTime && schedulingInfo.serviceType) {
      // Use the dateTime from schedulingInfo if available, otherwise use current date/time
      let startDateTime = schedulingInfo.dateTime ? new Date(schedulingInfo.dateTime) : new Date();
      
      // Validate the date
      if (isNaN(startDateTime.getTime())) {
        console.error('Invalid date received:', schedulingInfo.dateTime);
        throw new Error('Invalid date/time provided');
      }
      
      // Log the original and local times for debugging
      console.log('Original date from AI:', schedulingInfo.dateTime);
      console.log('Parsed date (local):', startDateTime.toString());
      console.log('ISO string:', startDateTime.toISOString());
      
      // Use the exact time provided by the user
      const serviceType = schedulingInfo.serviceType || 'auto service';
      const timeZone = 'Europe/Bucharest';
      const timeZoneOffset = '+03:00'; // Romania is always UTC+3
      
      // Use the exact date and time from the AI response
      const localDateTime = new Date(startDateTime);
      const endDateTime = new Date(localDateTime.getTime() + (30 * 60000));
      
      // Log the scheduling details for debugging
      console.log('Scheduling details:', {
        input: startDateTime.toISOString(),
        localDateTime: localDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        timeZone: timeZone,
        timeZoneOffset: timeZoneOffset
      });
      
      const eventDetails = {
        title: `${serviceType} Appointment`,
        description: `Appointment for ${serviceType}`,
        startDateTime: localDateTime,
        endDateTime: new Date(localDateTime.getTime() + (30 * 60000)),
        serviceType: serviceType,
        timeZone: timeZone,
        timeZoneOffset: '+03:00' // Romania is UTC+3
      };
      
      console.log('Event details:', {
        startTime: localDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        timeZone: timeZone
      });
      
      try {
        // For guest users, we'll use the conversation ID as guestId
        const userId = conversation.userId || null;
        const guestId = !userId ? `guest-${conversation._id}` : null;
        
        // After this line in handleSchedulingFlow:
const appointment = await calendarService.createEvent(
  userId,
  conversation._id,
  eventDetails,
  guestId
);
const formatDateTime = (date) => {
  // Format the date in Romania timezone
  const dateStr = date.toLocaleDateString('en-US', {
    timeZone: 'Europe/Bucharest',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Format the time in Romania timezone
  const timeStr = date.toLocaleTimeString('en-US', {
    timeZone: 'Europe/Bucharest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  return {
    formattedDate: dateStr,
    formattedTime: timeStr
  };
};

const { formattedDate, formattedTime } = formatDateTime(localDateTime);

// Add this ticket creation code:
const ticketData = {
  subject: `Service Appointment: ${serviceType}`,
  description: `Appointment for ${serviceType} scheduled for ${formattedDate} at ${formattedTime}`,
  priority: 'medium', // or determine based on service type
  status: 'open',
  type: 'service_appointment',
  metadata: {
    appointmentId: appointment._id.toString(),
    serviceType: serviceType,
    appointmentDate: localDateTime.toISOString(),
    timeZone: timeZone,
    conversationId: conversation._id.toString()
  },
  requester: conversation.userId ? {
    id: conversation.userId.toString(),
    type: 'user'
  } : {
    id: `guest-${conversation._id}`,
    type: 'guest'
  }
};

// Create the ticket
let ticketId;
try {
  ticketId = await ticketService.createTicket(ticketData);
  console.log('Created ticket for appointment:', ticketId);
  
  // Update the appointment with the ticket ID
  appointment.ticketId = ticketId;
  await appointment.save();
} catch (ticketError) {
  console.error('Error creating ticket:', ticketError);
 
}
        
        // Format date and time in the Romania timezone
       
        // Log the formatted time for debugging
        console.log('Formatted date/time:', { 
          original: startDateTime.toString(),
          iso: startDateTime.toISOString(),
          formattedDate, 
          formattedTime,
          timeZone: eventDetails.timeZone
        });

        // Create the response message
        const responseMessage = `Your ${serviceType} appointment has been scheduled. `;
        
        // Prepare response with auto-redirect to Google Calendar if link is available
        const response = {
          aiResponse: {
            content: responseMessage,
            metadata: { 
              isAppointmentScheduled: true,
              shouldRedirect: !!appointment.googleCalendarLink,
              redirectUrl: appointment.googleCalendarLink || '',
              appointmentDetails: {
                ...appointment.toObject(),
                formattedDate,
                formattedTime,
                timeZone: eventDetails.timeZone,
                googleCalendarLink: appointment.googleCalendarLink || ''
              },
              actions: [
                {
                  type: 'link',
                  text: '📅 Add to Google Calendar',
                  url: appointment.googleCalendarLink || '#',
                  style: 'primary',
                  icon: 'calendar'
                },
                {
                  type: 'button',
                  text: '📩 Send me the details',
                  action: 'send_details',
                  style: 'secondary'
                }
              ]
            }
          },
          conversation
        };

        console.log('Scheduling response:', JSON.stringify(response, null, 2));
        return response;
      } catch (error) {
        console.error('Error creating calendar event:', error);
        return {
          aiResponse: {
            content: `❌ I'm having trouble scheduling your appointment. Please try again later or contact support.\n\nError: ${error.message}`,
            metadata: { 
              error: error.message,
              actions: [
                {
                  type: 'button',
                  text: '🔄 Try Again',
                  action: 'retry_scheduling',
                  style: 'primary'
                },
                {
                  type: 'button',
                  text: '📞 Contact Support',
                  action: 'contact_support',
                  style: 'secondary'
                }
              ]
            }
          },
          conversation
        };
      }
    }

    // If we're missing some info, ask for it
    let nextQuestion = '';
    if (!schedulingInfo.serviceType) {
      nextQuestion = "What type of service would you like to schedule? (e.g., auto service, consultation)";
    } else if (!schedulingInfo.hasDate) {
      nextQuestion = `For your service, what date would you prefer? (e.g., tomorrow, next Monday, or a specific date)`;
    } else if (!schedulingInfo.hasTime) {
      nextQuestion = `What time would you prefer for your service ? (e.g., 2pm, 14:00)`;
    }

    // Update conversation with current scheduling state
    conversation.schedulingState = schedulingInfo;
    await conversation.save();

    return {
      aiResponse: {
        content: nextQuestion,
        metadata: { 
          requiresUserInput: true,
          schedulingState: schedulingInfo
        }
      },
      conversation
    };
  } catch (error) {
    console.error('Error in scheduling flow:', error);
    return {
      aiResponse: {
        content: "I'm having trouble scheduling your appointment. Please try again later or contact support.",
        metadata: { error: error.message }
      },
      conversation
    };
  }
}

// Then update the sendMessage function to use handleSchedulingFlow
// Find the code around line 180 in chat.controller.js and replace it with:

async function checkProductSearchIntent(message, conversationHistory = []) {
  try {
    const prompt = `Analyze the following conversation and determine if the user wants to search for products or services.
    
Previous Conversation:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current Message: "${message}"

Extract the following:
1. isProductSearch - true if the user wants to search for products
2. productQuery - what the user is looking for (e.g., "pizza", "Italian food", "car wash")
3. isOrdering - true if the user wants to order a specific product mentioned earlier
4. productDetails - if ordering, extract product name, quantity, and any special instructions

Respond in JSON format:
{
  "isProductSearch": boolean,
  "productQuery": "string or null",
  "isOrdering": boolean,
  "productDetails": {
    "name": "string or null",
    "quantity": "number or null",
    "specialInstructions": "string or null"
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { 
          role: "system", 
          content: "You are a helpful assistant that analyzes user intents. Focus on identifying product searches and ordering intents." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error checking product search intent:', error);
    return {
      isProductSearch: false,
      productQuery: null,
      isOrdering: false,
      productDetails: null
    };
  }
}
async function handleProductOrder(conversation, orderInfo) {
  try {
    // Find the product in the last shown products
    const product = conversation.lastShownProducts?.find(p => 
      p.name.toLowerCase().includes(orderInfo.productName.toLowerCase())
    );

    if (!product) {
      return {
        aiResponse: { 
          content: `I couldn't find "${orderInfo.productName}" in the recent products. Could you please specify which product you'd like to order?` 
        },
        conversation
      };
    }

    // Here you would typically add the product to a cart or create an order
    // For example:
    // await orderService.createOrder({
    //   productId: product.id,
    //   quantity: orderInfo.quantity || 1,
    //   notes: orderInfo.additionalNotes
    // });

    return {
      aiResponse: { 
        content: `Great! I've added ${orderInfo.quantity || 1}x ${product.name} to your order. ${orderInfo.additionalNotes ? `Notes: ${orderInfo.additionalNotes}` : ''}` 
      },
      conversation
    };
  } catch (error) {
    console.error('Order processing error:', error);
    return {
      aiResponse: { 
        content: "I'm having trouble processing your order. Please try again or contact support if the issue persists." 
      },
      conversation
    };
  }
}
// Add this helper function to handle product search and ordering
async function handleProductSearch(conversation, message, searchInfo) {
  try {
    // If user is trying to order a product
    if (searchInfo.isOrdering && searchInfo.productDetails?.name) {
      const orderResult = await processProductOrder(conversation, searchInfo.productDetails);
      return {
        aiResponse: {
          content: orderResult.message,
          metadata: { orderDetails: orderResult.details }
        },
        conversation
      };
    }
    
    // If it's a product search
    if (searchInfo.isProductSearch && searchInfo.productQuery) {
      const products = await woocommerceService.searchProducts(searchInfo.productQuery);
      
      // Store the products for potential ordering
      conversation.lastShownProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        image: p.images?.[0]?.src || ''
      }));
      
      // Format products for display
      const productList = products.map(p => `- ${p.name} (${p.price || 'Price not available'})`).join('\n');
      
      return {
        aiResponse: {
          content: `Here are some ${searchInfo.productQuery} options:\n${productList}\n\nWould you like to order any of these?`,
          metadata: { 
            products,
            isProductList: true
          }
        },
        conversation
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error handling product search:', error);
    return {
      aiResponse: {
        content: "I'm having trouble finding products right now. Could you please try again or be more specific?",
        metadata: { error: error.message }
      },
      conversation
    };
  }
}

// Add this function to process product orders
async function processProductOrder(conversation, productDetails) {
  try {
    // Find the product in the database
    const product = await woocommerceService.findProductByName(productDetails.name);
    
    if (!product) {
      // Check if we have the product in the last shown products
      const lastShownProduct = conversation.lastShownProducts?.find(p => 
        p.name.toLowerCase().includes(productDetails.name.toLowerCase())
      );

      if (!lastShownProduct) {
        return {
          success: false,
          message: `I couldn't find "${productDetails.name}" in our menu. Could you please check the name and try again?`
        };
      }

      // Use the last shown product if available
      return {
        success: true,
        message: `Your order for ${productDetails.quantity || 1}x ${lastShownProduct.name} has been placed!`,
        details: {
          productId: lastShownProduct.id,
          quantity: productDetails.quantity || 1,
          specialInstructions: productDetails.specialInstructions
        }
      };
    }

    // Create order logic here
    // const order = await woocommerceService.createOrder({
    //   productId: product.id,
    //   quantity: productDetails.quantity || 1,
    //   specialInstructions: productDetails.specialInstructions
    // });

    return {
      success: true,
      message: `Your order for ${productDetails.quantity || 1}x ${product.name} has been placed!`,
      details: {
        productId: product.id,
        quantity: productDetails.quantity || 1,
        specialInstructions: productDetails.specialInstructions
      }
    };
  } catch (error) {
    console.error('Error processing order:', error);
    return {
      success: false,
      message: "I'm having trouble processing your order. Please try again or contact support if the issue persists."
    };
  }
}
// Add this helper function to your chat controller
async function detectProductOrdering(conversation, message) {
  try {
    const prompt = `Analyze the following conversation and user message to determine if the user wants to order a product.
    
Conversation History:
${conversation.messages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}

User Message: "${message}"

Respond with a JSON object containing:
- isOrdering (boolean): true if the user wants to order a product
- productName (string): name of the product if mentioned
- quantity (number): quantity if mentioned, default to 1
- additionalNotes (string): any special instructions

Example 1:
{"isOrdering": true, "productName": "Margherita Pizza", "quantity": 2, "additionalNotes": "Extra cheese"}

Example 2:
{"isOrdering": false}

Response:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    console.log('Product ordering detection:', result);
    return result;
  } catch (error) {
    console.error('Error detecting product ordering:', error);
    return { isOrdering: false };
  }
}
// Get conversation history
exports.getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    console.log('Fetching conversation:', conversationId);
    
    // Find conversation and convert to plain JavaScript object
    const conversation = await Conversation.findById(conversationId).lean();
    
    if (!conversation) {
      return res.status(404).json({
        error: true,
        message: 'Conversation not found'
      });
    }
    
    console.log('Returning conversation with foodProducts:', {
      messages: conversation.messages?.length,
      foodProducts: conversation.foodProducts?.length
    });
    
    // Ensure foodProducts is always an array in the response
    const responseData = {
      ...conversation,
      foodProducts: conversation.foodProducts || []
    };
    
    res.status(200).json({
      error: false,
      data: responseData
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting conversation',
      details: error.message
    });
  }
};

// Get all conversations for a user
exports.getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Find conversations with pagination
    const conversations = await Conversation.find()
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('_id intent language lastMessageAt operatorAssigned');
    
    // Get total count
    const total = await Conversation.countDocuments();
    
    res.status(200).json({
      error: false,
      data: {
        conversations,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting conversations'
    });
  }
};

// Handle special intents based on conversation
/**
 * Handle all user intents with a generic product search approach
 * @param {Object} conversation - The conversation object
 * @param {string} userMessage - The user's message
 * @param {Object} aiResponse - The current AI response object
 * @returns {Promise<Object>} Object containing updated aiResponse and conversation
 */
const handleIntent = async (conversation, userMessage, aiResponse) => {
  try {
    
    // Check if this is a request for human operator
    const isHumanRequested = await openAIService.isHumanOperatorRequested(userMessage);
    if (isHumanRequested) {
      await createTicketAndSendEmail(conversation, userMessage);
      conversation.operatorAssigned = true;
      aiResponse.content = "I've connected you with one of our human operators. They'll be with you shortly to assist you further.";
      return { aiResponse, conversation };
    }

    // If not scheduling or human operator request, proceed with product search
    let searchQuery = userMessage;
    let categorySlug = '';
    const prompt = `You are a search query optimizer for an e-commerce product search engine.

Your task is to extract only the essential search terms from the user's query, focusing on:
1. Product types (e.g., pizza, shoes, laptop)
2. Product attributes (e.g., Italian, leather, gaming)
3. Service categories (e.g., travel, cleaning, repair)

Remove filler words like:
- General request phrases ("find me", "looking for", "I want", "I need")
- Politeness markers ("please", "thank you")
- Articles and common prepositions when not essential to meaning

Return ONLY the essential search terms, nothing else. No explanations or additional text.

Examples:
- Input: "find me best pizza" → Output: "pizza"
- Input: "I need Italian pizza please" → Output: "Italian pizza"
- Input: "t please I am looking for travel and assistance services" → Output: "travel"
- Input: "can you show me red running shoes for men" → Output: "shoes"
-Input : "i need travel services to abu dhabi/any other locations "-> "travel"
-Input: "i need dog foods" -> "dog foods"
you must be smart to process the user query and return the most relevant search terms with tokenization and finding the relavent search keywords
means ignore all the things instead of one word that is representing main context dont include locations , types or other generics defined by user you have to be smart

User query: ${userMessage}`;

    const filteredQueryResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: prompt }
      ],
      temperature: 0.3
    });
    // Rest of your existing product search logic...
    const filteredQuery = filteredQueryResponse.choices[0].message.content.trim();
    console.log(`Original query: "${searchQuery}"`);
    console.log(`Filtered query for search: "${filteredQuery}"`);
    const products = await woocommerceLocalService.searchProducts(
      filteredQuery,
      categorySlug
    );

    if (products?.length > 0) {
      const relevantProducts = await openAIService.filterRelevantProducts(
        searchQuery,
        products,
        conversation.language
      );
    console.log("relevant products are ",relevantProducts);
      conversation.foodProducts = relevantProducts.length > 0 ? relevantProducts : products;
      await conversation.save();
      
      let aiResponseText = await openAIService.generateProductIntroduction(
        userMessage,
        searchQuery,
        conversation.foodProducts.length,
        conversation.language
      );
      console.log("done with extra fine tuning");
      if (!aiResponseText) {
        aiResponseText = `I found ${products.length} items matching "${searchQuery}". `;
        const responses = [
          "Here's what I found in our catalog:",
          "I found these options for you:",
          "Here are some options that might interest you:",
          "I found these products that match your request:"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        aiResponseText = `${randomResponse} (${products.length} items found)`;
      }
      
      aiResponse.content = aiResponseText;
    } else {
      aiResponse.content = `I couldn't find any products matching "${searchQuery}" in our database. `;
      const suggestions = [
        "Could you try a different search term?",
        "Would you like to try a broader category?",
        "I can help you find something similar if you'd like.",
        "Would you like me to check for related items?"
      ];
      
      aiResponse.content += suggestions[Math.floor(Math.random() * suggestions.length)];
    }

    return { aiResponse, conversation };

  } catch (error) {
    console.error('Error in handleIntent:', error);
    aiResponse.content = "I encountered an error while processing your request. Please try again or rephrase your question.";
    return { aiResponse, conversation };
  }
};
const checkForHumanHandover = async (conversation) => {
  // Don't hand over if we're in the middle of booking or handling a specific issue
  if (conversation.metadata?.bookingInProgress || 
      conversation.metadata?.bookingInfo?.serviceType === 'Brake Inspection') {
    return false;
  }

  // Existing handover logic...
  const lastUserMessage = conversation.messages
    .filter(msg => msg.role === 'user')
    .pop();
    
  if (lastUserMessage) {
    const lowerMessage = lastUserMessage.content.toLowerCase();
    // Only hand over if explicitly requested
    return (
      lowerMessage.includes('speak to human') || 
      lowerMessage.includes('talk to agent') ||
      lowerMessage.includes('human operator') ||
      lowerMessage.includes('real person')
    );
  }
  
  return false;
};

// Get handover message based on language
const getHandoverMessage = (language) => {
  const messages = {
    en: "I'm transferring you to a human operator who will continue this conversation. Please wait a moment.",
    fr: "Je vous transfère à un opérateur humain qui continuera cette conversation. Veuillez patienter un moment.",
    ro: "Vă transfer către un operator uman care va continua această conversație. Vă rog să așteptați un moment."
  };
  
  return messages[language] || messages.en;
};

const extractEventDetails = async (userMessage, aiResponse, language) => {
  try {
    const prompt = `Extract the following information from this conversation in JSON format:
      - title: Title of the event (default to "Service Appointment" if unclear)
      - startDateTime: Date and time for the appointment in ISO format (REQUIRED)
      - endDateTime: End time in ISO format (REQUIRED)
      - location: Location of the appointment (default to "To be determined" if not specified)
      - description: Brief description of the purpose
      
      User message: ${userMessage}
      Assistant response: ${aiResponse}
      
      If any REQUIRED field is missing, return null for that field.
      Respond with ONLY valid JSON, no other text.`;

    const completion = await openAIService.processMessage(
      [{ role: 'user', content: prompt }],
      'system',
      'eventExtraction',
      language
    );
    
    try {
      const eventData = JSON.parse(completion.content);
      
      // Validate required fields
      if (!eventData.startDateTime || !eventData.endDateTime) {
        console.log('Missing required date fields in event data');
        return null;
      }
      
      // Ensure dates are valid
      const start = new Date(eventData.startDateTime);
      const end = new Date(eventData.endDateTime);
      
      if (isNaN(start) || isNaN(end)) {
        console.log('Invalid date format in event data');
        return null;
      }
      
      // Set defaults if missing
      return {
        title: eventData.title || 'Service Appointment',
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        location: eventData.location || 'To be determined',
        description: eventData.description || 'Auto service appointment'
      };
    } catch (err) {
      console.error('Failed to parse event details:', err);
      return null;
    }
  } catch (error) {
    console.error('Extract event details error:', error);
    return null;
  }
};

// Extract service type from message
const extractServiceType = (message) => {
  const serviceTypes = [
    'auto', 'car', 'vehicle', 'brake', 'tire', 'engine',
    'plumbing', 'electrical', 'appliance', 'heating', 'cooling',
    'cleaning', 'maintenance', 'repair'
  ];
  
  const lowerMessage = message.toLowerCase();
  
  for (const type of serviceTypes) {
    if (lowerMessage.includes(type)) {
      return type;
    }
  }
  
  return 'general';
};

// Create ticket and send email notification
const createTicketAndSendEmail = async (conversation, message) => {
  try {
    console.log('Creating ticket for conversation:', conversation._id);
    
    // Extract relevant information
    const userName = conversation.userName || 'Anonymous User';
    const userEmail = conversation.userEmail || 'no-email@provided.com';
    const userMessage = typeof message === 'string' ? message : 
                       (message.content || conversation.messages[conversation.messages.length - 1].content);
    
    // Create ticket in ticketing system
    const ticketData = {
      subject: `Chat Support Request - ${conversation._id}`,
      description: `User ${userName} has requested human assistance.\n\nLatest message: ${userMessage}`,
      requester: {
        name: userName,
        email: userEmail
      },
      conversationId: conversation._id,
      priority: 'medium',
      type: 'support'
    };
    
    // Use ticket service to create ticket
    let ticketId;
    if (ticketService && typeof ticketService.createTicket === 'function') {
      const ticket = await ticketService.createTicket(ticketData);
      ticketId = ticket.id;
      // Save ticket ID to conversation
      conversation.ticketId = ticketId;
    } else {
      console.warn('Ticket service not available or createTicket method not found');
      // Generate a mock ticket ID if service is not available
      ticketId = `MOCK-${Date.now()}`;
      conversation.ticketId = ticketId;
    }
    
    // Send email notification
    const emailContent = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || process.env.EMAIL_USER, // Default to sender if no operator email
      subject: `New Support Request - Ticket #${ticketId}`,
      html: `
        <h2>New Support Request</h2>
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        <p><strong>User:</strong> ${userName}</p>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Conversation ID:</strong> ${conversation._id}</p>
        <p><strong>Latest Message:</strong></p>
        <p>${userMessage}</p>
        <p><a href="${process.env.ADMIN_URL || 'http://localhost:3001'}/api/chat/${conversation._id}">View Conversation</a></p>
      `
    };
    
    if (emailTransporter) {
      await emailTransporter.sendMail(emailContent);
      console.log(`Email notification sent for ticket ${ticketId}`);
    } else {
      console.warn('Email transporter not configured');
    }
    
    // Update conversation status
    conversation.operatorAssigned = true;
    conversation.ticketStatus = 'open';
    await conversation.save();
    
    return ticketId;
  } catch (error) {
    console.error('Error creating ticket and sending email:', error);
    // Don't throw - let the conversation continue even if ticket creation fails
    return null;
  }
};
