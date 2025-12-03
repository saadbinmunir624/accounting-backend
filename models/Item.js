// models/Item.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: [true, 'Item code is required'],
    unique: true,
    trim: true,
    uppercase: true
    // Remove index: true if you have it here
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
    // Remove index: true if you have it here
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price cannot be negative'],
    default: 0
  },
  purchaseAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts'
  },
  taxRateOnPurchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxType'
  },
  salePrice: {
    type: Number,
    min: [0, 'Sale price cannot be negative'],
    default: 0
  },
  saleAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts'
  },
  taxRateOnSale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxType'
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Define indexes here only (not in the schema fields above)
itemSchema.index({ itemCode: 1 });
itemSchema.index({ name: 1 });

module.exports = mongoose.model('Item', itemSchema);