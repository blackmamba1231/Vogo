const cron = require('node-cron');
const ticketService = require('../services/ticket.service');
const User = require('../models/user.model');
const Conversation = require('../models/conversation.model');
const CalendarEvent = require('../models/calendar-event.model');
const woocommerceSyncService = require('../services/woocommerce-sync.service');

// Initialize all cron jobs
exports.initCronJobs = () => {
  console.log('Initializing cron jobs...');
  
  // Sync pending tickets - every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('Running cron job: Sync pending tickets');
    try {
      const result = await ticketService.syncPendingTickets();
      console.log(`Synced ${result.syncCount} pending tickets`);
    } catch (error) {
      console.error('Error in sync pending tickets cron job:', error);
    }
  });
  
  // Clean up inactive conversations - once a day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('Running cron job: Clean up inactive conversations');
    try {
      // Find conversations inactive for more than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await Conversation.updateMany(
        {
          lastMessageAt: { $lt: thirtyDaysAgo },
          isActive: true
        },
        {
          $set: { isActive: false }
        }
      );
      
      console.log(`Deactivated ${result.modifiedCount} inactive conversations`);
    } catch (error) {
      console.error('Error in clean up conversations cron job:', error);
    }
  });
  
  // Send calendar event reminders - every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running cron job: Send calendar event reminders');
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now);
      oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
      
      // Find events happening in the next 24 hours that need reminders
      const upcomingEvents = await CalendarEvent.find({
        startDateTime: { $gte: now, $lte: oneDayFromNow },
        status: { $in: ['pending', 'confirmed'] },
        reminderSent: { $ne: true }
      }).populate('userId', 'email firstName lastName');
      
      for (const event of upcomingEvents) {
        try {
          // Send reminder logic would go here
          // For now, just mark as reminded
          event.reminderSent = true;
          await event.save();
        } catch (eventError) {
          console.error(`Error processing reminder for event ${event._id}:`, eventError);
        }
      }
      
      console.log(`Processed reminders for ${upcomingEvents.length} upcoming events`);
    } catch (error) {
      console.error('Error in calendar reminders cron job:', error);
    }
  });
  
  // Process expired JWT tokens - every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running cron job: Clean up expired tokens');
    try {
      // Redis cleanup would typically be handled by TTL expiration
      // Any additional token cleanup logic would go here
      
      console.log('Token cleanup completed');
    } catch (error) {
      console.error('Error in token cleanup cron job:', error);
    }
  });
  
  // Update language models (if needed) - once a week on Sunday at 2:00 AM
  cron.schedule('0 2 * * 0', async () => {
    console.log('Running cron job: Update language models');
    try {
      // Any model update or maintenance logic would go here
      console.log('Language model updates checked');
    } catch (error) {
      console.error('Error in language model update cron job:', error);
    }
  });
  
  // Sync WooCommerce categories - once a day at 1:00 AM
  cron.schedule('0 1 * * *', async () => {
    console.log('Running cron job: Sync WooCommerce categories');
    try {
      const result = await woocommerceSyncService.syncCategories();
      console.log(`WooCommerce categories sync completed: ${result.message}`);
    } catch (error) {
      console.error('Error in WooCommerce categories sync cron job:', error);
    }
  });
  
  // Incremental sync of WooCommerce products - every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('Running cron job: Incremental WooCommerce products sync');
    try {
      const result = await woocommerceSyncService.syncProductsIncremental();
      console.log(`WooCommerce incremental products sync: ${result.message}`);
    } catch (error) {
      console.error('Error in WooCommerce incremental products sync cron job:', error);
    }
  });
  
  // Full sync of WooCommerce products - once a week on Sunday at 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('Running cron job: Full WooCommerce products sync');
    try {
      const result = await woocommerceSyncService.syncAllProducts();
      console.log(`WooCommerce full products sync completed: ${result.message}`);
    } catch (error) {
      console.error('Error in WooCommerce full products sync cron job:', error);
    }
  });

  console.log('All cron jobs initialized successfully');
};
