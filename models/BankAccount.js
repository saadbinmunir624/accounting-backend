// models/BankAccount.js
const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  accountName: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true
  },
  bankAccountType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccountType',
    required: [true, 'Bank account type is required']
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('BankAccount', bankAccountSchema);