// routes/items.js
const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

// GET all items (with populated references)
router.get('/', async (req, res) => {
  try {
    const items = await Item.find()
      .populate('purchaseAccount', 'accountCode accountName')
      .populate('taxRateOnPurchase', 'name rate')
      .populate('saleAccount', 'accountCode accountName')
      .populate('taxRateOnSale', 'name rate')
      .sort({ itemCode: 1 });
    
    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// GET single item by ID
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('purchaseAccount', 'accountCode accountName')
      .populate('taxRateOnPurchase', 'name rate')
      .populate('saleAccount', 'accountCode accountName')
      .populate('taxRateOnSale', 'name rate');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// GET item by item code
router.get('/code/:itemCode', async (req, res) => {
  try {
    const item = await Item.findOne({ itemCode: req.params.itemCode.toUpperCase() })
      .populate('purchaseAccount', 'accountCode accountName')
      .populate('taxRateOnPurchase', 'name rate')
      .populate('saleAccount', 'accountCode accountName')
      .populate('taxRateOnSale', 'name rate');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// POST create new item
router.post('/', async (req, res) => {
  try {
    const item = await Item.create(req.body);
    const populatedItem = await Item.findById(item._id)
      .populate('purchaseAccount', 'accountCode accountName')
      .populate('taxRateOnPurchase', 'name rate')
      .populate('saleAccount', 'accountCode accountName')
      .populate('taxRateOnSale', 'name rate');
    
    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: populatedItem
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item code already exists'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// PATCH update item
router.patch('/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('purchaseAccount', 'accountCode accountName')
      .populate('taxRateOnPurchase', 'name rate')
      .populate('saleAccount', 'accountCode accountName')
      .populate('taxRateOnSale', 'name rate');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item code already exists'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// DELETE item
router.delete('/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// routes/items.js

// ... your existing item routes ...

// ============================================
// HELPER ENDPOINT: Get item sale details
// Frontend calls this when user selects an item
// ============================================
router.get('/:id/sale-details', async (req, res) => {
  try {
    const Item = require('../models/Item');
    
    const item = await Item.findById(req.params.id)
      .populate('saleAccount', 'code name')
      .populate('taxRateOnSale', 'name rate');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    
    // Return sale-related fields for invoice line item
    res.status(200).json({
      success: true,
      data: {
        _id: item._id,
        itemCode: item.itemCode,
        name: item.name,
        description: item.description || '',
        price: item.salePrice || 0,
        account: item.saleAccount ? {
          _id: item.saleAccount._id,
          code: item.saleAccount.code,
          name: item.saleAccount.name
        } : null,
        taxRate: item.taxRateOnSale ? {
          _id: item.taxRateOnSale._id,
          name: item.taxRateOnSale.name,
          rate: item.taxRateOnSale.rate
        } : null
      }
    });
  } catch (error) {
    console.error('GET item sale details error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

module.exports = router;