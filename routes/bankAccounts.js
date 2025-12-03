// routes/bankAccounts.js
const express = require('express');
const router = express.Router();
const BankAccount = require('../models/BankAccount');

// GET all bank accounts (with populated bank account type)
router.get('/', async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find().populate('bankAccountType', 'name');
    
    res.status(200).json({
      success: true,
      count: bankAccounts.length,
      data: bankAccounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// GET single bank account by ID
router.get('/:id', async (req, res) => {
  try {
    const bankAccount = await BankAccount.findById(req.params.id).populate('bankAccountType', 'name');
    
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: bankAccount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// POST create new bank account
router.post('/', async (req, res) => {
  try {
    const bankAccount = await BankAccount.create(req.body);
    const populatedAccount = await BankAccount.findById(bankAccount._id).populate('bankAccountType', 'name');
    
    res.status(201).json({
      success: true,
      message: 'Bank account created successfully',
      data: populatedAccount
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// PATCH update bank account
router.patch('/:id', async (req, res) => {
  try {
    const bankAccount = await BankAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('bankAccountType', 'name');
    
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Bank account updated successfully',
      data: bankAccount
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// DELETE bank account
router.delete('/:id', async (req, res) => {
  try {
    const bankAccount = await BankAccount.findByIdAndDelete(req.params.id);
    
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Bank account deleted successfully',
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