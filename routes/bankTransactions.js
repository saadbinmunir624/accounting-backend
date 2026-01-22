const express = require('express');
const router = express.Router();

const BankTransaction = require('../models/BankTransaction');
const BankAccount = require('../models/BankAccount');

// Create a new bank transaction (Send / Receive money)
router.post('/', async (req, res) => {
  try {
    const {
      bankAccount,
      type,
      person,
      date,
      reference,
      taxMode,
      lineItems,
      subtotal,
      totalTax,
      grandTotal,
      notes,
    } = req.body;

    if (!bankAccount || !type || !person || !date) {
      return res.status(400).json({ message: 'bankAccount, type, person and date are required.' });
    }

    if (!['Send', 'Receive'].includes(type)) {
      return res.status(400).json({ message: 'Invalid transaction type.' });
    }

    const account = await BankAccount.findById(bankAccount);
    if (!account) {
      return res.status(404).json({ message: 'Bank account not found.' });
    }

    const transaction = new BankTransaction({
      bankAccount,
      type,
      person,
      date,
      reference,
      taxMode,
      lineItems: lineItems || [],
      subtotal: subtotal || 0,
      totalTax: totalTax || 0,
      grandTotal: grandTotal || 0,
      notes,
    });

    await transaction.save();

    const amount = Number(transaction.grandTotal) || 0;
    const delta = type === 'Send' ? -amount : amount;

    account.balance = (Number(account.balance) || 0) + delta;
    await account.save();

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating bank transaction:', error);
    res.status(500).json({ message: 'Failed to create bank transaction', error: error.message });
  }
});

// Optional: list transactions (simple newest-first list)
router.get('/', async (req, res) => {
  try {
    const transactions = await BankTransaction.find()
      .populate('bankAccount')
      .sort({ date: -1, createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    res.status(500).json({ message: 'Failed to fetch bank transactions', error: error.message });
  }
});

module.exports = router;
