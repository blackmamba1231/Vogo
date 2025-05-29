const logger = require('../utils/logger');
const woocommerceService = require('./woocommerce.service');
const Product = require('../models/product.model');
const Category = require('../models/category.model');

class WooCommerceSyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.currentPage = 1;
    this.totalPages = 1;
    this.perPage = 50; // Higher per_page for syncing
  }

  /**
   * Sync all categories from WooCommerce
   */
  async syncCategories() {
    logger.info('WooCommerce Sync: Starting category sync');
    try {
      // Get all categories from WooCommerce
      const categories = await woocommerceService.getAllCategories();
      logger.info(`WooCommerce Sync: Retrieved ${categories.length} categories`);

      if (!categories || categories.length === 0) {
        logger.warn('WooCommerce Sync: No categories retrieved from WooCommerce');
        return { success: false, message: 'No categories retrieved' };
      }

      // Process each category
      let createCount = 0;
      let updateCount = 0;

      for (const category of categories) {
        // Find existing category or create new one
        const existingCategory = await Category.findOne({ categoryId: category.id });

        if (existingCategory) {
          // Update existing category
          existingCategory.name = category.name;
          existingCategory.slug = category.slug;
          existingCategory.parent = category.parent;
          existingCategory.count = category.count;
          existingCategory.updatedAt = new Date();
          await existingCategory.save();
          updateCount++;
        } else {
          // Create new category
          await Category.create({
            categoryId: category.id,
            name: category.name,
            slug: category.slug,
            parent: category.parent,
            count: category.count
          });
          createCount++;
        }
      }

      logger.info(`WooCommerce Sync: Categories sync completed. Created: ${createCount}, Updated: ${updateCount}`);
      return { 
        success: true, 
        message: `Categories sync completed. Created: ${createCount}, Updated: ${updateCount}`,
        created: createCount,
        updated: updateCount
      };
    } catch (error) {
      logger.error(`WooCommerce Sync: Error syncing categories: ${error.message}`);
      return { success: false, message: `Error syncing categories: ${error.message}` };
    }
  }

  /**
   * Sync products incrementally, one page at a time
   */
  async syncProductsIncremental() {
    // Don't start a new sync if one is already in progress
    if (this.isSyncing) {
      logger.info('WooCommerce Sync: Product sync already in progress');
      return { 
        success: false, 
        message: 'Sync already in progress', 
        currentPage: this.currentPage, 
        totalPages: this.totalPages 
      };
    }

    try {
      this.isSyncing = true;
      logger.info(`WooCommerce Sync: Starting incremental product sync (page ${this.currentPage})`);
      
      // Get products for current page
      const result = await woocommerceService.getAllProducts(this.currentPage, this.perPage);
      
      if (!result || !result.products || result.products.length === 0) {
        logger.warn(`WooCommerce Sync: No products retrieved for page ${this.currentPage}`);
        // Reset to page 1 if we reach the end or get an empty result
        this.currentPage = 1;
        this.isSyncing = false;
        return { 
          success: false, 
          message: 'No products retrieved', 
          currentPage: this.currentPage, 
          totalPages: this.totalPages 
        };
      }

      // Update total pages
      this.totalPages = result.pagination.totalPages;
      
      let createCount = 0;
      let updateCount = 0;
      
      // Process each product
      for (const product of result.products) {
        try {
          // Find existing product or create new one
          const existingProduct = await Product.findOne({ productId: product.id });
          
          if (existingProduct) {
            // Update existing product
            existingProduct.name = product.name;
            existingProduct.description = product.description;
            existingProduct.shortDescription = product.short_description;
            existingProduct.price = product.price;
            existingProduct.regularPrice = product.regular_price;
            existingProduct.salePrice = product.sale_price;
            existingProduct.stockStatus = product.stock_status;
            existingProduct.categories = product.categories.map(cat => ({
              id: cat.id,
              name: cat.name,
              slug: cat.slug || ''
            }));
            existingProduct.tags = product.tags.map(tag => ({
              id: tag.id,
              name: tag.name,
              slug: tag.slug || ''
            }));
            existingProduct.images = product.images.map(img => img);
            existingProduct.attributes = product.attributes;
            existingProduct.permalink = product.url;
            existingProduct.updatedAt = new Date();
            await existingProduct.save();
            updateCount++;
          } else {
            // Create new product
            await Product.create({
              productId: product.id,
              name: product.name,
              description: product.description,
              shortDescription: product.short_description,
              price: product.price,
              regularPrice: product.regular_price,
              salePrice: product.sale_price,
              stockStatus: product.stock_status,
              categories: product.categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug || ''
              })),
              tags: product.tags.map(tag => ({
                id: tag.id,
                name: tag.name,
                slug: tag.slug || ''
              })),
              images: product.images.map(img => img),
              attributes: product.attributes,
              permalink: product.url
            });
            createCount++;
          }
        } catch (productError) {
          logger.error(`WooCommerce Sync: Error processing product ${product.id}: ${productError.message}`);
          // Continue to next product
        }
      }
      
      // Move to next page or reset to 1 if we've processed all pages
      this.currentPage = this.currentPage < this.totalPages ? this.currentPage + 1 : 1;
      this.lastSyncTime = new Date();
      
      logger.info(`WooCommerce Sync: Incremental product sync completed. Page ${this.currentPage - 1}/${this.totalPages}, Created: ${createCount}, Updated: ${updateCount}`);
      
      this.isSyncing = false;
      return {
        success: true,
        message: `Products sync (page ${this.currentPage - 1}/${this.totalPages}) completed. Created: ${createCount}, Updated: ${updateCount}`,
        currentPage: this.currentPage,
        totalPages: this.totalPages,
        created: createCount,
        updated: updateCount
      };
    } catch (error) {
      logger.error(`WooCommerce Sync: Error syncing products: ${error.message}`);
      this.isSyncing = false;
      return { 
        success: false, 
        message: `Error syncing products: ${error.message}`, 
        currentPage: this.currentPage, 
        totalPages: this.totalPages 
      };
    }
  }

  /**
   * Force a full sync of all products (may take time)
   */
  async syncAllProducts() {
    logger.info('WooCommerce Sync: Starting full product sync');
    
    if (this.isSyncing) {
      logger.info('WooCommerce Sync: Product sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }
    
    try {
      this.isSyncing = true;
      
      // Reset sync state
      this.currentPage = 1;
      
      // Get total pages info first
      const initialResult = await woocommerceService.getAllProducts(1, this.perPage);
      
      if (!initialResult || !initialResult.pagination) {
        this.isSyncing = false;
        return { success: false, message: 'Failed to get product pagination info' };
      }
      
      this.totalPages = initialResult.pagination.totalPages;
      logger.info(`WooCommerce Sync: Will sync ${initialResult.pagination.totalProducts} products across ${this.totalPages} pages`);
      
      let totalCreated = 0;
      let totalUpdated = 0;
      
      // Process all pages
      for (let page = 1; page <= this.totalPages; page++) {
        try {
          this.currentPage = page;
          logger.info(`WooCommerce Sync: Processing page ${page}/${this.totalPages}`);
          
          // Get products for current page
          const result = await woocommerceService.getAllProducts(page, this.perPage);
          
          if (!result || !result.products || result.products.length === 0) {
            logger.warn(`WooCommerce Sync: No products retrieved for page ${page}`);
            continue;
          }
          
          // Process products (same logic as incremental sync)
          for (const product of result.products) {
            try {
              const existingProduct = await Product.findOne({ productId: product.id });
              
              if (existingProduct) {
                existingProduct.name = product.name;
                existingProduct.description = product.description;
                existingProduct.shortDescription = product.short_description;
                existingProduct.price = product.price;
                existingProduct.regularPrice = product.regular_price;
                existingProduct.salePrice = product.sale_price;
                existingProduct.stockStatus = product.stock_status;
                existingProduct.categories = product.categories.map(cat => ({
                  id: cat.id,
                  name: cat.name,
                  slug: cat.slug || ''
                }));
                existingProduct.tags = product.tags.map(tag => ({
                  id: tag.id,
                  name: tag.name,
                  slug: tag.slug || ''
                }));
                existingProduct.images = product.images.map(img => img);
                existingProduct.attributes = product.attributes;
                existingProduct.permalink = product.url;
                existingProduct.updatedAt = new Date();
                await existingProduct.save();
                totalUpdated++;
              } else {
                await Product.create({
                  productId: product.id,
                  name: product.name,
                  description: product.description,
                  shortDescription: product.short_description,
                  price: product.price,
                  regularPrice: product.regular_price,
                  salePrice: product.sale_price,
                  stockStatus: product.stock_status,
                  categories: product.categories.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug || ''
                  })),
                  tags: product.tags.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    slug: tag.slug || ''
                  })),
                  images: product.images.map(img => img),
                  attributes: product.attributes,
                  permalink: product.url
                });
                totalCreated++;
              }
            } catch (productError) {
              logger.error(`WooCommerce Sync: Error processing product ${product.id}: ${productError.message}`);
              // Continue to next product
            }
          }
          
          // Add a small delay to avoid overwhelming the WooCommerce API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (pageError) {
          logger.error(`WooCommerce Sync: Error processing page ${page}: ${pageError.message}`);
          // Continue to next page
        }
      }
      
      this.currentPage = 1;
      this.lastSyncTime = new Date();
      this.isSyncing = false;
      
      logger.info(`WooCommerce Sync: Full product sync completed. Created: ${totalCreated}, Updated: ${totalUpdated}`);
      return {
        success: true,
        message: `Full product sync completed. Created: ${totalCreated}, Updated: ${totalUpdated}`,
        created: totalCreated,
        updated: totalUpdated
      };
    } catch (error) {
      logger.error(`WooCommerce Sync: Error in full product sync: ${error.message}`);
      this.isSyncing = false;
      return { success: false, message: `Error in full product sync: ${error.message}` };
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      currentPage: this.currentPage,
      totalPages: this.totalPages
    };
  }
}

module.exports = new WooCommerceSyncService();
