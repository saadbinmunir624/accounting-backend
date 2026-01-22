// models/Bill.js
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
// MAIN BILL SCHEMA
// ============================================
const billSchema = new mongoose.Schema({
  billNumber: {
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
    required: [true, 'Due date is required']
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
      message: 'Bill must have at least one line item'
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
    enum: ['Draft', 'Payment Pending', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Draft'
  },

  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
// billNumber already has unique index, no need for .index()
billSchema.index({ contact: 1 });
billSchema.index({ issueDate: -1 });
billSchema.index({ status: 1 });

// ============================================
// PRE-VALIDATE MIDDLEWARE 0: Validate split payment amounts
// ============================================
billSchema.pre('validate', function(next) {
  // If paymentAccounts exists and has items, validate the total
  if (this.paymentAccounts && this.paymentAccounts.length > 0) {
    const totalPaymentAmount = this.paymentAccounts.reduce((sum, payment) => {
      return sum + (payment.amount || 0);
    }, 0);

    // Round to 2 decimal places for comparison
    const roundedTotal = Math.round(totalPaymentAmount * 100) / 100;
    const roundedGrandTotal = Math.round(this.grandTotal * 100) / 100;

    // Allow small floating point differences (0.01)
    if (Math.abs(roundedTotal - roundedGrandTotal) > 0.01) {
      return next(new Error(
        `Split payment total ($${roundedTotal}) must equal grand total ($${roundedGrandTotal})`
      ));
    }
  }
  next();
});

// ============================================
// PRE-VALIDATE MIDDLEWARE 0.5: Auto-set Overdue status when due date passes
// ============================================
billSchema.pre('validate', function(next) {
  // Only check for overdue if status is currently 'Payment Pending'
  if (this.status === 'Payment Pending' && this.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(this.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    // If due date has passed, automatically set to Overdue
    if (dueDate < today) {
      this.status = 'Overdue';
    }
  }
  next();
});

// ============================================
// PRE-VALIDATE MIDDLEWARE 1: Auto-generate Bill Number
// ============================================
billSchema.pre('validate', async function(next) {
  if (this.isNew && !this.billNumber) {
    try {
      const lastBill = await this.constructor.findOne(
        {},
        { billNumber: 1 },
        { sort: { billNumber: -1 } }
      );

      let nextNumber = 1;

      if (lastBill && lastBill.billNumber) {
        const match = lastBill.billNumber.match(/BILL-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      this.billNumber = `BILL-${String(nextNumber).padStart(2, '0')}`;
      console.log('✅ Generated bill number:', this.billNumber);
    } catch (error) {
      console.error('❌ Error generating bill number:', error);
      return next(error);
    }
  }
  next();
});

// ============================================
// PRE-VALIDATE MIDDLEWARE 2: Auto-populate from Item
// ============================================
billSchema.pre('validate', async function(next) {
  try {
    const Item = mongoose.model('Item');

    console.log('🔄 Auto-populating line items from Item collection...');

    for (let i = 0; i < this.lineItems.length; i++) {
      const lineItem = this.lineItems[i];

      const item = await Item.findById(lineItem.item)
        .populate('purchaseAccount')
        .populate('taxRateOnPurchase');

      if (!item) {
        return next(new Error(`Item not found: ${lineItem.item}`));
      }

      if (!lineItem.description || lineItem.description === '') {
        lineItem.description = item.description || '';
      }

      if (!lineItem.price || lineItem.price === 0) {
        lineItem.price = item.costPrice || 0;
      }

      if (!lineItem.account && item.purchaseAccount) {
        lineItem.account = item.purchaseAccount._id || item.purchaseAccount;
      }

      if (!lineItem.taxRate && item.taxRateOnPurchase) {
        lineItem.taxRate = item.taxRateOnPurchase._id || item.taxRateOnPurchase;
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
billSchema.pre('save', async function(next) {
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
// PRE-SAVE MIDDLEWARE 2: Calculate bill totals
// ============================================
billSchema.pre('save', function(next) {
  if (this.lineItems && this.lineItems.length > 0) {
    console.log('🔄 Calculating bill totals...');

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
billSchema.methods.calculateLineItemAmounts = async function() {
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

module.exports = mongoose.model('Bill', billSchema);
