const mongoose = require('mongoose');

const accountTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Account type name is required'],
    unique: true,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AccountType', accountTypeSchema);