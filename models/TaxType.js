const mongoose = require('mongoose');

const taxTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tax type name is required'],
    unique: true,
    trim: true
  },
  taxPercentage: {
    type: Number,
    required: [true, 'Tax percentage is required'],
    min: [0, 'Tax percentage cannot be negative'],
    max: [100, 'Tax percentage cannot exceed 100']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TaxType', taxTypeSchema);