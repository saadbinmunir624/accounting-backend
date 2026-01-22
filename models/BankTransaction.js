const mongoose = require('mongoose');

const BankTransactionLineItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
    },
    description: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChartOfAccount',
    },
    taxRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lineTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const BankTransactionSchema = new mongoose.Schema(
  {
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: true,
    },
    type: {
      type: String,
      enum: ['Send', 'Receive'],
      required: true,
    },
    person: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    reference: {
      type: String,
      trim: true,
    },
    taxMode: {
      type: String,
      enum: ['Excluding', 'Including', 'No Tax'],
      default: 'Excluding',
    },
    lineItems: [BankTransactionLineItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalTax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankTransaction', BankTransactionSchema);
