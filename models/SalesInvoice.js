// models/SalesInvoice.js
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
    // NOT required here - will be set by middleware
  },
  
  taxRate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxType'
    // NOT required here - will be set by middleware
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
// MAIN SALES INVOICE SCHEMA
// ============================================
const salesInvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
    // NOT required here - will be set by middleware
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
  
  amountTreatment: {
    type: String,
    enum: {
      values: ['Inclusive', 'Exclusive', 'No Tax'],
      message: '{VALUE} is not a valid amount treatment'
    },
    required: [true, 'Amount treatment is required'],
    default: 'Exclusive'
  },
  
  lineItems: {
    type: [lineItemSchema],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Invoice must have at least one line item'
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
    enum: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
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
salesInvoiceSchema.index({ invoiceNumber: 1 });
salesInvoiceSchema.index({ contact: 1 });
salesInvoiceSchema.index({ issueDate: -1 });
salesInvoiceSchema.index({ status: 1 });

// ============================================
// PRE-VALIDATE MIDDLEWARE 1: Auto-generate Invoice Number
// ============================================
salesInvoiceSchema.pre('validate', async function(next) {
  // Only generate if new and doesn't have invoice number
  if (this.isNew && !this.invoiceNumber) {
    try {
      const lastInvoice = await this.constructor.findOne(
        {},
        { invoiceNumber: 1 },
        { sort: { invoiceNumber: -1 } }
      );

      let nextNumber = 1;
      
      if (lastInvoice && lastInvoice.invoiceNumber) {
        const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      this.invoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;
      console.log('✅ Generated invoice number:', this.invoiceNumber);
    } catch (error) {
      console.error('❌ Error generating invoice number:', error);
      return next(error);
    }
  }
  next();
});

// ============================================
// PRE-VALIDATE MIDDLEWARE 2: Auto-populate from Item
// ============================================
salesInvoiceSchema.pre('validate', async function(next) {
  try {
    const Item = mongoose.model('Item');
    
    console.log('🔄 Auto-populating line items from Item collection...');
    
    for (let i = 0; i < this.lineItems.length; i++) {
      const lineItem = this.lineItems[i];
      
      // Fetch item from database
      const item = await Item.findById(lineItem.item)
        .populate('saleAccount')
        .populate('taxRateOnSale');
      
      if (!item) {
        return next(new Error(`Item not found: ${lineItem.item}`));
      }
      
      console.log(`   Item ${i + 1}: ${item.name}`);
      
      // Auto-populate description
      if (!lineItem.description || lineItem.description === '') {
        lineItem.description = item.description || '';
        console.log(`   ✅ Populated description: ${lineItem.description || '(empty)'}`);
      }
      
      // Auto-populate price
      if (!lineItem.price || lineItem.price === 0) {
        lineItem.price = item.salePrice || 0;
        console.log(`   ✅ Populated price: ${lineItem.price}`);
      }
      
      // Auto-populate account
      if (!lineItem.account) {
        if (!item.saleAccount) {
          return next(new Error(`Item "${item.name}" does not have a sale account configured`));
        }
        lineItem.account = item.saleAccount._id || item.saleAccount;
        console.log(`   ✅ Populated account: ${lineItem.account}`);
      }
      
      // Auto-populate tax rate
      if (!lineItem.taxRate) {
        if (!item.taxRateOnSale) {
          return next(new Error(`Item "${item.name}" does not have a tax rate configured`));
        }
        lineItem.taxRate = item.taxRateOnSale._id || item.taxRateOnSale;
        console.log(`   ✅ Populated tax rate: ${lineItem.taxRate}`);
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
salesInvoiceSchema.pre('save', async function(next) {
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
// PRE-SAVE MIDDLEWARE 2: Calculate invoice totals
// ============================================
salesInvoiceSchema.pre('save', function(next) {
  if (this.lineItems && this.lineItems.length > 0) {
    console.log('🔄 Calculating invoice totals...');
    
    // Calculate subtotal
    this.subtotal = this.lineItems.reduce((sum, item) => {
      return sum + (item.qty * item.price);
    }, 0);

    // Calculate total discount
    this.totalDiscount = this.lineItems.reduce((sum, item) => {
      const itemSubtotal = item.qty * item.price;
      const discountAmount = itemSubtotal * (item.discount / 100);
      return sum + discountAmount;
    }, 0);

    // Calculate total tax
    this.totalTax = this.lineItems.reduce((sum, item) => {
      return sum + (item.taxAmount || 0);
    }, 0);

    // Calculate grand total
    this.grandTotal = this.lineItems.reduce((sum, item) => {
      return sum + item.amount;
    }, 0);

    // Round to 2 decimal places
    this.subtotal = Math.round(this.subtotal * 100) / 100;
    this.totalDiscount = Math.round(this.totalDiscount * 100) / 100;
    this.totalTax = Math.round(this.totalTax * 100) / 100;
    this.grandTotal = Math.round(this.grandTotal * 100) / 100;
    
    console.log('✅ Totals calculated:');
    console.log(`   Subtotal: ${this.subtotal}`);
    console.log(`   Discount: ${this.totalDiscount}`);
    console.log(`   Tax: ${this.totalTax}`);
    console.log(`   Grand Total: ${this.grandTotal}`);
  }
  next();
});

// ============================================
// INSTANCE METHOD: Calculate line item amounts
// ============================================
salesInvoiceSchema.methods.calculateLineItemAmounts = async function() {
  const TaxType = mongoose.model('TaxType');
  
  for (let item of this.lineItems) {
    // Fetch tax rate percentage
    const taxType = await TaxType.findById(item.taxRate);
    
    if (!taxType) {
      throw new Error(`Tax type not found: ${item.taxRate}`);
    }
    
    const taxRatePercent = taxType.rate || 0;

    // Calculate subtotal
    const subtotal = item.qty * item.price;
    
    // Apply discount
    const discountAmount = subtotal * (item.discount / 100);
    const afterDiscount = subtotal - discountAmount;

    // Calculate tax based on treatment
    let taxAmount = 0;
    let amount = 0;
    
    if (this.amountTreatment === 'Inclusive') {
      taxAmount = afterDiscount - (afterDiscount / (1 + taxRatePercent / 100));
      amount = afterDiscount;
    } else if (this.amountTreatment === 'Exclusive') {
      taxAmount = afterDiscount * (taxRatePercent / 100);
      amount = afterDiscount + taxAmount;
    } else { // 'No Tax'
      taxAmount = 0;
      amount = afterDiscount;
    }

    // Round to 2 decimal places
    item.taxAmount = Math.round(taxAmount * 100) / 100;
    item.amount = Math.round(amount * 100) / 100;
  }
};

module.exports = mongoose.model('SalesInvoice', salesInvoiceSchema);