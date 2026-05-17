// Default/general chart of accounts seed data
// Each entry references an AccountType by its name via `accountTypeName`.

module.exports = [
  // REVENUE
  {
    code: '200',
    name: 'Sales Revenue',
    description: 'Income from normal business sales',
    accountTypeName: 'Sales',
  },
  {
    code: '260',
    name: 'Other Revenue',
    description: 'Income that is not part of core operations',
    accountTypeName: 'Other Income',
  },
  {
    code: '270',
    name: 'Interest Income',
    description: 'Interest earned on bank accounts or investments',
    accountTypeName: 'Revenue',
  },

  // DIRECT COSTS
  {
    code: '300',
    name: 'Purchases',
    description: 'Goods purchased with the intention of selling to customers',
    accountTypeName: 'Direct Costs',
  },
  {
    code: '310',
    name: 'Cost of Goods Sold',
    description: 'Cost of goods sold by the business',
    accountTypeName: 'Direct Costs',
  },

  // EXPENSES - OPERATING
  {
    code: '400',
    name: 'Advertising',
    description: 'Advertising and marketing expenses',
    accountTypeName: 'Expense',
  },
  {
    code: '404',
    name: 'Bank Fees',
    description: 'Bank charges and fees',
    accountTypeName: 'Expense',
  },
  {
    code: '408',
    name: 'Cleaning',
    description: 'Cleaning expenses for business premises',
    accountTypeName: 'Expense',
  },
  {
    code: '412',
    name: 'Consulting & Professional Fees',
    description: 'Consulting, accounting and professional services',
    accountTypeName: 'Expense',
  },
  {
    code: '416',
    name: 'Depreciation Expense',
    description: 'Depreciation on fixed assets',
    accountTypeName: 'Depreciation',
  },
  {
    code: '420',
    name: 'Entertainment',
    description: 'Business entertainment expenses',
    accountTypeName: 'Expense',
  },
  {
    code: '425',
    name: 'Freight & Courier',
    description: 'Freight, delivery and courier costs',
    accountTypeName: 'Expense',
  },
  {
    code: '429',
    name: 'General Expenses',
    description: 'General day-to-day running expenses',
    accountTypeName: 'Expense',
  },
  {
    code: '433',
    name: 'Insurance',
    description: 'Business insurance premiums',
    accountTypeName: 'Expense',
  },
  {
    code: '437',
    name: 'Interest Expense',
    description: 'Interest paid on loans or overdrafts',
    accountTypeName: 'Expense',
  },
  {
    code: '441',
    name: 'Legal Expenses',
    description: 'Legal and professional fees',
    accountTypeName: 'Expense',
  },
  {
    code: '445',
    name: 'Utilities',
    description: 'Light, power, heating and other utilities',
    accountTypeName: 'Expense',
  },
  {
    code: '449',
    name: 'Motor Vehicle Expenses',
    description: 'Running costs for business motor vehicles',
    accountTypeName: 'Expense',
  },
  {
    code: '453',
    name: 'Office Expenses',
    description: 'General office running expenses',
    accountTypeName: 'Expense',
  },
  {
    code: '461',
    name: 'Printing & Stationery',
    description: 'Printing, stationery and office supplies',
    accountTypeName: 'Expense',
  },
  {
    code: '469',
    name: 'Rent',
    description: 'Rent for premises or equipment',
    accountTypeName: 'Expense',
  },
  {
    code: '473',
    name: 'Repairs & Maintenance',
    description: 'Repairs and maintenance of assets',
    accountTypeName: 'Expense',
  },
  {
    code: '477',
    name: 'Wages & Salaries',
    description: 'Employee wages and salaries',
    accountTypeName: 'Expense',
  },
  {
    code: '485',
    name: 'Subscriptions',
    description: 'Subscriptions to professional bodies and services',
    accountTypeName: 'Expense',
  },
  {
    code: '489',
    name: 'Telephone & Internet',
    description: 'Telephone, mobile and internet expenses',
    accountTypeName: 'Expense',
  },
  {
    code: '493',
    name: 'Travel - Domestic',
    description: 'Domestic travel expenses for business purposes',
    accountTypeName: 'Expense',
  },
  {
    code: '494',
    name: 'Travel - International',
    description: 'International travel expenses for business purposes',
    accountTypeName: 'Expense',
  },

  // ASSETS
  {
    code: '610',
    name: 'Accounts Receivable',
    description: 'Amounts owed by customers',
    accountTypeName: 'Current Asset',
  },
  {
    code: '620',
    name: 'Prepayments',
    description: 'Expenses paid in advance',
    accountTypeName: 'Current Asset',
  },
  {
    code: '630',
    name: 'Inventory',
    description: 'Tracked inventory items for resale',
    accountTypeName: 'Inventory',
  },
  {
    code: '710',
    name: 'Office Equipment',
    description: 'Office equipment owned and controlled by the business',
    accountTypeName: 'Fixed Asset',
  },
  {
    code: '711',
    name: 'Accumulated Depreciation - Office Equipment',
    description: 'Accumulated depreciation on office equipment',
    accountTypeName: 'Fixed Asset',
  },

  // LIABILITIES
  {
    code: '800',
    name: 'Accounts Payable',
    description: 'Amounts owed to suppliers',
    accountTypeName: 'Current Liability',
  },
  {
    code: '900',
    name: 'Loan Payable',
    description: 'Long-term loan from a creditor',
    accountTypeName: 'Non-current Liability',
  },

  // EQUITY
  {
    code: '960',
    name: 'Retained Earnings',
    description: 'Accumulated profits retained in the business',
    accountTypeName: 'Equity',
  },
  {
    code: '970',
    name: 'Owner Capital',
    description: 'Capital contributed by the owner or shareholders',
    accountTypeName: 'Equity',
  },
];
