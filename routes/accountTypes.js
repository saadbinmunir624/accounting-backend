const express = require('express');
const router = express.Router();
const AccountType = require('../models/AccountType');

// Get all account types
router.get('/', async (req, res) => {
  try {
    const accountTypes = await AccountType.find().sort({ name: 1 });
    res.json(accountTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single account type by ID
router.get('/:id', async (req, res) => {
  try {
    const accountType = await AccountType.findById(req.params.id);
    
    if (!accountType) {
      return res.status(404).json({ message: 'Account type not found' });
    }
    res.json(accountType);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new account type
router.post('/', async (req, res) => {
  try {
    const accountType = new AccountType(req.body);
    const savedAccountType = await accountType.save();
    res.status(201).json(savedAccountType);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Account type name already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Update account type
router.patch('/:id', async (req, res) => {
  try {
    const updatedAccountType = await AccountType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedAccountType) {
      return res.status(404).json({ message: 'Account type not found' });
    }
    res.json(updatedAccountType);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Account type name already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Delete account type
router.delete('/:id', async (req, res) => {
  try {
    // Check if account type is being used in chart of accounts
    const ChartOfAccount = require('../models/ChartOfAccount');
    const usageCount = await ChartOfAccount.countDocuments({ 
      accountType: req.params.id 
    });
    
    if (usageCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete. This account type is being used in ${usageCount} account(s)` 
      });
    }
    
    const deletedAccountType = await AccountType.findByIdAndDelete(req.params.id);
    
    if (!deletedAccountType) {
      return res.status(404).json({ message: 'Account type not found' });
    }
    
    res.json({ 
      message: 'Account type deleted successfully',
      deletedAccountType 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;