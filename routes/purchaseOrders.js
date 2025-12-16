// routes/purchaseOrders.js
const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Bill = require('../models/Bill');
const Contact = require('../models/Contact');
const BankAccount = require('../models/BankAccount');
const Item = require('../models/Item');
const Project = require('../models/Project');

// ============================================
// GET all purchase orders
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

    const purchaseOrders = await PurchaseOrder.find(filter)
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
      .populate('billId', 'billNumber')
      .sort({ issueDate: -1, purchaseOrderNumber: -1 });

    res.status(200).json({
      success: true,
      count: purchaseOrders.length,
      data: purchaseOrders
    });
  } catch (error) {
    console.error('GET purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// ============================================
// GET single purchase order by ID
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
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
      .populate('billId', 'billNumber status');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: purchaseOrder
    });
  } catch (error) {
    console.error('GET purchase order by ID error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase order ID format'
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
// POST create new purchase order
// ============================================
router.post('/', async (req, res) => {
  try {
    console.log('\n=== PURCHASE ORDER CREATION ===');
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
        message: 'Purchase order must have at least one line item'
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

    const purchaseOrder = await PurchaseOrder.create(req.body);

    const populatedPO = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('contact', 'contactName email phone accountNumber')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName');

    console.log('Purchase order created:', populatedPO.purchaseOrderNumber);
    console.log('=== END CREATION ===\n');

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: populatedPO
    });

  } catch (error) {
    console.error('\n=== PURCHASE ORDER ERROR ===');
    console.error('Error:', error);
    console.error('=== END ERROR ===\n');

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order number already exists'
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
// PATCH update purchase order
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    console.log('Updating purchase order:', req.params.id);

    const existingPO = await PurchaseOrder.findById(req.params.id);

    if (!existingPO) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Don't allow editing purchase order number
    if (req.body.purchaseOrderNumber) {
      delete req.body.purchaseOrderNumber;
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

    // If status is being changed to "Approved", convert to bill
    if (req.body.status === 'Approved' && existingPO.status !== 'Approved') {
      // Create bill from purchase order
      const billData = {
        contact: existingPO.contact,
        issueDate: existingPO.issueDate,
        dueDate: existingPO.dueDate,
        reference: existingPO.reference,
        onlinePayment: existingPO.onlinePayment,
        paymentAccounts: existingPO.paymentAccounts && existingPO.paymentAccounts.length > 0
          ? existingPO.paymentAccounts.map(payment => ({
              bankAccount: payment.bankAccount,
              amount: payment.amount
            }))
          : undefined,
        amountTreatment: existingPO.amountTreatment,
        lineItems: existingPO.lineItems.map(item => ({
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
        notes: existingPO.notes
      };

      const bill = await Bill.create(billData);

      // Update purchase order with conversion details
      existingPO.convertedToBill = true;
      existingPO.billId = bill._id;
      existingPO.status = 'Approved';
    } else {
      // Normal update
      Object.assign(existingPO, req.body);
    }

    await existingPO.save();

    const updatedPO = await PurchaseOrder.findById(existingPO._id)
      .populate('contact', 'contactName email phone')
      .populate('onlinePayment', 'bankName accountName')
      .populate('paymentAccounts.bankAccount', 'bankName accountName')
      .populate('lineItems.item', 'itemCode name')
      .populate('lineItems.account', 'code name')
      .populate('lineItems.taxRate', 'name rate')
      .populate('lineItems.project', 'projectCode projectName')
      .populate('billId', 'billNumber status');

    res.status(200).json({
      success: true,
      message: updatedPO.convertedToBill
        ? 'Purchase order approved and converted to bill'
        : 'Purchase order updated successfully',
      data: updatedPO
    });
  } catch (error) {
    console.error('PATCH purchase order error:', error);

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
// DELETE purchase order
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findByIdAndDelete(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Purchase order deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('DELETE purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

module.exports = router;
