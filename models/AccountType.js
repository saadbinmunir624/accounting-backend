const mongoose = require('mongoose');

const accountTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Account type name is required'],
    unique: true,
    trim: true
  },
  // High-level group for this account type (for filters/headings)
  majorType: {
    type: String,
    enum: ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'],
    required: false,
    default: null,
    trim: true,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AccountType', accountTypeSchema);