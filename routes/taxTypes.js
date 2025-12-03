const express = require('express');
const router = express.Router();
const TaxType = require('../models/TaxType');

// Get all tax types
router.get('/', async (req, res) => {
  try {
    const taxTypes = await TaxType.find().sort({ name: 1 });
    res.json(taxTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single tax type by ID
router.get('/:id', async (req, res) => {
  try {
    const taxType = await TaxType.findById(req.params.id);
    
    if (!taxType) {
      return res.status(404).json({ message: 'Tax type not found' });
    }
    res.json(taxType);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new tax type
router.post('/', async (req, res) => {
  try {
    const taxType = new TaxType(req.body);
    const savedTaxType = await taxType.save();
    res.status(201).json(savedTaxType);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Tax type name already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Update tax type
router.patch('/:id', async (req, res) => {
  try {
    const updatedTaxType = await TaxType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedTaxType) {
      return res.status(404).json({ message: 'Tax type not found' });
    }
    res.json(updatedTaxType);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Tax type name already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Delete tax type
router.delete('/:id', async (req, res) => {
  try {
    // Check if tax type is being used in chart of accounts
    const ChartOfAccount = require('../models/ChartOfAccount');
    const accountUsageCount = await ChartOfAccount.countDocuments({ 
      tax: req.params.id 
    });
    
    if (accountUsageCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete. This tax type is being used in ${accountUsageCount} account(s)` 
      });
    }
    
    // Check if tax type is being used in products
    const Product = require('../models/Product');
    const productUsageCount = await Product.countDocuments({ 
      taxType: req.params.id 
    });
    
    if (productUsageCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete. This tax type is being used in ${productUsageCount} product(s)` 
      });
    }
    
    const deletedTaxType = await TaxType.findByIdAndDelete(req.params.id);
    
    if (!deletedTaxType) {
      return res.status(404).json({ message: 'Tax type not found' });
    }
    
    res.json({ 
      message: 'Tax type deleted successfully',
      deletedTaxType 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;