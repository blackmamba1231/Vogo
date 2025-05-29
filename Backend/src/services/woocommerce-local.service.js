const logger = require('../utils/logger');
const Product = require('../models/product.model');
const Category = require('../models/category.model');

class WooCommerceLocalService {
  constructor() {
    // Nothing to initialize
  }

  /**
   * Search for products in the local database
   * @param {string} query - Search query
   * @param {string|number} category - Category ID or slug
   * @param {number} perPage - Number of products to return
   * @returns {Promise<Array>} Array of products
   */
  async searchProducts(query, category = '', perPage = 10) {
    try {
      logger.info(`WooCommerce Local: Searching for products with query="${query}", category="${category}", perPage=${perPage}`);
      // Add this near the top of the searchProducts function, after the query and category parameters
// Clean up the query by removing any intent prefixes
const cleanQuery = query ? query.replace(/^(general|food_order|service_booking|product_search)\s*/i, '').trim() : '';

// Add this special handling for service-related queries
const isServiceQuery = cleanQuery.toLowerCase().includes('service') || 
                      cleanQuery.toLowerCase().includes('repair') ||
                      cleanQuery.toLowerCase().includes('maintenance') ||
                      (category && category.toLowerCase().includes('service'));

if (isServiceQuery) {
  logger.info('WooCommerce Local: Service-related query detected, searching in service categories');
  
  // First, try to find a service category
  const serviceCategories = await Category.find({
    $or: [
      { name: { $regex: /service/i } },
      { slug: { $regex: /service/i } },
      { name: { $regex: /auto/i } },
      { slug: { $regex: /auto/i } },
      { name: { $regex: /car/i } },
      { slug: { $regex: /car/i } }
    ]
  });

  // Get all service category IDs
  const serviceCategoryIds = serviceCategories.map(cat => cat.categoryId);
  
  // Try to find products in service categories
  let serviceProducts = [];
  
  if (serviceCategoryIds.length > 0) {
    serviceProducts = await Product.find({
      'categories.id': { $in: serviceCategoryIds }
    }).limit(perPage);
  }
  
  // If no products found by category, try text search in product name/description
  if (serviceProducts.length === 0) {
    serviceProducts = await Product.find({
      $or: [
        { name: { $regex: /service/i } },
        { description: { $regex: /service/i } },
        { name: { $regex: /auto/i } },
        { description: { $regex: /auto/i } },
        { name: { $regex: /car/i } },
        { description: { $regex: /car/i } }
      ]
    }).limit(perPage);
  }
  
  if (serviceProducts.length > 0) {
    logger.info(`WooCommerce Local: Found ${serviceProducts.length} service-related products`);
    return this.formatProducts(serviceProducts);
  }
}

// Then continue with the existing search logic...
      // IMPORTANT: Handle the two different URL structures
      // 1. For restaurant categories: product-category/food-delivery/restaurante/
      // 2. For specific products: product/pizza
      
      // Check if the category is a path that includes product-category
      const isRestaurantCategory = category && (
        category.includes('food-delivery/restaurante') || 
        category.includes('traditional-menu') || 
        category.includes('italian-specialties') || 
        category.includes('vegan-fit-sport') || 
        category.includes('sushi-asiatic')
      );
      
      // Extract the actual category slug from the path if needed
      let categorySlug = category;
      if (isRestaurantCategory && category.includes('/')) {
        // Extract the last part of the path as the category slug
        const pathParts = category.split('/');
        categorySlug = pathParts[pathParts.length - 1];
        if (categorySlug === '') {
          // If empty (trailing slash), use the second-to-last part
          categorySlug = pathParts[pathParts.length - 2];
        }
        logger.info(`WooCommerce Local: Extracted category slug '${categorySlug}' from path '${category}'`);
      }
      
      let filter = {};
      
      // Step 1: Try direct category ID search if category is numeric
      if (categorySlug && !isNaN(categorySlug)) {
        logger.info(`WooCommerce Local: Searching by category ID: ${categorySlug}`);
        filter['categories.id'] = parseInt(categorySlug);
      }
      // Step 2: If category is a string, try to find the category by slug
      else if (categorySlug && isNaN(categorySlug)) {
        logger.info(`WooCommerce Local: Looking up category for: ${categorySlug}`);

        // First try to find the category in our local database
        const categoryMatch = await Category.findOne({
          $or: [
            { slug: { $regex: new RegExp(categorySlug, 'i') } },
            { name: { $regex: new RegExp(categorySlug, 'i') } }
          ]
        });

        if (categoryMatch) {
          logger.info(`WooCommerce Local: Found category match: ${categoryMatch.name} (ID: ${categoryMatch.categoryId})`);
          filter['categories.id'] = categoryMatch.categoryId;
        } else {
          // If no direct match, try to match by slug pattern
          logger.info(`WooCommerce Local: No exact category match, trying pattern matching for: ${categorySlug}`);
          filter['categories.slug'] = { $regex: new RegExp(categorySlug, 'i') };
        }
      }

      // Step 3: Add text search if query is provided
      if (query && query.trim() !== '') {
        // If we already have a category filter, combine it with the text search
        if (Object.keys(filter).length > 0) {
          filter = {
            $and: [
              filter,
              { $text: { $search: query } }
            ]
          };
        } else {
          // Just use text search
          filter = { $text: { $search: query } };
        }
      }

      // Step 4: If no filters applied, return latest products
      if (Object.keys(filter).length === 0) {
        logger.info('WooCommerce Local: No filters applied, returning latest products');
        const latestProducts = await Product.find()
          .sort({ createdAt: -1 })
          .limit(perPage);
        
        return this.formatProducts(latestProducts);
      }

      // Execute the query with text score sorting if text search is being used
      let products;
      if (filter.$text) {
        products = await Product.find(filter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(perPage);
      } else {
        products = await Product.find(filter)
          .sort({ createdAt: -1 })
          .limit(perPage);
      }

      logger.info(`WooCommerce Local: Found ${products.length} products`);
      
      // If no products found and we were looking for a category, try a fallback
      if (products.length === 0 && categorySlug) {
        logger.info('WooCommerce Local: No products found with category filter, trying fallback');
        
        // Try a more flexible category search
        const flexProducts = await Product.find({ 
          $or: [
            { 'categories.name': { $regex: new RegExp(categorySlug, 'i') } },
            { 'categories.slug': { $regex: new RegExp(categorySlug, 'i') } }
          ]
        }).limit(perPage);
        
        if (flexProducts.length > 0) {
          logger.info(`WooCommerce Local: Found ${flexProducts.length} products with flexible category search`);
          products = flexProducts;
        }
      }
      
      // Special handling for Asian food queries
      if ((query?.toLowerCase().includes('asian') || 
           query?.toLowerCase().includes('chinese') || 
           query?.toLowerCase().includes('japanese') || 
           query?.toLowerCase().includes('thai') || 
           query?.toLowerCase().includes('sushi') || 
           category?.toLowerCase().includes('asian') || 
           category?.toLowerCase().includes('sushi') || 
           category?.toLowerCase() === 'asian food' || 
           category?.toLowerCase() === 'sushi-asiatic' || 
           category?.toLowerCase().includes('food-delivery/restaurante/sushi-asiatic') || 
           category?.toLowerCase().includes('product-category/food-delivery/restaurante/sushi-asiatic'))) {
        
        logger.info('WooCommerce Local: Specific search for Asian food/sushi-asiatic category');
        
        // First try with exact category match
        const asianProducts = await Product.find({
          $or: [
            { 'categories.slug': 'sushi-asiatic' },
            { 'categories.slug': 'asian-food' },
            { 'categories.slug': 'sushi' },
            { 'categories.name': 'Asian Food' },
            { 'categories.name': 'Sushi - Asiatic' },
            { 'categories.name': 'SUSHI - ASIATIC' }
          ]
        }).limit(perPage);
        
        if (asianProducts.length > 0) {
          logger.info(`WooCommerce Local: Found ${asianProducts.length} Asian food products by exact category match`);
          return this.formatProducts(asianProducts);
        }
        
        // If no exact matches, try broader search
        logger.info('WooCommerce Local: Trying broader search for Asian food');
        const broadAsianProducts = await Product.find({
          $or: [
            // Category slug patterns
            { 'categories.slug': { $regex: /asia/i } },
            { 'categories.slug': { $regex: /sushi/i } },
            { 'categories.slug': { $regex: /chinese/i } },
            { 'categories.slug': { $regex: /japanese/i } },
            { 'categories.slug': { $regex: /thai/i } },
            
            // Category name patterns
            { 'categories.name': { $regex: /asia/i } },
            { 'categories.name': { $regex: /sushi/i } },
            { 'categories.name': { $regex: /chinese/i } },
            { 'categories.name': { $regex: /japanese/i } },
            { 'categories.name': { $regex: /thai/i } },
            
            // Product name patterns
            { name: { $regex: /asia/i } },
            { name: { $regex: /sushi/i } },
            { name: { $regex: /chinese/i } },
            { name: { $regex: /japanese/i } },
            { name: { $regex: /thai/i } },
            { name: { $regex: /maki/i } },
            { name: { $regex: /roll/i } },
            
            // Product description patterns
            { description: { $regex: /asia/i } },
            { description: { $regex: /sushi/i } },
            { description: { $regex: /chinese/i } },
            { description: { $regex: /japanese/i } },
            { description: { $regex: /thai/i } }
          ]
        }).limit(perPage);
        
        if (broadAsianProducts.length > 0) {
          logger.info(`WooCommerce Local: Found ${broadAsianProducts.length} Asian food products by broader search`);
          return this.formatProducts(broadAsianProducts);
        }
        
        // Try one more approach - look for products in the restaurant category
        logger.info('WooCommerce Local: Trying restaurant category search for Asian food');
        const restaurantAsianProducts = await Product.find({
          $and: [
            { 'categories.slug': { $regex: /restaurant/i } },
            { $or: [
              { name: { $regex: /asia/i } },
              { name: { $regex: /sushi/i } },
              { name: { $regex: /chinese/i } },
              { name: { $regex: /japanese/i } },
              { name: { $regex: /thai/i } }
            ]}
          ]
        }).limit(perPage);
        
        if (restaurantAsianProducts.length > 0) {
          logger.info(`WooCommerce Local: Found ${restaurantAsianProducts.length} Asian restaurant products`);
          return this.formatProducts(restaurantAsianProducts);
        }
      }
      
      // Final fallback: If it's a food-related query but no products found
      if (products.length === 0 && 
          (query?.toLowerCase().includes('food') || 
           query?.toLowerCase().includes('meal') || 
           query?.toLowerCase().includes('eat') || 
           category?.toLowerCase().includes('food') || 
           category?.toLowerCase().includes('restaurant'))) {
        
        logger.info('WooCommerce Local: Trying fallback to general food categories');
        const foodProducts = await Product.find({
          $or: [
            { 'categories.slug': 'food-delivery' },
            { 'categories.slug': 'restaurant' },
            { 'categories.slug': 'food' }
          ]
        }).limit(perPage);
        
        if (foodProducts.length > 0) {
          logger.info(`WooCommerce Local: Found ${foodProducts.length} products by food fallback`);
          products = foodProducts;
        }
      }
      // Add this before the final return in the function
if (products.length === 0 && cleanQuery) {
  logger.info('WooCommerce Local: No products found with initial query, trying broader search');
  
  // Try a more flexible search by splitting the query into words
  const queryWords = cleanQuery.split(/\s+/).filter(Boolean);
  
  if (queryWords.length > 1) {
    // Try searching for each word individually
    for (const word of queryWords) {
      if (word.length < 3) continue; // Skip very short words
      
      const wordProducts = await Product.find({
        $or: [
          { name: { $regex: new RegExp(word, 'i') } },
          { description: { $regex: new RegExp(word, 'i') } },
          { 'categories.name': { $regex: new RegExp(word, 'i') } },
          { 'categories.slug': { $regex: new RegExp(word, 'i') } }
        ]
      }).limit(perPage);
      
      if (wordProducts.length > 0) {
        logger.info(`WooCommerce Local: Found ${wordProducts.length} products matching word: ${word}`);
        return this.formatProducts(wordProducts);
      }
    }
  }
  
  // If still no results, try to find any products with similar names
  const similarProducts = await Product.find({
    $or: [
      { name: { $regex: new RegExp(cleanQuery.substring(0, 3), 'i') } }, // Match first 3 characters
      { description: { $regex: new RegExp(cleanQuery.substring(0, 3), 'i') } }
    ]
  }).limit(perPage);
  
  if (similarProducts.length > 0) {
    logger.info(`WooCommerce Local: Found ${similarProducts.length} similar products`);
    return this.formatProducts(similarProducts);
  }
}
      return this.formatProducts(products);
    } catch (error) {
      logger.error(`WooCommerce Local: Search products error: ${error.message}`);
      return [];
    }
  }
// Add this as a new method in the WooCommerceLocalService class
async searchServices(serviceType = '', location = '', perPage = 10) {
  try {
    logger.info(`WooCommerce Local: Searching for services - type: ${serviceType}, location: ${location}`);
    
    // First, try to find service categories
    const serviceCategories = await Category.find({
      $or: [
        { name: { $regex: /service/i } },
        { slug: { $regex: /service/i } },
        { name: { $regex: /auto/i } },
        { slug: { $regex: /auto/i } },
        { name: { $regex: /car/i } },
        { slug: { $regex: /car/i } }
      ]
    });
    
    const serviceCategoryIds = serviceCategories.map(cat => cat.categoryId);
    
    // Build the query
    let query = {};
    
    if (serviceType) {
      query = {
        $and: [
          { 'categories.id': { $in: serviceCategoryIds } },
          {
            $or: [
              { name: { $regex: new RegExp(serviceType, 'i') } },
              { description: { $regex: new RegExp(serviceType, 'i') } }
            ]
          }
        ]
      };
    } else {
      query = { 'categories.id': { $in: serviceCategoryIds } };
    }
    
    // Add location filter if provided
    if (location) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: new RegExp(location, 'i') } },
          { description: { $regex: new RegExp(location, 'i') } }
        ]
      });
    }
    
    // Execute the query
    const services = await Product.find(query).limit(perPage);
    logger.info(`WooCommerce Local: Found ${services.length} services`);
    
    return this.formatProducts(services);
  } catch (error) {
    logger.error(`WooCommerce Local: Search services error: ${error.message}`);
    return [];
  }
}
  /**
   * Format products for API response
   * @param {Array} products - Array of product documents from MongoDB
   * @returns {Array} Formatted products
   */
  formatProducts(products) {
    return products.map(item => ({
      id: item.productId,
      name: item.name,
      description: item.shortDescription || item.description,
      price: item.price,
      image: item.images && item.images.length > 0 ? item.images[0] : null,
      url: item.permalink,
      categories: item.categories ? item.categories.map(cat => cat.name) : []
    }));
  }

  /**
   * Get all categories from the local database
   * @returns {Promise<Array>} Array of categories
   */
  async getAllCategories() {
    try {
      logger.info('WooCommerce Local: Getting all product categories');
      
      const categories = await Category.find().sort({ name: 1 });
      
      return categories.map(item => ({
        id: item.categoryId,
        name: item.name,
        slug: item.slug,
        parent: item.parent,
        count: item.count
      }));
    } catch (error) {
      logger.error(`WooCommerce Local: Get all categories error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get product by ID from the local database
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Product object or null
   */
  async getProductById(productId) {
    try {
      logger.info(`WooCommerce Local: Getting product by ID: ${productId}`);
      
      const product = await Product.findOne({ productId: parseInt(productId) });
      
      if (!product) {
        logger.warn(`WooCommerce Local: Product with ID ${productId} not found`);
        return null;
      }
      
      return {
        id: product.productId,
        name: product.name,
        description: product.description,
        short_description: product.shortDescription,
        price: product.price,
        regular_price: product.regularPrice,
        sale_price: product.salePrice,
        images: product.images || [],
        categories: product.categories || [],
        tags: product.tags || [],
        attributes: product.attributes || [],
        permalink: product.permalink
      };
    } catch (error) {
      logger.error(`WooCommerce Local: Get product by ID error: ${error.message}`);
      return null;
    }
  }
}

module.exports = new WooCommerceLocalService();
