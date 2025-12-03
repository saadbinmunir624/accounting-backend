// models/BankAccountType.js
const mongoose = require('mongoose');

const bankAccountTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Account type name is required'],
    unique: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BankAccountType', bankAccountTypeSchema);