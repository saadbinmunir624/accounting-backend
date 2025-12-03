// routes/chartofaccounts.js
const express = require('express');
const router = express.Router();
const ChartOfAccount = require('../models/ChartOfAccount');
const AccountType = require('../models/AccountType'); // ADD THIS LINE
const TaxType = require('../models/TaxType'); // ADD THIS LINE

// Get all accounts (with populated references)
router.get('/', async (req, res) => {
  try {
    const accounts = await ChartOfAccount.find()
      .populate('accountType', 'name')
      .populate('tax', 'name taxPercentage')
      .sort({ code: 1 });
    
    res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts
    });
  } catch (error) {
    console.error('GET chart of accounts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error',
      error: error.message 
    });
  }
});

// Get single account by ID
router.get('/:id', async (req, res) => {
  try {
    const account = await ChartOfAccount.findById(req.params.id)
      .populate('accountType', 'name')
      .populate('tax', 'name taxPercentage');
    
    if (!account) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: account
    });
  } catch (error) {
    console.error('GET account by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server Error',
      error: error.message 
    });
  }
});

// Get account by code
router.get('/code/:code', async (req, res) => {
  try {
    const account = await ChartOfAccount.findOne({ code: req.params.code })
      .populate('accountType', 'name')
      .populate('tax', 'name taxPercentage');
    
    if (!account) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: account
    });
  } catch (error) {
    console.error('GET account by code error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error',
      error: error.message 
    });
  }
});

// Create new account
router.post('/', async (req, res) => {
  try {
    console.log('Creating chart of account:', req.body);
    
    // Validate AccountType exists
    if (req.body.accountType) {
      const accountTypeExists = await AccountType.findById(req.body.accountType);
      if (!accountTypeExists) {
        return res.status(400).json({
          success: false,
          message: 'Account type not found',
          hint: 'Please use GET /api/account-types to get valid account type IDs'
        });
      }
    }
    
    // Validate TaxType exists
    if (req.body.tax) {
      const taxTypeExists = await TaxType.findById(req.body.tax);
      if (!taxTypeExists) {
        return res.status(400).json({
          success: false,
          message: 'Tax type not found',
          hint: 'Please use GET /api/tax-types to get valid tax type IDs'
        });
      }
    }
    
    const account = new ChartOfAccount(req.body);
    const savedAccount = await account.save();
    
    // Populate references before sending response
    const populatedAccount = await ChartOfAccount.findById(savedAccount._id)
      .populate('accountType', 'name')
      .populate('tax', 'name taxPercentage');
    
    res.status(201).json({
      success: true,
      message: 'Chart of account created successfully',
      data: populatedAccount
    });
  } catch (error) {
    console.error('POST chart of account error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Account code already exists' 
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors
      });
    }
    
    res.status(400).json({ 
      success: false,
      message: 'Bad Request',
      error: error.message 
    });
  }
});

// Update account (using PATCH for consistency)
router.patch('/:id', async (req, res) => {
  try {
    console.log('Updating chart of account:', req.params.id);
    console.log('Update data:', req.body);
    
    const updatedAccount = await ChartOfAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('accountType', 'name')
      .populate('tax', 'name taxPercentage');
    
    if (!updatedAccount) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Chart of account updated successfully',
      data: updatedAccount
    });
  } catch (error) {
    console.error('PATCH chart of account error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Account code already exists' 
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors
      });
    }
    
    res.status(400).json({ 
      success: false,
      message: 'Bad Request',
      error: error.message 
    });
  }
});

// Keep PUT for backward compatibility
router.put('/:id', async (req, res) => {
  try {
    const updatedAccount = await ChartOfAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('accountType', 'name')
      .populate('tax', 'name taxPercentage');
    
    if (!updatedAccount) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Chart of account updated successfully',
      data: updatedAccount
    });
  } catch (error) {
    console.error('PUT chart of account error:', error);
    res.status(400).json({ 
      success: false,
      message: 'Bad Request',
      error: error.message 
    });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const deletedAccount = await ChartOfAccount.findByIdAndDelete(req.params.id);
    
    if (!deletedAccount) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: 'Account deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('DELETE chart of account error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error',
      error: error.message 
    });
  }
});

module.exports = router;