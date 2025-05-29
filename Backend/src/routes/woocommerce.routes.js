const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const wooCommerceService = require('../services/woocommerce.service');
const logger = require('../utils/logger');

// Public routes (no authentication required)

// Get all products with pagination
router.get('/all-products', async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    
    logger.info(`API: Getting all products, page=${page}, perPage=${per_page}`);
    const result = await wooCommerceService.getAllProducts(
      parseInt(page),
      parseInt(per_page)
    );
    
    res.status(200).json({
      error: false,
      data: result
    });
  } catch (error) {
    logger.error(`API: Get all products error: ${error.message}`);
    res.status(500).json({
      error: true,
      message: 'Error getting all products'
    });
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    logger.info('API: Getting all categories');
    const categories = await wooCommerceService.getAllCategories();
    
    res.status(200).json({
      error: false,
      data: { categories }
    });
  } catch (error) {
    logger.error(`API: Get all categories error: ${error.message}`);
    res.status(500).json({
      error: true,
      message: 'Error getting all categories'
    });
  }
});

// Modified product search route to allow empty query for browsing
router.get('/products', async (req, res) => {
  try {
    const { query = '', category = '', per_page = 10 } = req.query;
    
    logger.info(`API: Searching products with query="${query}", category="${category}", perPage=${per_page}`);
    const products = await wooCommerceService.searchProducts(
      query,
      category,
      parseInt(per_page)
    );
    
    res.status(200).json({
      error: false,
      data: { products }
    });
  } catch (error) {
    logger.error(`API: Search products error: ${error.message}`);
    res.status(500).json({
      error: true,
      message: 'Error searching products'
    });
  }
});

// Apply auth middleware to protected WooCommerce routes
router.use(authMiddleware);

// Search restaurants by location
router.get('/restaurants', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({
        error: true,
        message: 'Location parameter is required'
      });
    }
    
    const restaurants = await wooCommerceService.searchRestaurants(location);
    
    res.status(200).json({
      error: false,
      data: { restaurants }
    });
  } catch (error) {
    console.error('Search restaurants error:', error);
    res.status(500).json({
      error: true,
      message: 'Error searching restaurants'
    });
  }
});

// Search services by location and type
router.get('/services', async (req, res) => {
  try {
    const { location, type } = req.query;
    
    if (!location) {
      return res.status(400).json({
        error: true,
        message: 'Location parameter is required'
      });
    }
    
    const services = await wooCommerceService.searchServices(location, type);
    
    res.status(200).json({
      error: false,
      data: { services }
    });
  } catch (error) {
    console.error('Search services error:', error);
    res.status(500).json({
      error: true,
      message: 'Error searching services'
    });
  }
});

// Get product details
router.get('/products/:productId', async (req, res) => {
  try {
    const product = await wooCommerceService.getProductById(req.params.productId);
    
    if (!product) {
      return res.status(404).json({
        error: true,
        message: 'Product not found'
      });
    }
    
    res.status(200).json({
      error: false,
      data: { product }
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting product details'
    });
  }
});

// This route is now defined above as a public route

// Add to cart
router.post('/cart/add', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id;
    
    if (!productId) {
      return res.status(400).json({
        error: true,
        message: 'Product ID is required'
      });
    }
    
    const result = await wooCommerceService.addToCart(
      userId,
      productId,
      quantity || 1
    );
    
    if (!result.success) {
      return res.status(400).json({
        error: true,
        message: result.error || 'Failed to add item to cart'
      });
    }
    
    res.status(200).json({
      error: false,
      message: 'Item added to cart successfully',
      data: result
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      error: true,
      message: 'Error adding item to cart'
    });
  }
});

// Get cart contents
router.get('/cart', async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await wooCommerceService.getCart(userId);
    
    if (!cart.success) {
      return res.status(400).json({
        error: true,
        message: cart.error || 'Failed to get cart'
      });
    }
    
    res.status(200).json({
      error: false,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting cart contents'
    });
  }
});

module.exports = router;
