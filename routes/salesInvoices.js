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
// TRACKING: Last overdue check date
// ============================================
let lastOverdueCheckDate = null;

// ============================================
// HELPER: Check if today is a new day
// ============================================
const isNewDay = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!lastOverdueCheckDate) return true;
  
  const lastCheckDate = new Date(lastOverdueCheckDate);
  lastCheckDate.setHours(0, 0, 0, 0);
  
  return today > lastCheckDate;
};

// ============================================
// HELPER: Check and update overdue invoices (only once per day)
// ============================================
const updateOverdueInvoices = async () => {
  // Only run if it's a new day
  if (!isNewDay()) {
    console.log('>>> Overdue check already ran today, skipping...');
    return;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastOverdueCheckDate = today;
  
  const sentInvoices = await SalesInvoice.find({ status: 'Sent' });
  
  console.log(`\n>>> DAILY OVERDUE CHECK: Checking ${sentInvoices.length} 'Sent' invoices...`);
  console.log(`Today's date (no time): ${today.toISOString().split('T')[0]}`);
  
  for (let invoice of sentInvoices) {
    if (invoice.dueDate) {
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      const dueDateStr = dueDate.toISOString().split('T')[0];
      console.log(`Invoice ${invoice.invoiceNumber}: Due=${dueDateStr}, Status=${invoice.status}, IsPastDue=${dueDate < today}`);
      
      if (dueDate < today) {
        console.log(`  → Updating ${invoice.invoiceNumber} to Overdue`);
        invoice.status = 'Overdue';
        try {
          await invoice.save();
          console.log(`  ✓ Successfully saved ${invoice.invoiceNumber}`);
        } catch (err) {
          console.error(`  ✗ Error saving ${invoice.invoiceNumber}:`, err.message);
        }
      }
    }
  }
  console.log(`<<< Overdue check complete\n`);
};

// ============================================
// GET all sales invoices
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status, contact, startDate, endDate } = req.query;
    
    // Update overdue invoices before fetching
    await updateOverdueInvoices();
    
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
    // Update overdue invoices before fetching
    await updateOverdueInvoices();
    
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

    // Handle overdue logic on due date changes
    if (req.body.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newDueDate = new Date(req.body.dueDate);
      newDueDate.setHours(0, 0, 0, 0);

      // Auto-revert: If updating dueDate to today/future and currently Overdue, move back to Sent (unless explicitly marking Paid)
      if (existingInvoice.status === 'Overdue' && newDueDate >= today && req.body.status !== 'Paid') {
        console.log(`  → Auto-reverting ${existingInvoice.invoiceNumber} from Overdue to Sent (due date moved to future)`);
        req.body.status = 'Sent';
      }
    }

    // If invoice is Overdue and due date is still in the past, only allow status change to Paid unless due date is moved future
    if (existingInvoice.status === 'Overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveDue = req.body.dueDate ? new Date(req.body.dueDate) : existingInvoice.dueDate;
      if (effectiveDue) effectiveDue.setHours(0, 0, 0, 0);

      const stillPastDue = effectiveDue && effectiveDue < today;
      if (stillPastDue && req.body.status && req.body.status !== 'Paid') {
        return res.status(400).json({
          success: false,
          message: 'Overdue invoice: change due date to today/future or set status to Paid'
        });
      }
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