const mongoose = require('mongoose');
const Income = require('../models/Income');
const Expense = require('../models/Expense');

const EXPENSE_FIELDS = ['date', 'amount', 'category', 'description', 'paymentMethod'];
const INCOME_FIELDS = ['date', 'amount', 'source', 'category', 'description'];

const EXPENSE_TEMPLATE_ROWS = [
  ['2026-08-01', '250', 'Food', 'Lunch at office', 'UPI'],
  ['2026-08-02', '1200', 'Transport', 'Cab to airport', 'Card'],
  ['2026-08-03', '80', 'Shopping', 'Groceries', 'Cash'],
  ['2026-08-04', '3500', 'Bills', 'Electricity bill', 'UPI'],
  ['2026-08-05', '600', 'Entertainment', 'Movie tickets', 'Card'],
];

const INCOME_TEMPLATE_ROWS = [
  ['2026-08-01', '25000', 'Salary', 'Salary', 'Monthly salary'],
  ['2026-08-05', '3000', 'Freelance', 'Side Income', 'Website development work'],
  ['2026-08-10', '1500', 'Investment', 'Dividends', 'Mutual fund dividend'],
  ['2026-08-15', '500', 'Other', 'Cashback', 'Credit card cashback'],
];

function generateCSV(headers, rows) {
  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
  });
  return lines.join('\n');
}

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

function validateAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && isFinite(num) && num > 0 && num < 1e12;
}

function parseDate(dateStr) {
  if (!dateStr) return { valid: false, error: 'Date is required' };
  const str = String(dateStr).trim();
  const d = new Date(str);
  if (isNaN(d.getTime())) return { valid: false, error: `Invalid date format: "${str}"` };
  return { valid: true, date: d };
}

function validateExpenseRow(row, index) {
  const errors = [];
  const rowNum = index + 1;

  if (!row.amount && row.amount !== 0) {
    errors.push(`Row ${rowNum}: Amount is required`);
  } else if (!validateAmount(row.amount)) {
    errors.push(`Row ${rowNum}: Amount must be a positive number`);
  }

  if (!row.category || String(row.category).trim() === '') {
    errors.push(`Row ${rowNum}: Category is required`);
  }

  const dateResult = parseDate(row.date);
  if (!dateResult.valid) {
    errors.push(`Row ${rowNum}: ${dateResult.error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      amount: Number(row.amount),
      category: sanitizeString(row.category, 50),
      date: dateResult.date,
      description: sanitizeString(row.description || '', 500),
      paymentMethod: sanitizeString(row.paymentmethod || row.paymentMethod || '', 50),
    } : null,
  };
}

function validateIncomeRow(row, index) {
  const errors = [];
  const rowNum = index + 1;

  if (!row.amount && row.amount !== 0) {
    errors.push(`Row ${rowNum}: Amount is required`);
  } else if (!validateAmount(row.amount)) {
    errors.push(`Row ${rowNum}: Amount must be a positive number`);
  }

  if (!row.source || String(row.source).trim() === '') {
    errors.push(`Row ${rowNum}: Source is required`);
  }

  const dateResult = parseDate(row.date);
  if (!dateResult.valid) {
    errors.push(`Row ${rowNum}: ${dateResult.error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      amount: Number(row.amount),
      source: sanitizeString(row.source, 100),
      date: dateResult.date,
      description: sanitizeString(row.description || '', 500),
      category: sanitizeString(row.category || '', 50),
    } : null,
  };
}

exports.downloadExpenseTemplate = (req, res) => {
  const csv = generateCSV(EXPENSE_FIELDS, EXPENSE_TEMPLATE_ROWS);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=expense-template.csv');
  res.send(csv);
};

exports.downloadIncomeTemplate = (req, res) => {
  const csv = generateCSV(INCOME_FIELDS, INCOME_TEMPLATE_ROWS);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=income-template.csv');
  res.send(csv);
};

exports.importExpenses = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data rows provided' });
    }

    if (rows.length > 2000) {
      return res.status(400).json({ success: false, error: 'Maximum 2000 rows allowed per import' });
    }

    const validDocs = [];
    const allErrors = [];

    rows.forEach((row, i) => {
      const result = validateExpenseRow(row, i);
      if (result.valid && result.data) {
        validDocs.push({
          insertOne: {
            document: {
              userId: new mongoose.Types.ObjectId(req.userId),
              ...result.data,
            }
          }
        });
      } else {
        allErrors.push(...result.errors);
      }
    });

    if (validDocs.length === 0) {
      return res.status(400).json({
        success: false,
        imported: 0,
        failed: rows.length,
        errors: allErrors.slice(0, 20),
      });
    }

    const result = await Expense.bulkWrite(validDocs, { ordered: false });

    res.json({
      success: true,
      imported: result.insertedCount || validDocs.length,
      failed: allErrors.length,
      errors: allErrors.slice(0, 20),
    });
  } catch (err) {
    console.error('[IMPORT EXPENSES] Error:', err.message);
    res.status(500).json({ success: false, error: 'Server error during import' });
  }
};

exports.importIncome = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data rows provided' });
    }

    if (rows.length > 2000) {
      return res.status(400).json({ success: false, error: 'Maximum 2000 rows allowed per import' });
    }

    const validDocs = [];
    const allErrors = [];

    rows.forEach((row, i) => {
      const result = validateIncomeRow(row, i);
      if (result.valid && result.data) {
        validDocs.push({
          insertOne: {
            document: {
              userId: new mongoose.Types.ObjectId(req.userId),
              ...result.data,
            }
          }
        });
      } else {
        allErrors.push(...result.errors);
      }
    });

    if (validDocs.length === 0) {
      return res.status(400).json({
        success: false,
        imported: 0,
        failed: rows.length,
        errors: allErrors.slice(0, 20),
      });
    }

    const result = await Income.bulkWrite(validDocs, { ordered: false });

    res.json({
      success: true,
      imported: result.insertedCount || validDocs.length,
      failed: allErrors.length,
      errors: allErrors.slice(0, 20),
    });
  } catch (err) {
    console.error('[IMPORT INCOME] Error:', err.message);
    res.status(500).json({ success: false, error: 'Server error during import' });
  }
};
