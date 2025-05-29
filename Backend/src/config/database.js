const mongoose = require('mongoose');

// MongoDB connection with error handling
const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'production' 
      ? process.env.MONGODB_URI_PROD 
      : process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MongoDB connection URI is not defined in environment variables');
    }
    
    const conn = await mongoose.connect(mongoURI, {
      // Connection options are auto-applied in Mongoose 6+
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
