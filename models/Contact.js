const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  postalCode: {
    type: String,
    trim: true
  }
}, { _id: false });

const financialDetailsSchema = new mongoose.Schema({
  bankAccountName: {
    type: String,
    trim: true
  },
  bankAccountNumber: {
    type: String,
    trim: true
  },
  bankDetails: {
    type: String,
    trim: true
  },
  taxIdNumber: {
    type: String,
    trim: true
  }
}, { _id: false });

const contactSchema = new mongoose.Schema({
  contactName: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true
  },
  accountNumber: {
    type: String,
    trim: true
  },
  contactType: {
    isCustomer: {
      type: Boolean,
      default: false
    },
    isSupplier: {
      type: Boolean,
      default: false
    }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  businessRegistrationNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  billingAddress: {
    type: addressSchema,
    default: {}
  },
  deliveryAddress: {
    type: addressSchema,
    default: {}
  },
  financialDetails: {
    type: financialDetailsSchema,
    default: {}
  }
}, {
  timestamps: true
});

// Validation: At least one contact type must be selected
contactSchema.pre('save', function(next) {
  if (!this.contactType.isCustomer && !this.contactType.isSupplier) {
    next(new Error('Contact must be either a Customer or Supplier (or both)'));
  } else {
    next();
  }
});


module.exports = mongoose.model('Contact', contactSchema);