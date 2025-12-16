// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('✅ MongoDB Connected Successfully');
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// Import routes
const accountTypeRoutes = require('./routes/accountTypes');
const bankAccountRoutes = require('./routes/bankAccounts');
const bankAccountTypeRoutes = require('./routes/bankAccountTypes');
const billRoutes = require('./routes/bills');
const chartOfAccountsRoutes = require('./routes/chartOfAccounts');
const contactRoutes = require('./routes/contacts');
const itemRoutes = require('./routes/items');
const projectRoutes = require('./routes/projects');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const quotationRoutes = require('./routes/quotations');
const salesInvoiceRoutes = require('./routes/salesInvoices');
const taxTypeRoutes = require('./routes/taxTypes');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    endpoints: {
      accountTypes: '/api/account-types',
      bankAccounts: '/api/bank-accounts',
      bankAccountTypes: '/api/bank-account-types',
      bills: '/api/bills',
      chartOfAccounts: '/api/chart-of-accounts',
      contacts: '/api/contacts',
      items: '/api/items',
      projects: '/api/projects',
      purchaseOrders: '/api/purchase-orders',
      quotations: '/api/quotations',
      salesInvoices: '/api/sales-invoices',
      taxTypes: '/api/tax-types',
      users: '/api/users'
    }
  });
});

// Routes
app.use('/api/account-types', accountTypeRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/bank-account-types', bankAccountTypeRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/sales-invoices', salesInvoiceRoutes);
app.use('/api/tax-types', taxTypeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('ERROR DETAILS:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? {
      message: err.message,
      stack: err.stack
    } : {}
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;