require('dotenv').config();
const mongoose = require('mongoose');
const woocommerceSyncService = require('../services/woocommerce-sync.service');

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'production' 
      ? process.env.MONGODB_URI_PROD 
      : process.env.MONGODB_URI;
    
    console.log(`Connecting to MongoDB: ${mongoURI.substring(0, 20)}...`);
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Run initial sync
const runInitialSync = async () => {
  try {
    console.log('Starting initial WooCommerce sync...');
    
    // Step 1: Sync all categories
    console.log('Syncing categories...');
    const categoryResult = await woocommerceSyncService.syncCategories();
    console.log('Categories sync completed:', categoryResult.message);
    
    // Step 2: Sync all products
    console.log('Syncing all products (this may take several minutes)...');
    const productResult = await woocommerceSyncService.syncAllProducts();
    console.log('Products sync completed:', productResult.message);
    
    console.log('Initial sync completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during initial sync:', error);
    process.exit(1);
  }
};

// Execute
connectDB().then(() => {
  runInitialSync();
});
