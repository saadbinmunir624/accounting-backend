// routes/reports.js
const express = require('express');
const router = express.Router();
const SalesInvoice = require('../models/SalesInvoice');
const Bill = require('../models/Bill');
const Contact = require('../models/Contact');
const Quotation = require('../models/Quotation');
const PurchaseOrder = require('../models/PurchaseOrder');

// Helper function to parse date range
const parseDateRange = (req) => {
  const { startDate, endDate } = req.query;
  let filter = {};

  if (startDate && endDate) {
    filter.issueDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return filter;
};

// @route   GET /api/reports/profit-loss
// @desc    Get Profit & Loss report
// @access  Private
router.get('/profit-loss', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const [invoices, bills] = await Promise.all([
      SalesInvoice.find(dateFilter).select('grandTotal subtotal totalTax status'),
      Bill.find(dateFilter).select('grandTotal subtotal totalTax status')
    ]);

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalExpenses = bills.reduce((sum, bill) => sum + (bill.grandTotal || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const totalRevenueSubtotal = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const totalExpensesSubtotal = bills.reduce((sum, bill) => sum + (bill.subtotal || 0), 0);

    const totalRevenueTax = invoices.reduce((sum, inv) => sum + (inv.totalTax || 0), 0);
    const totalExpensesTax = bills.reduce((sum, bill) => sum + (bill.totalTax || 0), 0);

    res.json({
      revenue: totalRevenue,
      revenueSubtotal: totalRevenueSubtotal,
      revenueTax: totalRevenueTax,
      expenses: totalExpenses,
      expensesSubtotal: totalExpensesSubtotal,
      expensesTax: totalExpensesTax,
      netProfit,
      invoiceCount: invoices.length,
      billCount: bills.length
    });
  } catch (error) {
    console.error('Error generating profit-loss report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/sales-summary
// @desc    Get Sales Summary report
// @access  Private
router.get('/sales-summary', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter).select('grandTotal totalTax status subtotal');

    const totalSales = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalSubtotal = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const totalTax = invoices.reduce((sum, inv) => sum + (inv.totalTax || 0), 0);

    const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
    const unpaidInvoices = invoices.filter(inv => inv.status === 'Unpaid');

    const totalPaid = paidInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    res.json({
      totalSales,
      totalSubtotal,
      totalTax,
      totalPaid,
      totalUnpaid,
      invoiceCount: invoices.length,
      paidCount: paidInvoices.length,
      unpaidCount: unpaidInvoices.length
    });
  } catch (error) {
    console.error('Error generating sales-summary report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/purchase-summary
// @desc    Get Purchase Summary report
// @access  Private
router.get('/purchase-summary', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const bills = await Bill.find(dateFilter).select('grandTotal totalTax status subtotal');

    const totalPurchases = bills.reduce((sum, bill) => sum + (bill.grandTotal || 0), 0);
    const totalSubtotal = bills.reduce((sum, bill) => sum + (bill.subtotal || 0), 0);
    const totalTax = bills.reduce((sum, bill) => sum + (bill.totalTax || 0), 0);

    const paidBills = bills.filter(bill => bill.status === 'Paid');
    const unpaidBills = bills.filter(bill => bill.status === 'Unpaid');

    const totalPaid = paidBills.reduce((sum, bill) => sum + (bill.grandTotal || 0), 0);
    const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + (bill.grandTotal || 0), 0);

    res.json({
      totalPurchases,
      totalSubtotal,
      totalTax,
      totalPaid,
      totalUnpaid,
      billCount: bills.length,
      paidCount: paidBills.length,
      unpaidCount: unpaidBills.length
    });
  } catch (error) {
    console.error('Error generating purchase-summary report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/sales-by-customer
// @desc    Get Sales by Customer report
// @access  Private
router.get('/sales-by-customer', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter)
      .populate('contact', 'name')
      .select('contact grandTotal');

    const customerSales = {};

    invoices.forEach(inv => {
      const customerId = inv.contact?._id?.toString() || 'Unknown';
      const customerName = inv.contact?.name || 'Unknown Customer';

      if (!customerSales[customerId]) {
        customerSales[customerId] = {
          customerId,
          name: customerName,
          totalSales: 0,
          invoiceCount: 0
        };
      }

      customerSales[customerId].totalSales += inv.grandTotal || 0;
      customerSales[customerId].invoiceCount += 1;
    });

    const customers = Object.values(customerSales).sort((a, b) => b.totalSales - a.totalSales);

    res.json({ customers });
  } catch (error) {
    console.error('Error generating sales-by-customer report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/purchase-by-vendor
// @desc    Get Purchase by Vendor report
// @access  Private
router.get('/purchase-by-vendor', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const bills = await Bill.find(dateFilter)
      .populate('contact', 'name')
      .select('contact grandTotal');

    const vendorPurchases = {};

    bills.forEach(bill => {
      const vendorId = bill.contact?._id?.toString() || 'Unknown';
      const vendorName = bill.contact?.name || 'Unknown Vendor';

      if (!vendorPurchases[vendorId]) {
        vendorPurchases[vendorId] = {
          vendorId,
          name: vendorName,
          totalPurchases: 0,
          billCount: 0
        };
      }

      vendorPurchases[vendorId].totalPurchases += bill.grandTotal || 0;
      vendorPurchases[vendorId].billCount += 1;
    });

    const vendors = Object.values(vendorPurchases).sort((a, b) => b.totalPurchases - a.totalPurchases);

    res.json({ vendors });
  } catch (error) {
    console.error('Error generating purchase-by-vendor report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/customer-balance
// @desc    Get Customer Balance report
// @access  Private
router.get('/customer-balance', async (req, res) => {
  try {
    const invoices = await SalesInvoice.find()
      .populate('contact', 'name')
      .select('contact grandTotal status');

    const customerBalances = {};

    invoices.forEach(inv => {
      const customerId = inv.contact?._id?.toString() || 'Unknown';
      const customerName = inv.contact?.name || 'Unknown Customer';

      if (!customerBalances[customerId]) {
        customerBalances[customerId] = {
          customerId,
          name: customerName,
          totalInvoiced: 0,
          totalPaid: 0,
          balance: 0
        };
      }

      customerBalances[customerId].totalInvoiced += inv.grandTotal || 0;
      if (inv.status === 'Paid') {
        customerBalances[customerId].totalPaid += inv.grandTotal || 0;
      }
    });

    Object.keys(customerBalances).forEach(id => {
      customerBalances[id].balance = customerBalances[id].totalInvoiced - customerBalances[id].totalPaid;
    });

    const customers = Object.values(customerBalances)
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    res.json({ customers });
  } catch (error) {
    console.error('Error generating customer-balance report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/vendor-balance
// @desc    Get Vendor Balance report
// @access  Private
router.get('/vendor-balance', async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate('contact', 'name')
      .select('contact grandTotal status');

    const vendorBalances = {};

    bills.forEach(bill => {
      const vendorId = bill.contact?._id?.toString() || 'Unknown';
      const vendorName = bill.contact?.name || 'Unknown Vendor';

      if (!vendorBalances[vendorId]) {
        vendorBalances[vendorId] = {
          vendorId,
          name: vendorName,
          totalBilled: 0,
          totalPaid: 0,
          balance: 0
        };
      }

      vendorBalances[vendorId].totalBilled += bill.grandTotal || 0;
      if (bill.status === 'Paid') {
        vendorBalances[vendorId].totalPaid += bill.grandTotal || 0;
      }
    });

    Object.keys(vendorBalances).forEach(id => {
      vendorBalances[id].balance = vendorBalances[id].totalBilled - vendorBalances[id].totalPaid;
    });

    const vendors = Object.values(vendorBalances)
      .filter(v => v.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    res.json({ vendors });
  } catch (error) {
    console.error('Error generating vendor-balance report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/aged-receivables
// @desc    Get Aged Receivables report
// @access  Private
router.get('/aged-receivables', async (req, res) => {
  try {
    const unpaidInvoices = await SalesInvoice.find({ status: 'Unpaid' })
      .populate('contact', 'name')
      .select('contact invoiceNumber grandTotal dueDate');

    const aging = {
      current: [],
      days30: [],
      days60: [],
      days90: [],
      days90Plus: []
    };

    const today = new Date();

    unpaidInvoices.forEach(inv => {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      const invData = {
        customer: inv.contact?.name || 'Unknown',
        invoiceNumber: inv.invoiceNumber,
        amount: inv.grandTotal || 0,
        daysOverdue,
        dueDate: inv.dueDate
      };

      if (daysOverdue <= 0) {
        aging.current.push(invData);
      } else if (daysOverdue <= 30) {
        aging.days30.push(invData);
      } else if (daysOverdue <= 60) {
        aging.days60.push(invData);
      } else if (daysOverdue <= 90) {
        aging.days90.push(invData);
      } else {
        aging.days90Plus.push(invData);
      }
    });

    const totals = {
      current: aging.current.reduce((sum, inv) => sum + inv.amount, 0),
      days30: aging.days30.reduce((sum, inv) => sum + inv.amount, 0),
      days60: aging.days60.reduce((sum, inv) => sum + inv.amount, 0),
      days90: aging.days90.reduce((sum, inv) => sum + inv.amount, 0),
      days90Plus: aging.days90Plus.reduce((sum, inv) => sum + inv.amount, 0)
    };

    res.json({ aging, totals });
  } catch (error) {
    console.error('Error generating aged-receivables report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/aged-payables
// @desc    Get Aged Payables report
// @access  Private
router.get('/aged-payables', async (req, res) => {
  try {
    const unpaidBills = await Bill.find({ status: 'Unpaid' })
      .populate('contact', 'name')
      .select('contact billNumber grandTotal dueDate');

    const aging = {
      current: [],
      days30: [],
      days60: [],
      days90: [],
      days90Plus: []
    };

    const today = new Date();

    unpaidBills.forEach(bill => {
      const dueDate = new Date(bill.dueDate);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      const billData = {
        vendor: bill.contact?.name || 'Unknown',
        billNumber: bill.billNumber,
        amount: bill.grandTotal || 0,
        daysOverdue,
        dueDate: bill.dueDate
      };

      if (daysOverdue <= 0) {
        aging.current.push(billData);
      } else if (daysOverdue <= 30) {
        aging.days30.push(billData);
      } else if (daysOverdue <= 60) {
        aging.days60.push(billData);
      } else if (daysOverdue <= 90) {
        aging.days90.push(billData);
      } else {
        aging.days90Plus.push(billData);
      }
    });

    const totals = {
      current: aging.current.reduce((sum, bill) => sum + bill.amount, 0),
      days30: aging.days30.reduce((sum, bill) => sum + bill.amount, 0),
      days60: aging.days60.reduce((sum, bill) => sum + bill.amount, 0),
      days90: aging.days90.reduce((sum, bill) => sum + bill.amount, 0),
      days90Plus: aging.days90Plus.reduce((sum, bill) => sum + bill.amount, 0)
    };

    res.json({ aging, totals });
  } catch (error) {
    console.error('Error generating aged-payables report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/invoice-details
// @desc    Get Invoice Details report
// @access  Private
router.get('/invoice-details', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter)
      .populate('contact', 'name')
      .select('invoiceNumber issueDate contact status subtotal totalTax grandTotal')
      .sort({ issueDate: -1 });

    const invoiceList = invoices.map(inv => ({
      number: inv.invoiceNumber,
      date: inv.issueDate,
      customer: inv.contact?.name || 'Unknown',
      status: inv.status,
      subtotal: inv.subtotal || 0,
      tax: inv.totalTax || 0,
      total: inv.grandTotal || 0
    }));

    res.json({ invoices: invoiceList });
  } catch (error) {
    console.error('Error generating invoice-details report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/bill-details
// @desc    Get Bill Details report
// @access  Private
router.get('/bill-details', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const bills = await Bill.find(dateFilter)
      .populate('contact', 'name')
      .select('billNumber issueDate contact status subtotal totalTax grandTotal')
      .sort({ issueDate: -1 });

    const billList = bills.map(bill => ({
      number: bill.billNumber,
      date: bill.issueDate,
      vendor: bill.contact?.name || 'Unknown',
      status: bill.status,
      subtotal: bill.subtotal || 0,
      tax: bill.totalTax || 0,
      total: bill.grandTotal || 0
    }));

    res.json({ bills: billList });
  } catch (error) {
    console.error('Error generating bill-details report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
