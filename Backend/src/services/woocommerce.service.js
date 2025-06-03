const axios = require('axios');
const logger = require('../utils/logger');



// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600;

class WooCommerceService {
  constructor() {
    this.baseURL = process.env.WOOCOMMERCE_URL;
    this.consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
    this.consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
  }
  
  // Create API client with authentication
  getApiClient() {
    logger.info(`WooCommerce: Creating API client for baseURL=${this.baseURL}`);
    logger.debug(`WooCommerce: Using consumer key: ${this.consumerKey ? '****' + this.consumerKey.slice(-4) : 'undefined'}`);
    
    return axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.consumerKey,
        password: this.consumerSecret
      }
    });
  }
  
  // Search for restaurants based on location
  async searchRestaurants(location) {
    try {
     
      // Make API request to WooCommerce
      const api = this.getApiClient();
      const response = await api.get('/wp-json/wc/v3/products', {
        params: {
          category: 'restaurant',
          location,
          per_page: 10
        }
      });
      
      // Format restaurant data
      const restaurants = response.data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.short_description,
        image: item.images.length > 0 ? item.images[0].src : null,
        location: this.extractLocation(item),
        url: item.permalink,
        rating: item.average_rating
      }));
      
     
      
      return restaurants;
    } catch (error) {
      console.error('Search restaurants error:', error);
      return [];
    }
  }
  
  // Search for services based on location and type
  async searchServices(location, serviceType = 'general') {
    try {
    
      
      // Make API request to WooCommerce
      const api = this.getApiClient();
      const response = await api.get('/wp-json/wc/v3/products', {
        params: {
          category: 'service',
          tag: serviceType,
          location,
          per_page: 10
        }
      });
      
      // Format service data
      const services = response.data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.short_description,
        image: item.images.length > 0 ? item.images[0].src : null,
        location: this.extractLocation(item),
        url: item.permalink,
        price: item.price,
        serviceType: this.extractServiceType(item)
      }));
      
      // Cache the results
     
    
      
      return services;
    } catch (error) {
      console.error('Search services error:', error);
      return [];
    }
  }
  
  // Get product details by ID
  async getProductById(productId) {
    try {
    
      
      // Make API request to WooCommerce
      const api = this.getApiClient();
      const response = await api.get(`/wp-json/wc/v3/products/${productId}`);
      
      // Format product data
      const product = {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description,
        shortDescription: response.data.short_description,
        price: response.data.price,
        regularPrice: response.data.regular_price,
        salePrice: response.data.sale_price,
        onSale: response.data.on_sale,
        images: response.data.images.map(img => img.src),
        attributes: response.data.attributes,
        categories: response.data.categories.map(cat => cat.name),
        tags: response.data.tags.map(tag => tag.name),
        url: response.data.permalink
      };
      
      // Cache the results
     
      return product;
    } catch (error) {
      console.error('Get product by ID error:', error);
      return null;
    }
  }
  // In woocommerce.service.js

/**
 * Find a product by name
 * @param {string} productName - The name of the product to find
 * @returns {Promise<Object|null>} The found product or null if not found
 */
async findProductByName(productName) {
  try {
    // First try to find by exact name match
    const response = await this.woocommerce.get('products', {
      search: productName,
      per_page: 1
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }

    // If no exact match, try a more flexible search
    const searchResponse = await this.woocommerce.get('products', {
      search: productName,
      per_page: 10
    });

    if (searchResponse.data && searchResponse.data.length > 0) {
      // Find the closest match
      const matches = searchResponse.data.filter(product => 
        product.name.toLowerCase().includes(productName.toLowerCase())
      );
      return matches.length > 0 ? matches[0] : searchResponse.data[0];
    }

    return null;
  } catch (error) {
    console.error('Error finding product by name:', error);
    throw error;
  }
}

  // Search for products based on query
  async searchProducts(query, category = '', perPage = 10) {
    try {
      logger.info(`WooCommerce: Searching for products with query="${query}", category="${category}", perPage=${perPage}`);
      
     
      
      // Make API request to WooCommerce
      const api = this.getApiClient();
      
      // IMPROVED SEARCH STRATEGY:
      // 1. Try exact category search first
      // 2. If that fails, try category name/slug search
      // 3. If that fails, try text search with the query
      // 4. If all fail, try a combined approach
      
      let allProducts = [];
      
      // Step 1: Try direct category ID search if category is numeric
      if (category && !isNaN(category)) {
        logger.info(`WooCommerce: Searching by category ID: ${category}`);
        try {
          const directCategoryResponse = await api.get('/wp-json/wc/v3/products', { 
            params: {
              category: category,
              per_page: perPage
            }
          });
          
          if (directCategoryResponse.data && directCategoryResponse.data.length > 0) {
            logger.info(`WooCommerce: Found ${directCategoryResponse.data.length} products by direct category ID`);
            allProducts = directCategoryResponse.data;
          }
        } catch (err) {
          logger.error(`WooCommerce: Error in direct category search: ${err.message}`);
        }
      }
      
      // Step 2: If no products found and category is a string, try to find the category ID
      if (allProducts.length === 0 && category && isNaN(category)) {
        logger.info(`WooCommerce: Looking up category ID for: ${category}`);
        try {
          // Get all categories
          const categoriesResponse = await api.get('/wp-json/wc/v3/products/categories', {
            params: { per_page: 100 }
          });
          
          if (categoriesResponse.data && categoriesResponse.data.length > 0) {
            // First try exact match on slug (most reliable)
            let categoryMatch = categoriesResponse.data.find(cat => 
              cat.slug.toLowerCase() === category.toLowerCase()
            );
            
            // If no slug match, try exact name match
            if (!categoryMatch) {
              categoryMatch = categoriesResponse.data.find(cat => 
                cat.name.toLowerCase() === category.toLowerCase()
              );
            }
            
            // If still no match, try partial matches
            if (!categoryMatch) {
              categoryMatch = categoriesResponse.data.find(cat => 
                cat.slug.toLowerCase().includes(category.toLowerCase()) || 
                cat.name.toLowerCase().includes(category.toLowerCase())
              );
            }
            
            // If we found a category match, search by that category ID
            if (categoryMatch) {
              logger.info(`WooCommerce: Found category match: ${categoryMatch.name} (ID: ${categoryMatch.id})`);
              
              const categoryProductsResponse = await api.get('/wp-json/wc/v3/products', {
                params: {
                  category: categoryMatch.id,
                  per_page: perPage
                }
              });
              
              if (categoryProductsResponse.data && categoryProductsResponse.data.length > 0) {
                logger.info(`WooCommerce: Found ${categoryProductsResponse.data.length} products by category match`);
                allProducts = categoryProductsResponse.data;
              }
            }
          }
        } catch (err) {
          logger.error(`WooCommerce: Error in category lookup: ${err.message}`);
        }
      }
      
      // Step 3: If still no products found and we have a query, try text search
      if (allProducts.length === 0 && query) {
        logger.info(`WooCommerce: Trying text search with query: ${query}`);
        try {
          const textSearchResponse = await api.get('/wp-json/wc/v3/products', {
            params: {
              search: query,
              per_page: perPage
            }
          });
          
          if (textSearchResponse.data && textSearchResponse.data.length > 0) {
            logger.info(`WooCommerce: Found ${textSearchResponse.data.length} products by text search`);
            allProducts = textSearchResponse.data;
          }
        } catch (err) {
          logger.error(`WooCommerce: Error in text search: ${err.message}`);
        }
      }
      
      // Step 4: If still no products found, try a combined approach or fallback to getting products from a default category
      if (allProducts.length === 0) {
        logger.info(`WooCommerce: No products found with previous methods, trying fallback approaches`);
        
        // Try combined search query + category as text
        if (query && category) {
          try {
            const combinedSearchResponse = await api.get('/wp-json/wc/v3/products', {
              params: {
                search: `${query} ${category}`,
                per_page: perPage
              }
            });
            
            if (combinedSearchResponse.data && combinedSearchResponse.data.length > 0) {
              logger.info(`WooCommerce: Found ${combinedSearchResponse.data.length} products by combined search`);
              allProducts = combinedSearchResponse.data;
            }
          } catch (err) {
            logger.error(`WooCommerce: Error in combined search: ${err.message}`);
          }
        }
        
        // Final fallback: If it's a food-related query but no products found, try the food-delivery category
        if (allProducts.length === 0 && 
            (query?.toLowerCase().includes('food') || 
             query?.toLowerCase().includes('meal') || 
             query?.toLowerCase().includes('eat') || 
             category?.toLowerCase().includes('food') || 
             category?.toLowerCase().includes('restaurant'))) {
          try {
            logger.info(`WooCommerce: Trying fallback to food-delivery category`);
            const foodFallbackResponse = await api.get('/wp-json/wc/v3/products', {
              params: {
                category: 'food-delivery',  // This could be the parent category ID or slug
                per_page: perPage
              }
            });
            
            if (foodFallbackResponse.data && foodFallbackResponse.data.length > 0) {
              logger.info(`WooCommerce: Found ${foodFallbackResponse.data.length} products by food fallback`);
              allProducts = foodFallbackResponse.data;
            }
          } catch (err) {
            logger.error(`WooCommerce: Error in food fallback search: ${err.message}`);
          }
        }
      }
      
      // Step 5: If STILL no products found, get the latest products as a last resort
      if (allProducts.length === 0) {
        logger.info(`WooCommerce: All search methods failed, returning latest products`);
        try {
          const latestProductsResponse = await api.get('/wp-json/wc/v3/products', {
            params: {
              orderby: 'date',
              order: 'desc',
              per_page: perPage
            }
          });
          
          if (latestProductsResponse.data && latestProductsResponse.data.length > 0) {
            logger.info(`WooCommerce: Found ${latestProductsResponse.data.length} latest products`);
            allProducts = latestProductsResponse.data;
          }
        } catch (err) {
          logger.error(`WooCommerce: Error getting latest products: ${err.message}`);
        }
      }
      
      logger.info(`WooCommerce: Search complete, found ${allProducts.length} products total`);
      
      // Format product data
      const products = allProducts.map(item => {
        logger.debug(`WooCommerce: Processing product: ${item.id} - ${item.name}`);
        return {
          id: item.id,
          name: item.name,
          description: item.short_description,
          price: item.price,
          image: item.images.length > 0 ? item.images[0].src : null,
          url: item.permalink,
          categories: item.categories.map(cat => cat.name)
        };
      });
      
      // Cache the results
      
      return products;
    } catch (error) {
      logger.error(`WooCommerce: Search products error: ${error.message}`);
      if (error.response) {
        logger.error(`WooCommerce: API response error: ${JSON.stringify(error.response.data)}`);
      }
      return [];
    }
  }
  
  // Extract location from product data
  extractLocation(product) {
    if (product.meta_data) {
      const locationMeta = product.meta_data.find(meta => meta.key === '_location' || meta.key === 'location');
      if (locationMeta) {
        return locationMeta.value;
      }
    }
    
    if (product.attributes) {
      const locationAttr = product.attributes.find(attr => attr.name.toLowerCase() === 'location');
      if (locationAttr && locationAttr.options && locationAttr.options.length > 0) {
        return locationAttr.options[0];
      }
    }
    
    return null;
  }
  
  // Extract service type from product data
  extractServiceType(product) {
    if (product.tags && product.tags.length > 0) {
      return product.tags.map(tag => tag.name).join(', ');
    }
    
    if (product.meta_data) {
      const typeMeta = product.meta_data.find(meta => meta.key === '_service_type' || meta.key === 'service_type');
      if (typeMeta) {
        return typeMeta.value;
      }
    }
    
    return 'general';
  }
  
  // Add item to shopping list/cart
  async addToCart(userId, productId, quantity = 1) {
    try {
      // Make API request to WooCommerce
      const api = this.getApiClient();
      const response = await api.post('/wp-json/wc/v3/cart/add-item', {
        user_id: userId,
        product_id: productId,
        quantity
      });
      
      return {
        success: true,
        cartId: response.data.cart_id,
        itemCount: response.data.item_count,
        total: response.data.total
      };
    } catch (error) {
      console.error('Add to cart error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to add item to cart'
      };
    }
  }
  
  // Get cart contents
  async getCart(userId) {
    try {
      // Make API request to WooCommerce
      const api = this.getApiClient();
      const response = await api.get('/wp-json/wc/v3/cart', {
        params: {
          user_id: userId
        }
      });
      
      return {
        success: true,
        items: response.data.items,
        itemCount: response.data.item_count,
        total: response.data.total
      };
    } catch (error) {
      console.error('Get cart error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to get cart'
      };
    }
  }
  
  // Get all products (paginated)
  async getAllProducts(page = 1, perPage = 20) {
    try {
      logger.info(`WooCommerce: Getting all products, page=${page}, perPage=${perPage}`);
      
      
      // Make API request to WooCommerce
      const api = this.getApiClient();
      const response = await api.get('/wp-json/wc/v3/products', {
        params: {
          page,
          per_page: perPage
        }
      });
      
      logger.info(`WooCommerce: Retrieved ${response.data.length} products from page ${page}`);
      
      // Get total pages from headers
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
      const totalProducts = parseInt(response.headers['x-wp-total'] || '0');
      
      // Format product data
      const products = response.data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.short_description,
        price: item.price,
        regular_price: item.regular_price,
        sale_price: item.sale_price,
        status: item.status,
        stock_status: item.stock_status,
        categories: item.categories.map(cat => ({ id: cat.id, name: cat.name })),
        tags: item.tags.map(tag => ({ id: tag.id, name: tag.name })),
        images: item.images.map(img => img.src),
        attributes: item.attributes,
        url: item.permalink
      }));
      
      // Add pagination info
      const result = {
        products,
        pagination: {
          page,
          perPage,
          totalPages,
          totalProducts
        }
      };
      
      return result;
    } catch (error) {
      logger.error(`WooCommerce: Get all products error: ${error.message}`);
      if (error.response) {
        logger.error(`WooCommerce: API response error: ${JSON.stringify(error.response.data)}`);
      }
      return { products: [], pagination: { page, perPage, totalPages: 0, totalProducts: 0 } };
    }
  }
  
  // Get all categories
  async getAllCategories() {
    try {
      logger.info('WooCommerce: Getting all product categories');
     
      // Make API request to WooCommerce
      const api = this.getApiClient();
      const response = await api.get('/wp-json/wc/v3/products/categories', {
        params: {
          per_page: 100 // Get a large number of categories
        }
      });
      
      logger.info(`WooCommerce: Retrieved ${response.data.length} categories`);
      
      // Format category data
      const categories = response.data.map(item => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        parent: item.parent,
        count: item.count
      }));
      
      
      return categories;
    } catch (error) {
      logger.error(`WooCommerce: Get all categories error: ${error.message}`);
      if (error.response) {
        logger.error(`WooCommerce: API response error: ${JSON.stringify(error.response.data)}`);
      }
      return [];
    }
  }
}

module.exports = new WooCommerceService();
