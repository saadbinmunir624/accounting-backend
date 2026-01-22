// routes/reports.js
const express = require('express');
const router = express.Router();
const SalesInvoice = require('../models/SalesInvoice');
const Bill = require('../models/Bill');
const Contact = require('../models/Contact');
const ChartOfAccount = require('../models/ChartOfAccount');
const BankAccount = require('../models/BankAccount');
const Item = require('../models/Item');

// Helper: Parse date range from query
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

// ============ FINANCIAL REPORTS ============

// Profit & Loss Report
router.get('/profit-loss', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const [invoices, bills] = await Promise.all([
      SalesInvoice.find(dateFilter).select('grandTotal subtotal totalTax status'),
      Bill.find(dateFilter).select('grandTotal subtotal totalTax status')
    ]);

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalExpenses = bills.reduce((sum, bill) => sum + (bill.grandTotal || 0), 0);

    res.json({
      type: 'profit-loss',
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      invoiceCount: invoices.length,
      billCount: bills.length
    });
  } catch (error) {
    console.error('Error generating profit-loss report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Balance Sheet
router.get('/balance-sheet', async (req, res) => {
  try {
    const accounts = await ChartOfAccount.find()
      .populate('accountType')
      .select('code name description accountType');

    const assets = accounts.filter(a => a.accountType?.name === 'Asset');
    const liabilities = accounts.filter(a => a.accountType?.name === 'Liability');
    const equity = accounts.filter(a => a.accountType?.name === 'Equity');

    res.json({
      type: 'balance-sheet',
      assets,
      liabilities,
      equity,
      totalAssets: assets.length,
      totalLiabilities: liabilities.length,
      totalEquity: equity.length
    });
  } catch (error) {
    console.error('Error generating balance-sheet report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Cash Flow Statement
router.get('/cash-flow', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter).select('grandTotal status');
    const bills = await Bill.find(dateFilter).select('grandTotal status');

    const inflow = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.grandTotal || 0), 0);
    const outflow = bills.filter(b => b.status === 'Paid').reduce((s, b) => s + (b.grandTotal || 0), 0);

    res.json({
      type: 'cash-flow',
      inflow,
      outflow,
      netCashFlow: inflow - outflow
    });
  } catch (error) {
    console.error('Error generating cash-flow report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Income Statement
router.get('/income-statement', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter).select('subtotal totalTax');
    const bills = await Bill.find(dateFilter).select('subtotal totalTax');

    const revenue = invoices.reduce((s, i) => s + (i.subtotal || 0), 0);
    const expenses = bills.reduce((s, b) => s + (b.subtotal || 0), 0);
    const grossProfit = revenue - expenses;

    res.json({
      type: 'income-statement',
      revenue,
      expenses,
      grossProfit,
      netIncome: grossProfit
    });
  } catch (error) {
    console.error('Error generating income-statement report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// ============ SALES REPORTS ============

// Sales Summary
router.get('/sales-summary', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter)
      .select('grandTotal totalTax status subtotal');

    const totalSales = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalTax = invoices.reduce((s, i) => s + (i.totalTax || 0), 0);
    const paidInvoices = invoices.filter(i => i.status === 'Paid');
    const unpaidInvoices = invoices.filter(i => i.status === 'Unpaid');

    res.json({
      type: 'sales-summary',
      totalSales,
      totalTax,
      totalPaid: paidInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0),
      totalUnpaid: unpaidInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0),
      invoiceCount: invoices.length,
      paidCount: paidInvoices.length,
      unpaidCount: unpaidInvoices.length
    });
  } catch (error) {
    console.error('Error generating sales-summary report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Sales by Customer
router.get('/sales-by-customer', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter)
      .populate('contact', 'contactName')
      .select('contact grandTotal');

    const customerSales = {};
    invoices.forEach(inv => {
      const customerId = inv.contact?._id?.toString() || 'Unknown';
      const customerName = inv.contact?.contactName || 'Unknown';

      if (!customerSales[customerId]) {
        customerSales[customerId] = { customerId, name: customerName, totalSales: 0, invoiceCount: 0 };
      }

      customerSales[customerId].totalSales += inv.grandTotal || 0;
      customerSales[customerId].invoiceCount += 1;
    });

    const customers = Object.values(customerSales)
      .sort((a, b) => b.totalSales - a.totalSales);

    res.json({ type: 'sales-by-customer', customers });
  } catch (error) {
    console.error('Error generating sales-by-customer report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Invoice Details
router.get('/invoice-details', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);
    const { status } = req.query;

    let filter = dateFilter;
    if (status) filter.status = status;

    const invoices = await SalesInvoice.find(filter)
      .populate('contact', 'contactName')
      .select('invoiceNumber issueDate contact status subtotal totalTax grandTotal')
      .sort({ issueDate: -1 });

    const invoiceList = invoices.map(inv => ({
      number: inv.invoiceNumber,
      date: inv.issueDate,
      customer: inv.contact?.contactName || 'Unknown',
      status: inv.status,
      subtotal: inv.subtotal || 0,
      tax: inv.totalTax || 0,
      total: inv.grandTotal || 0
    }));

    res.json({ type: 'invoice-details', invoices: invoiceList });
  } catch (error) {
    console.error('Error generating invoice-details report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Customer Balance
router.get('/customer-balance', async (req, res) => {
  try {
    const invoices = await SalesInvoice.find()
      .populate('contact', 'contactName')
      .select('contact grandTotal status');

    const customerBalances = {};
    invoices.forEach(inv => {
      const customerId = inv.contact?._id?.toString() || 'Unknown';
      const customerName = inv.contact?.contactName || 'Unknown';

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

    res.json({ type: 'customer-balance', customers });
  } catch (error) {
    console.error('Error generating customer-balance report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Aged Receivables
router.get('/aged-receivables', async (req, res) => {
  try {
    const unpaidInvoices = await SalesInvoice.find({ status: 'Unpaid' })
      .populate('contact', 'contactName')
      .select('contact invoiceNumber grandTotal dueDate');

    const aging = { current: [], days30: [], days60: [], days90: [], days90Plus: [] };
    const today = new Date();

    unpaidInvoices.forEach(inv => {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      const invData = {
        customer: inv.contact?.contactName || 'Unknown',
        invoiceNumber: inv.invoiceNumber,
        amount: inv.grandTotal || 0,
        daysOverdue,
        dueDate: inv.dueDate
      };

      if (daysOverdue <= 0) aging.current.push(invData);
      else if (daysOverdue <= 30) aging.days30.push(invData);
      else if (daysOverdue <= 60) aging.days60.push(invData);
      else if (daysOverdue <= 90) aging.days90.push(invData);
      else aging.days90Plus.push(invData);
    });

    const totals = {
      current: aging.current.reduce((s, i) => s + i.amount, 0),
      days30: aging.days30.reduce((s, i) => s + i.amount, 0),
      days60: aging.days60.reduce((s, i) => s + i.amount, 0),
      days90: aging.days90.reduce((s, i) => s + i.amount, 0),
      days90Plus: aging.days90Plus.reduce((s, i) => s + i.amount, 0)
    };

    res.json({ type: 'aged-receivables', aging, totals });
  } catch (error) {
    console.error('Error generating aged-receivables report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// ============ PURCHASE REPORTS ============

// Purchase Summary
router.get('/purchase-summary', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const bills = await Bill.find(dateFilter)
      .select('grandTotal totalTax status subtotal');

    const totalPurchases = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const totalTax = bills.reduce((s, b) => s + (b.totalTax || 0), 0);
    const paidBills = bills.filter(b => b.status === 'Paid');
    const unpaidBills = bills.filter(b => b.status === 'Unpaid');

    res.json({
      type: 'purchase-summary',
      totalPurchases,
      totalTax,
      totalPaid: paidBills.reduce((s, b) => s + (b.grandTotal || 0), 0),
      totalUnpaid: unpaidBills.reduce((s, b) => s + (b.grandTotal || 0), 0),
      billCount: bills.length,
      paidCount: paidBills.length,
      unpaidCount: unpaidBills.length
    });
  } catch (error) {
    console.error('Error generating purchase-summary report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Purchase by Vendor
router.get('/purchase-by-vendor', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const bills = await Bill.find(dateFilter)
      .populate('contact', 'contactName')
      .select('contact grandTotal');

    const vendorPurchases = {};
    bills.forEach(bill => {
      const vendorId = bill.contact?._id?.toString() || 'Unknown';
      const vendorName = bill.contact?.contactName || 'Unknown';

      if (!vendorPurchases[vendorId]) {
        vendorPurchases[vendorId] = { vendorId, name: vendorName, totalPurchases: 0, billCount: 0 };
      }

      vendorPurchases[vendorId].totalPurchases += bill.grandTotal || 0;
      vendorPurchases[vendorId].billCount += 1;
    });

    const vendors = Object.values(vendorPurchases)
      .sort((a, b) => b.totalPurchases - a.totalPurchases);

    res.json({ type: 'purchase-by-vendor', vendors });
  } catch (error) {
    console.error('Error generating purchase-by-vendor report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Bill Details
router.get('/bill-details', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);
    const { status } = req.query;

    let filter = dateFilter;
    if (status) filter.status = status;

    const bills = await Bill.find(filter)
      .populate('contact', 'contactName')
      .select('billNumber issueDate contact status subtotal totalTax grandTotal')
      .sort({ issueDate: -1 });

    const billList = bills.map(bill => ({
      number: bill.billNumber,
      date: bill.issueDate,
      vendor: bill.contact?.contactName || 'Unknown',
      status: bill.status,
      subtotal: bill.subtotal || 0,
      tax: bill.totalTax || 0,
      total: bill.grandTotal || 0
    }));

    res.json({ type: 'bill-details', bills: billList });
  } catch (error) {
    console.error('Error generating bill-details report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Vendor Balance
router.get('/vendor-balance', async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate('contact', 'contactName')
      .select('contact grandTotal status');

    const vendorBalances = {};
    bills.forEach(bill => {
      const vendorId = bill.contact?._id?.toString() || 'Unknown';
      const vendorName = bill.contact?.contactName || 'Unknown';

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

    res.json({ type: 'vendor-balance', vendors });
  } catch (error) {
    console.error('Error generating vendor-balance report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Aged Payables
router.get('/aged-payables', async (req, res) => {
  try {
    const unpaidBills = await Bill.find({ status: 'Unpaid' })
      .populate('contact', 'contactName')
      .select('contact billNumber grandTotal dueDate');

    const aging = { current: [], days30: [], days60: [], days90: [], days90Plus: [] };
    const today = new Date();

    unpaidBills.forEach(bill => {
      const dueDate = new Date(bill.dueDate);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      const billData = {
        vendor: bill.contact?.contactName || 'Unknown',
        billNumber: bill.billNumber,
        amount: bill.grandTotal || 0,
        daysOverdue,
        dueDate: bill.dueDate
      };

      if (daysOverdue <= 0) aging.current.push(billData);
      else if (daysOverdue <= 30) aging.days30.push(billData);
      else if (daysOverdue <= 60) aging.days60.push(billData);
      else if (daysOverdue <= 90) aging.days90.push(billData);
      else aging.days90Plus.push(billData);
    });

    const totals = {
      current: aging.current.reduce((s, b) => s + b.amount, 0),
      days30: aging.days30.reduce((s, b) => s + b.amount, 0),
      days60: aging.days60.reduce((s, b) => s + b.amount, 0),
      days90: aging.days90.reduce((s, b) => s + b.amount, 0),
      days90Plus: aging.days90Plus.reduce((s, b) => s + b.amount, 0)
    };

    res.json({ type: 'aged-payables', aging, totals });
  } catch (error) {
    console.error('Error generating aged-payables report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// ============ CONTACT REPORTS ============

// Contact Transactions
router.get('/contact-transactions', async (req, res) => {
  try {
    const { contactId } = req.query;
    const dateFilter = parseDateRange(req);

    let filter = dateFilter;

    const [invoices, bills] = await Promise.all([
      SalesInvoice.find({ ...filter, contact: contactId || { $exists: true } })
        .populate('contact', 'contactName')
        .select('invoiceNumber issueDate contact grandTotal status'),
      Bill.find({ ...filter, contact: contactId || { $exists: true } })
        .populate('contact', 'contactName')
        .select('billNumber issueDate contact grandTotal status')
    ]);

    const transactions = [];
    invoices.forEach(inv => {
      transactions.push({
        type: 'Invoice',
        number: inv.invoiceNumber,
        contact: inv.contact?.contactName,
        date: inv.issueDate,
        amount: inv.grandTotal,
        status: inv.status
      });
    });

    bills.forEach(bill => {
      transactions.push({
        type: 'Bill',
        number: bill.billNumber,
        contact: bill.contact?.contactName,
        date: bill.issueDate,
        amount: bill.grandTotal,
        status: bill.status
      });
    });

    res.json({ type: 'contact-transactions', transactions: transactions.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (error) {
    console.error('Error generating contact-transactions report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Contact Summary
router.get('/contact-summary', async (req, res) => {
  try {
    const contacts = await Contact.find().select('contactName type');

    const summary = await Promise.all(
      contacts.map(async (contact) => {
        const invoices = await SalesInvoice.countDocuments({ contact: contact._id });
        const bills = await Bill.countDocuments({ contact: contact._id });
        return {
          name: contact.contactName,
          type: contact.type,
          invoiceCount: invoices,
          billCount: bills,
          totalTransactions: invoices + bills
        };
      })
    );

    res.json({ type: 'contact-summary', contacts: summary });
  } catch (error) {
    console.error('Error generating contact-summary report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Customer Transactions
router.get('/customer-transactions', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter)
      .populate('contact', 'contactName')
      .select('invoiceNumber issueDate contact grandTotal status')
      .sort({ issueDate: -1 });

    const transactions = invoices.map(inv => ({
      number: inv.invoiceNumber,
      date: inv.issueDate,
      customer: inv.contact?.contactName,
      amount: inv.grandTotal,
      status: inv.status
    }));

    res.json({ type: 'customer-transactions', transactions });
  } catch (error) {
    console.error('Error generating customer-transactions report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Vendor Transactions
router.get('/vendor-transactions', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const bills = await Bill.find(dateFilter)
      .populate('contact', 'contactName')
      .select('billNumber issueDate contact grandTotal status')
      .sort({ issueDate: -1 });

    const transactions = bills.map(bill => ({
      number: bill.billNumber,
      date: bill.issueDate,
      vendor: bill.contact?.contactName,
      amount: bill.grandTotal,
      status: bill.status
    }));

    res.json({ type: 'vendor-transactions', transactions });
  } catch (error) {
    console.error('Error generating vendor-transactions report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// ============ ACCOUNT REPORTS ============

// Account Activity
router.get('/account-activity', async (req, res) => {
  try {
    const { accountId } = req.query;

    const accounts = await ChartOfAccount.find(accountId ? { _id: accountId } : {})
      .populate('accountType')
      .select('code name accountType');

    res.json({ type: 'account-activity', accounts });
  } catch (error) {
    console.error('Error generating account-activity report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Account Balance
router.get('/account-balance', async (req, res) => {
  try {
    const accounts = await ChartOfAccount.find()
      .populate('accountType')
      .select('code name accountType description')
      .sort({ code: 1 });

    res.json({ type: 'account-balance', accounts, totalAccounts: accounts.length });
  } catch (error) {
    console.error('Error generating account-balance report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Account Transactions
router.get('/account-transactions', async (req, res) => {
  try {
    const { accountId } = req.query;
    const dateFilter = parseDateRange(req);

    const [invoices, bills] = await Promise.all([
      SalesInvoice.find(dateFilter).select('invoiceNumber issueDate lineItems grandTotal'),
      Bill.find(dateFilter).select('billNumber issueDate lineItems grandTotal')
    ]);

    const transactions = [];

    invoices.forEach(inv => {
      inv.lineItems?.forEach(item => {
        if (item.account?.toString() === accountId || !accountId) {
          transactions.push({
            type: 'Invoice',
            number: inv.invoiceNumber,
            date: inv.issueDate,
            amount: item.price * item.qty,
            accountId: item.account
          });
        }
      });
    });

    bills.forEach(bill => {
      bill.lineItems?.forEach(item => {
        if (item.account?.toString() === accountId || !accountId) {
          transactions.push({
            type: 'Bill',
            number: bill.billNumber,
            date: bill.issueDate,
            amount: item.price * item.qty,
            accountId: item.account
          });
        }
      });
    });

    res.json({ type: 'account-transactions', transactions: transactions.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (error) {
    console.error('Error generating account-transactions report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Trial Balance
router.get('/trial-balance', async (req, res) => {
  try {
    const accounts = await ChartOfAccount.find()
      .populate('accountType')
      .select('code name accountType');

    res.json({ type: 'trial-balance', accounts, totalAccounts: accounts.length });
  } catch (error) {
    console.error('Error generating trial-balance report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// ============ BANK ACCOUNT REPORTS ============

// Bank Account Activity
router.get('/bank-account-activity', async (req, res) => {
  try {
    const { bankAccountId } = req.query;

    const accounts = await BankAccount.find(bankAccountId ? { _id: bankAccountId } : {})
      .populate('bankAccountType')
      .select('bankName accountName bankAccountType');

    res.json({ type: 'bank-account-activity', accounts });
  } catch (error) {
    console.error('Error generating bank-account-activity report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Bank Account Balance
router.get('/bank-account-balance', async (req, res) => {
  try {
    const accounts = await BankAccount.find()
      .populate('bankAccountType')
      .select('bankName accountName bankAccountType');

    res.json({ type: 'bank-account-balance', accounts, totalAccounts: accounts.length });
  } catch (error) {
    console.error('Error generating bank-account-balance report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Bank Reconciliation
router.get('/bank-reconciliation', async (req, res) => {
  try {
    const { bankAccountId } = req.query;

    const accounts = await BankAccount.find(bankAccountId ? { _id: bankAccountId } : {})
      .populate('bankAccountType')
      .select('bankName accountName bankAccountType');

    res.json({ type: 'bank-reconciliation', accounts });
  } catch (error) {
    console.error('Error generating bank-reconciliation report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// ============ ITEM REPORTS ============

// Item Sales Report
router.get('/item-sales', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);
    const { itemId } = req.query;

    const invoices = await SalesInvoice.find(dateFilter)
      .select('lineItems grandTotal');

    const itemSales = {};
    invoices.forEach(inv => {
      inv.lineItems?.forEach(line => {
        const id = line.item?.toString() || 'Unknown';
        if (!itemId || id === itemId) {
          if (!itemSales[id]) {
            itemSales[id] = { itemId: id, quantity: 0, totalAmount: 0, transactions: 0 };
          }
          itemSales[id].quantity += line.qty || 0;
          itemSales[id].totalAmount += (line.price * line.qty) || 0;
          itemSales[id].transactions += 1;
        }
      });
    });

    const items = await Item.find().select('_id name itemCode');
    const sales = Object.values(itemSales).map(s => {
      const item = items.find(i => i._id.toString() === s.itemId);
      return { ...s, itemName: item?.name, itemCode: item?.itemCode };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({ type: 'item-sales', sales });
  } catch (error) {
    console.error('Error generating item-sales report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Item Purchases Report
router.get('/item-purchases', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);
    const { itemId } = req.query;

    const bills = await Bill.find(dateFilter)
      .select('lineItems grandTotal');

    const itemPurchases = {};
    bills.forEach(bill => {
      bill.lineItems?.forEach(line => {
        const id = line.item?.toString() || 'Unknown';
        if (!itemId || id === itemId) {
          if (!itemPurchases[id]) {
            itemPurchases[id] = { itemId: id, quantity: 0, totalAmount: 0, transactions: 0 };
          }
          itemPurchases[id].quantity += line.qty || 0;
          itemPurchases[id].totalAmount += (line.price * line.qty) || 0;
          itemPurchases[id].transactions += 1;
        }
      });
    });

    const items = await Item.find().select('_id name itemCode');
    const purchases = Object.values(itemPurchases).map(p => {
      const item = items.find(i => i._id.toString() === p.itemId);
      return { ...p, itemName: item?.name, itemCode: item?.itemCode };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({ type: 'item-purchases', purchases });
  } catch (error) {
    console.error('Error generating item-purchases report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Item Summary
router.get('/item-summary', async (req, res) => {
  try {
    const items = await Item.find().select('_id name itemCode salePrice costPrice');

    const summary = await Promise.all(
      items.map(async (item) => {
        const salesLines = await SalesInvoice.find().select('lineItems');
        const purchaseLines = await Bill.find().select('lineItems');

        let soldQty = 0, soldAmount = 0;
        let purchasedQty = 0, purchasedAmount = 0;

        salesLines.forEach(inv => {
          inv.lineItems?.forEach(line => {
            if (line.item?.toString() === item._id.toString()) {
              soldQty += line.qty || 0;
              soldAmount += (line.price * line.qty) || 0;
            }
          });
        });

        purchaseLines.forEach(bill => {
          bill.lineItems?.forEach(line => {
            if (line.item?.toString() === item._id.toString()) {
              purchasedQty += line.qty || 0;
              purchasedAmount += (line.price * line.qty) || 0;
            }
          });
        });

        return {
          itemCode: item.itemCode,
          name: item.name,
          salePrice: item.salePrice,
          costPrice: item.costPrice,
          soldQuantity: soldQty,
          soldAmount,
          purchasedQuantity: purchasedQty,
          purchasedAmount,
          profit: soldAmount - purchasedAmount
        };
      })
    );

    res.json({ type: 'item-summary', items: summary });
  } catch (error) {
    console.error('Error generating item-summary report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Item Movement
router.get('/item-movement', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);
    const { itemId } = req.query;

    const [invoices, bills] = await Promise.all([
      SalesInvoice.find(dateFilter).select('invoiceNumber issueDate lineItems'),
      Bill.find(dateFilter).select('billNumber issueDate lineItems')
    ]);

    const movements = [];

    invoices.forEach(inv => {
      inv.lineItems?.forEach(line => {
        if (!itemId || line.item?.toString() === itemId) {
          movements.push({
            type: 'Sale',
            number: inv.invoiceNumber,
            date: inv.issueDate,
            itemId: line.item,
            quantity: line.qty,
            amount: line.price * line.qty
          });
        }
      });
    });

    bills.forEach(bill => {
      bill.lineItems?.forEach(line => {
        if (!itemId || line.item?.toString() === itemId) {
          movements.push({
            type: 'Purchase',
            number: bill.billNumber,
            date: bill.issueDate,
            itemId: line.item,
            quantity: line.qty,
            amount: line.price * line.qty
          });
        }
      });
    });

    res.json({ type: 'item-movement', movements: movements.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (error) {
    console.error('Error generating item-movement report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// ============ TAX REPORTS ============

// Tax Summary
router.get('/tax-summary', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const [invoices, bills] = await Promise.all([
      SalesInvoice.find(dateFilter).select('totalTax'),
      Bill.find(dateFilter).select('totalTax')
    ]);

    const salesTax = invoices.reduce((s, i) => s + (i.totalTax || 0), 0);
    const purchaseTax = bills.reduce((s, b) => s + (b.totalTax || 0), 0);

    res.json({
      type: 'tax-summary',
      salesTax,
      purchaseTax,
      netTaxLiability: salesTax - purchaseTax
    });
  } catch (error) {
    console.error('Error generating tax-summary report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Sales Tax Report
router.get('/sales-tax', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const invoices = await SalesInvoice.find(dateFilter)
      .populate('contact', 'contactName')
      .select('invoiceNumber issueDate contact subtotal totalTax grandTotal')
      .sort({ issueDate: -1 });

    const taxDetails = invoices.map(inv => ({
      invoiceNumber: inv.invoiceNumber,
      customer: inv.contact?.contactName,
      date: inv.issueDate,
      subtotal: inv.subtotal,
      tax: inv.totalTax,
      total: inv.grandTotal
    }));

    const totalTax = invoices.reduce((s, i) => s + (i.totalTax || 0), 0);

    res.json({ type: 'sales-tax', taxDetails, totalTax });
  } catch (error) {
    console.error('Error generating sales-tax report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Purchase Tax Report
router.get('/purchase-tax', async (req, res) => {
  try {
    const dateFilter = parseDateRange(req);

    const bills = await Bill.find(dateFilter)
      .populate('contact', 'contactName')
      .select('billNumber issueDate contact subtotal totalTax grandTotal')
      .sort({ issueDate: -1 });

    const taxDetails = bills.map(bill => ({
      billNumber: bill.billNumber,
      vendor: bill.contact?.contactName,
      date: bill.issueDate,
      subtotal: bill.subtotal,
      tax: bill.totalTax,
      total: bill.grandTotal
    }));

    const totalTax = bills.reduce((s, b) => s + (b.totalTax || 0), 0);

    res.json({ type: 'purchase-tax', taxDetails, totalTax });
  } catch (error) {
    console.error('Error generating purchase-tax report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

module.exports = router;

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
