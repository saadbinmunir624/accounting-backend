// routes/quotations.js
const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quotation');
const SalesInvoice = require('../models/SalesInvoice');
const Contact = require('../models/Contact');
const BankAccount = require('../models/BankAccount');
const Item = require('../models/Item');
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
// HELPER: Check and update overdue quotations (only once per day)
// ============================================
const updateOverdueQuotations = async () => {
  // Only run if it's a new day
  if (!isNewDay()) {
    console.log('>>> Overdue check already ran today, skipping...');
    return;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastOverdueCheckDate = today;
  
  const sentQuotations = await Quotation.find({ status: 'Sent' });
  
  console.log(`\n>>> DAILY OVERDUE CHECK: Checking ${sentQuotations.length} 'Sent' quotations...`);
  console.log(`Today's date (no time): ${today.toISOString().split('T')[0]}`);
  
  for (let quotation of sentQuotations) {
    if (quotation.dueDate) {
      const dueDate = new Date(quotation.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      const dueDateStr = dueDate.toISOString().split('T')[0];
      console.log(`Quotation ${quotation.quotationNumber}: Due=${dueDateStr}, Status=${quotation.status}, IsPastDue=${dueDate < today}`);
      
      if (dueDate < today) {
        console.log(`  → Updating ${quotation.quotationNumber} to Overdue`);
        quotation.status = 'Overdue';
        try {
          await quotation.save();
          console.log(`  ✓ Successfully saved ${quotation.quotationNumber}`);
        } catch (err) {
          console.error(`  ✗ Error saving ${quotation.quotationNumber}:`, err.message);
        }
      }
    }
  }
  console.log(`<<< Overdue check complete\n`);
};

// ============================================
// GET all quotations
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status, contact, startDate, endDate } = req.query;

    // Update overdue quotations before fetching
    await updateOverdueQuotations();

    const filter = {};
    if (status) filter.status = status;
    if (contact) filter.contact = contact;
    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = new Date(startDate);
      if (endDate) filter.issueDate.$lte = new Date(endDate);
    }

    const quotations = await Quotation.find(filter)
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
      .populate('salesInvoiceId', 'invoiceNumber')
      .sort({ issueDate: -1, quotationNumber: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error) {
    console.error('GET quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// ============================================
// GET single quotation by ID
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
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
      })
      .populate('salesInvoiceId', 'invoiceNumber status');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    console.error('GET quotation by ID error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid quotation ID format'
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
// POST create new quotation
// ============================================
router.post('/', async (req, res) => {
  try {
    console.log('\n=== QUOTATION CREATION ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    if (req.body.contact) {
      const contactExists = await Contact.findById(req.body.contact);
      if (!contactExists) {
        return res.status(400).json({
          success: false,
          message: 'Contact not found'
        });
      }
    }

    if (req.body.onlinePayment) {
      const bankAccountExists = await BankAccount.findById(req.body.onlinePayment);
      if (!bankAccountExists) {
        return res.status(400).json({
          success: false,
          message: 'Bank account not found'
        });
      }
    }

    if (!req.body.lineItems || req.body.lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quotation must have at least one line item'
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

    const quotation = await Quotation.create(req.body);

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('contact', 'contactName email phone accountNumber')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName');

    console.log('Quotation created:', populatedQuotation.quotationNumber);
    console.log('=== END CREATION ===\n');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: populatedQuotation
    });

  } catch (error) {
    console.error('\n=== QUOTATION ERROR ===');
    console.error('Error:', error);
    console.error('=== END ERROR ===\n');

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Quotation number already exists'
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
// PATCH update quotation
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    console.log('Updating quotation:', req.params.id);

    const existingQuotation = await Quotation.findById(req.params.id);

    if (!existingQuotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Handle overdue logic on due date changes
    if (req.body.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newDueDate = new Date(req.body.dueDate);
      newDueDate.setHours(0, 0, 0, 0);

      // Auto-revert: If updating dueDate to today/future and currently Overdue, move back to Sent (unless explicitly marking Paid)
      if (existingQuotation.status === 'Overdue' && newDueDate >= today && req.body.status !== 'Paid') {
        console.log(`  → Auto-reverting ${existingQuotation.quotationNumber} from Overdue to Sent (due date moved to future)`);
        req.body.status = 'Sent';
      }
    }

    // If quotation is Overdue and due date is still in the past, only allow status change to Paid unless due date is moved future
    if (existingQuotation.status === 'Overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveDue = req.body.dueDate ? new Date(req.body.dueDate) : existingQuotation.dueDate;
      if (effectiveDue) effectiveDue.setHours(0, 0, 0, 0);

      const stillPastDue = effectiveDue && effectiveDue < today;
      if (stillPastDue && req.body.status && req.body.status !== 'Paid') {
        return res.status(400).json({
          success: false,
          message: 'Overdue quotation: change due date to today/future or set status to Paid'
        });
      }
    }

    // Don't allow editing quotation number
    if (req.body.quotationNumber) {
      delete req.body.quotationNumber;
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

    // If status is being changed to "Approved", convert to sales invoice
    if (req.body.status === 'Approved' && existingQuotation.status !== 'Approved') {
      // Create sales invoice from quotation
      const invoiceData = {
        contact: existingQuotation.contact,
        issueDate: existingQuotation.issueDate,
        dueDate: existingQuotation.dueDate,
        reference: existingQuotation.reference,
        onlinePayment: existingQuotation.onlinePayment,
        paymentAccounts: existingQuotation.paymentAccounts && existingQuotation.paymentAccounts.length > 0
          ? existingQuotation.paymentAccounts.map(payment => ({
              bankAccount: payment.bankAccount,
              amount: payment.amount
            }))
          : undefined,
        amountTreatment: existingQuotation.amountTreatment,
        lineItems: existingQuotation.lineItems.map(item => ({
          item: item.item,
          description: item.description,
          price: item.price,
          account: item.account,
          taxRate: item.taxRate,
          qty: item.qty,
          discount: item.discount,
          project: item.project,
          taxAmount: item.taxAmount,
          amount: item.amount
        })),
        status: 'Draft',
        notes: existingQuotation.notes
      };

      const salesInvoice = await SalesInvoice.create(invoiceData);

      // Update quotation with conversion details
      existingQuotation.convertedToInvoice = true;
      existingQuotation.salesInvoiceId = salesInvoice._id;
      existingQuotation.status = 'Approved';
    } else {
      // Normal update
      Object.assign(existingQuotation, req.body);
    }

    await existingQuotation.save();

    const updatedQuotation = await Quotation.findById(existingQuotation._id)
      .populate('contact', 'contactName email phone')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName')
      .populate('salesInvoiceId', 'invoiceNumber status');

    res.status(200).json({
      success: true,
      message: updatedQuotation.convertedToInvoice
        ? 'Quotation approved and converted to sales invoice'
        : 'Quotation updated successfully',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('PATCH quotation error:', error);

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
// DELETE quotation
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quotation deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('DELETE quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

module.exports = router;
