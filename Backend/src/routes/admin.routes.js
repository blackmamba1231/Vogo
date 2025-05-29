const express = require('express');
const router = express.Router();
const woocommerceSyncService = require('../services/woocommerce-sync.service');
const { authMiddleware, authorizeRoles } = require('../middleware/auth.middleware');

// Middleware to ensure only admins can access these routes
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: true,
      message: 'Access denied: Admin privileges required'
    });
  }
  next();
};

// Get sync status
router.get('/woocommerce/sync/status', authMiddleware, async (req, res) => {
  try {
    const status = woocommerceSyncService.getSyncStatus();
    
    res.status(200).json({
      error: false,
      data: status
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting sync status'
    });
  }
});

// Trigger category sync
router.post('/woocommerce/sync/categories', authMiddleware, async (req, res) => {
  try {
    const result = await woocommerceSyncService.syncCategories();
    
    res.status(200).json({
      error: false,
      data: result
    });
  } catch (error) {
    console.error('Trigger category sync error:', error);
    res.status(500).json({
      error: true,
      message: 'Error triggering category sync'
    });
  }
});

// Trigger incremental product sync
router.post('/woocommerce/sync/products/incremental', authMiddleware, async (req, res) => {
  try {
    const result = await woocommerceSyncService.syncProductsIncremental();
    
    res.status(200).json({
      error: false,
      data: result
    });
  } catch (error) {
    console.error('Trigger incremental product sync error:', error);
    res.status(500).json({
      error: true,
      message: 'Error triggering incremental product sync'
    });
  }
});

// Trigger full product sync
router.post('/woocommerce/sync/products/full', authMiddleware, async (req, res) => {
  try {
    // Start the sync process
    const syncPromise = woocommerceSyncService.syncAllProducts();
    
    // Return an immediate response since this might take a while
    res.status(202).json({
      error: false,
      message: 'Full product sync started. Check status endpoint for progress.'
    });
    
    // Process continues in background
    await syncPromise;
  } catch (error) {
    console.error('Trigger full product sync error:', error);
    // We can't respond here since we already sent the response
  }
});

module.exports = router;
