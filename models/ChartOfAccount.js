const mongoose = require('mongoose');

const chartOfAccountSchema = new mongoose.Schema({
  accountType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountType',
    required: [true, 'Account type is required']
  },
  code: {
    type: String,
    required: [true, 'Account code is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  tax: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxType',
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChartOfAccount', chartOfAccountSchema);