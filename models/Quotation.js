// models/Quotation.js
const mongoose = require('mongoose');

// ============================================
// LINE ITEM SCHEMA (Embedded)
// ============================================
const lineItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Item is required']
  },

  description: {
    type: String,
    trim: true,
    default: ''
  },

  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    default: 0
  },

  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount'
  },

  taxRate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxType'
  },

  qty: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0'],
    default: 1
  },

  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },

  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },

  taxAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax amount cannot be negative']
  },

  amount: {
    type: Number,
    default: 0,
    min: [0, 'Amount cannot be negative']
  }
}, { _id: true });

// ============================================
// MAIN QUOTATION SCHEMA
// ============================================
const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },

  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: [true, 'Contact is required']
  },

  issueDate: {
    type: Date,
    required: [true, 'Issue date is required'],
    default: Date.now
  },

  dueDate: {
    type: Date,
    required: false
  },

  reference: {
    type: String,
    trim: true
  },

  onlinePayment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount'
  },

  paymentAccounts: [{
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount'
    },
    amount: {
      type: Number,
      min: [0, 'Payment amount cannot be negative']
    }
  }],

  amountTreatment: {
    type: String,
    enum: {
      values: ['Including', 'Excluding', 'No Tax'],
      message: '{VALUE} is not a valid amount treatment'
    },
    required: [true, 'Amount treatment is required'],
    default: 'Excluding'
  },

  lineItems: {
    type: [lineItemSchema],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Quotation must have at least one line item'
    }
  },

  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },

  totalDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Total discount cannot be negative']
  },

  totalTax: {
    type: Number,
    default: 0,
    min: [0, 'Total tax cannot be negative']
  },

  grandTotal: {
    type: Number,
    default: 0,
    min: [0, 'Grand total cannot be negative']
  },

  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Approved'],
    default: 'Draft'
  },

  notes: {
    type: String,
    trim: true
  },

  // Track if converted to sales invoice
  convertedToInvoice: {
    type: Boolean,
    default: false
  },

  salesInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesInvoice'
  }
}, {
  timestamps: true
});

// Indexes
quotationSchema.index({ quotationNumber: 1 });
quotationSchema.index({ contact: 1 });
quotationSchema.index({ issueDate: -1 });
quotationSchema.index({ status: 1 });

// ============================================
// PRE-VALIDATE MIDDLEWARE 1: Auto-generate Quotation Number
// ============================================
quotationSchema.pre('validate', async function(next) {
  if (this.isNew && !this.quotationNumber) {
    try {
      const lastQuotation = await this.constructor.findOne(
        {},
        { quotationNumber: 1 },
        { sort: { quotationNumber: -1 } }
      );

      let nextNumber = 1;

      if (lastQuotation && lastQuotation.quotationNumber) {
        const match = lastQuotation.quotationNumber.match(/QT-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      this.quotationNumber = `QT-${String(nextNumber).padStart(2, '0')}`;
      console.log('✅ Generated quotation number:', this.quotationNumber);
    } catch (error) {
      console.error('❌ Error generating quotation number:', error);
      return next(error);
    }
  }
  next();
});

// ============================================
// PRE-VALIDATE MIDDLEWARE 2: Auto-populate from Item
// ============================================
quotationSchema.pre('validate', async function(next) {
  try {
    const Item = mongoose.model('Item');

    console.log('🔄 Auto-populating line items from Item collection...');

    for (let i = 0; i < this.lineItems.length; i++) {
      const lineItem = this.lineItems[i];

      const item = await Item.findById(lineItem.item)
        .populate('saleAccount')
        .populate('taxRateOnSale');

      if (!item) {
        return next(new Error(`Item not found: ${lineItem.item}`));
      }

      if (!lineItem.description || lineItem.description === '') {
        lineItem.description = item.description || '';
      }

      if (!lineItem.price || lineItem.price === 0) {
        lineItem.price = item.salePrice || 0;
      }

      if (!lineItem.account && item.saleAccount) {
        lineItem.account = item.saleAccount._id || item.saleAccount;
      }

      if (!lineItem.taxRate && item.taxRateOnSale) {
        lineItem.taxRate = item.taxRateOnSale._id || item.taxRateOnSale;
      }
    }

    console.log('✅ All line items populated');
    next();
  } catch (error) {
    console.error('❌ Error in auto-populate middleware:', error);
    next(error);
  }
});

// ============================================
// PRE-SAVE MIDDLEWARE 1: Calculate line item amounts
// ============================================
quotationSchema.pre('save', async function(next) {
  try {
    console.log('🔄 Calculating line item amounts...');
    await this.calculateLineItemAmounts();
    console.log('✅ Line item amounts calculated');
    next();
  } catch (error) {
    console.error('❌ Error calculating amounts:', error);
    next(error);
  }
});

// ============================================
// PRE-SAVE MIDDLEWARE 2: Calculate quotation totals
// ============================================
quotationSchema.pre('save', function(next) {
  if (this.lineItems && this.lineItems.length > 0) {
    console.log('🔄 Calculating quotation totals...');

    this.subtotal = this.lineItems.reduce((sum, item) => {
      return sum + (item.qty * item.price);
    }, 0);

    this.totalDiscount = this.lineItems.reduce((sum, item) => {
      const itemSubtotal = item.qty * item.price;
      const discountAmount = itemSubtotal * (item.discount / 100);
      return sum + discountAmount;
    }, 0);

    this.totalTax = this.lineItems.reduce((sum, item) => {
      return sum + (item.taxAmount || 0);
    }, 0);

    this.grandTotal = this.lineItems.reduce((sum, item) => {
      return sum + item.amount;
    }, 0);

    this.subtotal = Math.round(this.subtotal * 100) / 100;
    this.totalDiscount = Math.round(this.totalDiscount * 100) / 100;
    this.totalTax = Math.round(this.totalTax * 100) / 100;
    this.grandTotal = Math.round(this.grandTotal * 100) / 100;

    console.log('✅ Totals calculated');
  }
  next();
});

// ============================================
// INSTANCE METHOD: Calculate line item amounts
// ============================================
quotationSchema.methods.calculateLineItemAmounts = async function() {
  const TaxType = mongoose.model('TaxType');

  for (let item of this.lineItems) {
    // Fetch tax rate percentage (optional)
    let taxRatePercent = 0;

    if (item.taxRate) {
      const taxType = await TaxType.findById(item.taxRate);
      if (taxType) {
        taxRatePercent = taxType.taxPercentage || 0;
      }
    }

    const subtotal = item.qty * item.price;
    const discountAmount = subtotal * (item.discount / 100);
    const afterDiscount = subtotal - discountAmount;

    let taxAmount = 0;
    let amount = 0;

    if (this.amountTreatment === 'Inclusive') {
      taxAmount = afterDiscount - (afterDiscount / (1 + taxRatePercent / 100));
      amount = afterDiscount;
    } else if (this.amountTreatment === 'Exclusive') {
      taxAmount = afterDiscount * (taxRatePercent / 100);
      amount = afterDiscount + taxAmount;
    } else {
      taxAmount = 0;
      amount = afterDiscount;
    }

    item.taxAmount = Math.round(taxAmount * 100) / 100;
    item.amount = Math.round(amount * 100) / 100;
  }
};

module.exports = mongoose.model('Quotation', quotationSchema);
