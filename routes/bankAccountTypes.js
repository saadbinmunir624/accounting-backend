// routes/bankAccountTypes.js
const express = require('express');
const router = express.Router();
const BankAccountType = require('../models/BankAccountType');

// GET all bank account types
router.get('/', async (req, res) => {
  try {
    const accountTypes = await BankAccountType.find();
    res.status(200).json({
      success: true,
      count: accountTypes.length,
      data: accountTypes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// GET single bank account type by ID
router.get('/:id', async (req, res) => {
  try {
    const accountType = await BankAccountType.findById(req.params.id);
    
    if (!accountType) {
      return res.status(404).json({
        success: false,
        message: 'Bank account type not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: accountType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// POST create new bank account type
router.post('/', async (req, res) => {
  try {
    const accountType = await BankAccountType.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Bank account type created successfully',
      data: accountType
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bank account type already exists'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// PATCH update bank account type
router.patch('/:id', async (req, res) => {
  try {
    const accountType = await BankAccountType.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!accountType) {
      return res.status(404).json({
        success: false,
        message: 'Bank account type not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Bank account type updated successfully',
      data: accountType
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// DELETE bank account type
router.delete('/:id', async (req, res) => {
  try {
    const accountType = await BankAccountType.findByIdAndDelete(req.params.id);
    
    if (!accountType) {
      return res.status(404).json({
        success: false,
        message: 'Bank account type not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Bank account type deleted successfully',
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

module.exports = router;