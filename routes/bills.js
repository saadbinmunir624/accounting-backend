// routes/bills.js
const express = require('express');
const router = express.Router();
const Bill = require('../models/Bill');
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
// HELPER: Check and update overdue bills (only once per day)
// ============================================
const updateOverdueBills = async () => {
  // Only run if it's a new day
  if (!isNewDay()) {
    console.log('>>> Overdue check already ran today, skipping...');
    return;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastOverdueCheckDate = today;
  
  const sentBills = await Bill.find({ status: 'Payment Pending' });
  
  console.log(`\n>>> DAILY OVERDUE CHECK: Checking ${sentBills.length} 'Payment Pending' bills...`);
  console.log(`Today's date (no time): ${today.toISOString().split('T')[0]}`);
  
  for (let bill of sentBills) {
    if (bill.dueDate) {
      const dueDate = new Date(bill.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      const dueDateStr = dueDate.toISOString().split('T')[0];
      console.log(`Bill ${bill.billNumber}: Due=${dueDateStr}, Status=${bill.status}, IsPastDue=${dueDate < today}`);
      
      if (dueDate < today) {
        console.log(`  → Updating ${bill.billNumber} to Overdue`);
        bill.status = 'Overdue';
        try {
          await bill.save();
          console.log(`  ✓ Successfully saved ${bill.billNumber}`);
        } catch (err) {
          console.error(`  ✗ Error saving ${bill.billNumber}:`, err.message);
        }
      }
    }
  }
  console.log(`<<< Overdue check complete\n`);
};

// ============================================
// GET all bills
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status, contact, startDate, endDate } = req.query;

    // Update overdue bills before fetching
    await updateOverdueBills();

    const filter = {};
    if (status) filter.status = status;
    if (contact) filter.contact = contact;
    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = new Date(startDate);
      if (endDate) filter.issueDate.$lte = new Date(endDate);
    }

    const bills = await Bill.find(filter)
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
      .sort({ issueDate: -1, billNumber: -1 });

    res.status(200).json({
      success: true,
      count: bills.length,
      data: bills
    });
  } catch (error) {
    console.error('GET bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// ============================================
// GET single bill by ID
// ============================================
router.get('/:id', async (req, res) => {
  try {
    // Update overdue bills before fetching
    await updateOverdueBills();
    
    const bill = await Bill.findById(req.params.id)
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

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    console.error('GET bill by ID error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid bill ID format'
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
// POST create new bill
// ============================================
router.post('/', async (req, res) => {
  try {
    console.log('\n=== BILL CREATION ===');
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
        message: 'Bill must have at least one line item'
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

    const bill = await Bill.create(req.body);

    const populatedBill = await Bill.findById(bill._id)
      .populate('contact', 'contactName email phone accountNumber')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName');

    console.log('Bill created:', populatedBill.billNumber);
    console.log('=== END CREATION ===\n');

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: populatedBill
    });

  } catch (error) {
    console.error('\n=== BILL ERROR ===');
    console.error('Error:', error);
    console.error('=== END ERROR ===\n');

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bill number already exists'
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
// PATCH update bill
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    console.log('Updating bill:', req.params.id);

    const existingBill = await Bill.findById(req.params.id);

    if (!existingBill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Handle overdue logic on due date changes
    if (req.body.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newDueDate = new Date(req.body.dueDate);
      newDueDate.setHours(0, 0, 0, 0);

      // Auto-revert: If updating dueDate to today/future and currently Overdue, move back to Payment Pending
      if (existingBill.status === 'Overdue' && newDueDate >= today) {
        console.log(`  → Auto-reverting ${existingBill.billNumber} from Overdue to Payment Pending (due date moved to future)`);
        req.body.status = 'Payment Pending';
      }
    }

    // If bill is Overdue and due date is still in the past, prevent status changes
    if (existingBill.status === 'Overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveDue = req.body.dueDate ? new Date(req.body.dueDate) : existingBill.dueDate;
      if (effectiveDue) effectiveDue.setHours(0, 0, 0, 0);

      const stillPastDue = effectiveDue && effectiveDue < today;
      if (stillPastDue && req.body.status && req.body.status !== 'Overdue') {
        return res.status(400).json({
          success: false,
          message: 'Overdue bill: change due date to today/future before changing status'
        });
      }
    }

    // Don't allow editing bill number
    if (req.body.billNumber) {
      delete req.body.billNumber;
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

    Object.assign(existingBill, req.body);
    await existingBill.save();

    const updatedBill = await Bill.findById(existingBill._id)
      .populate('contact', 'contactName email phone')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName');

    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: updatedBill
    });
  } catch (error) {
    console.error('PATCH bill error:', error);

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
// DELETE bill
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bill deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('DELETE bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

module.exports = router;
