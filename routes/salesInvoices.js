// routes/salesInvoices.js
const express = require('express');
const router = express.Router();
const SalesInvoice = require('../models/SalesInvoice');
const Contact = require('../models/Contact');
const BankAccount = require('../models/BankAccount');
const Item = require('../models/Item');
const ChartOfAccount = require('../models/ChartOfAccount');
const TaxType = require('../models/TaxType');
const Project = require('../models/Project');

// ============================================
// GET all sales invoices
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status, contact, startDate, endDate } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (contact) filter.contact = contact;
    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = new Date(startDate);
      if (endDate) filter.issueDate.$lte = new Date(endDate);
    }
    
    const invoices = await SalesInvoice.find(filter)
      .populate('contact', 'contactName email phone accountNumber')
      .populate('onlinePayment', 'bankName accountName')
      .populate({
        path: 'paymentAccounts.bankAccount',
        select: 'bankName accountName'
      })
      .populate({
        path: 'lineItems.item',
        select: 'itemCode name'
      })
      .populate({
        path: 'lineItems.account',
        select: 'code name'
      })
      .populate({
        path: 'lineItems.taxRate',
        select: 'name rate'
      })
      .populate({
        path: 'lineItems.project',
        select: 'projectCode projectName'
      })
      .sort({ issueDate: -1, invoiceNumber: -1 });
    
    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('GET sales invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// ============================================
// GET single sales invoice by ID
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const invoice = await SalesInvoice.findById(req.params.id)
      .populate('contact', 'contactName email phone accountNumber billingAddress')
      .populate('onlinePayment', 'bankName accountName bankAccountType')
      .populate({
        path: 'paymentAccounts.bankAccount',
        select: 'bankName accountName bankAccountType'
      })
      .populate({
        path: 'lineItems.item',
        select: 'itemCode name description'
      })
      .populate({
        path: 'lineItems.account',
        select: 'code name'
      })
      .populate({
        path: 'lineItems.taxRate',
        select: 'name rate'
      })
      .populate({
        path: 'lineItems.project',
        select: 'projectCode projectName status'
      });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Sales invoice not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('GET sales invoice by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// ============================================
// POST create new sales invoice
// ============================================
router.post('/', async (req, res) => {
  try {
    console.log('\n=== SALES INVOICE CREATION ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Validate contact exists
    if (req.body.contact) {
      const contactExists = await Contact.findById(req.body.contact);
      if (!contactExists) {
        return res.status(400).json({
          success: false,
          message: 'Contact not found',
          hint: 'Please use GET /api/contacts to get valid contact IDs'
        });
      }
    }
    
    // Validate online payment if provided
    if (req.body.onlinePayment) {
      const bankAccountExists = await BankAccount.findById(req.body.onlinePayment);
      if (!bankAccountExists) {
        return res.status(400).json({
          success: false,
          message: 'Bank account not found'
        });
      }
    }
    
    // Validate line items
    if (!req.body.lineItems || req.body.lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice must have at least one line item'
      });
    }

    // Clean up empty strings in line items for ObjectId fields
    req.body.lineItems = req.body.lineItems.map(item => {
      const cleanedItem = { ...item };
      if (cleanedItem.account === '') delete cleanedItem.account;
      if (cleanedItem.taxRate === '') delete cleanedItem.taxRate;
      if (cleanedItem.project === '') delete cleanedItem.project;
      return cleanedItem;
    });
    
    // Validate each line item's item reference
    for (let i = 0; i < req.body.lineItems.length; i++) {
      const lineItem = req.body.lineItems[i];
      
      const itemExists = await Item.findById(lineItem.item);
      if (!itemExists) {
        return res.status(400).json({
          success: false,
          message: `Item not found for line item ${i + 1}`,
          itemId: lineItem.item
        });
      }
      
      // Validate project if provided
      if (lineItem.project) {
        const projectExists = await Project.findById(lineItem.project);
        if (!projectExists) {
          return res.status(400).json({
            success: false,
            message: `Project not found for line item ${i + 1}`
          });
        }
      }
    }
    
    // Create invoice
    // Pre-save middleware will:
    // 1. Auto-generate invoice number
    // 2. Auto-populate missing fields from Item
    // 3. Calculate amounts
    // 4. Calculate totals
    const invoice = await SalesInvoice.create(req.body);
    
    // Populate and return
    const populatedInvoice = await SalesInvoice.findById(invoice._id)
      .populate('contact', 'contactName email phone accountNumber')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName');
    
    console.log('Invoice created:', populatedInvoice.invoiceNumber);
    console.log('Grand Total:', populatedInvoice.grandTotal);
    console.log('=== END CREATION ===\n');
    
    res.status(201).json({
      success: true,
      message: 'Sales invoice created successfully',
      data: populatedInvoice
    });
    
  } catch (error) {
    console.error('\n=== SALES INVOICE ERROR ===');
    console.error('Error:', error);
    console.error('=== END ERROR ===\n');
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// ============================================
// PATCH update sales invoice
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    console.log('Updating invoice:', req.params.id);

    const existingInvoice = await SalesInvoice.findById(req.params.id);

    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Sales invoice not found'
      });
    }

    // Don't allow editing invoice number
    if (req.body.invoiceNumber) {
      delete req.body.invoiceNumber;
    }

    // Clean up empty strings in line items for ObjectId fields
    if (req.body.lineItems) {
      req.body.lineItems = req.body.lineItems.map(item => {
        const cleanedItem = { ...item };
        if (cleanedItem.account === '') delete cleanedItem.account;
        if (cleanedItem.taxRate === '') delete cleanedItem.taxRate;
        if (cleanedItem.project === '') delete cleanedItem.project;
        return cleanedItem;
      });
    }
    
    // Update invoice
    Object.assign(existingInvoice, req.body);
    await existingInvoice.save();
    
    // Populate and return
    const updatedInvoice = await SalesInvoice.findById(existingInvoice._id)
      .populate('contact', 'contactName email phone')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName');
    
    res.status(200).json({
      success: true,
      message: 'Sales invoice updated successfully',
      data: updatedInvoice
    });
  } catch (error) {
    console.error('PATCH invoice error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// ============================================
// DELETE sales invoice
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await SalesInvoice.findByIdAndDelete(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Sales invoice not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Sales invoice deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('DELETE invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

module.exports = router;