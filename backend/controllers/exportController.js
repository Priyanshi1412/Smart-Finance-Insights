const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const asyncHandler = require('../middleware/asyncHandler');
const { User, Income, Expense, Budget, Goal, Investment } = require('../models');

function fmtINR(val) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
}

function fmtDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getFinancialHealthScore(totalIncome, totalExpenses) {
  const savings = totalIncome - totalExpenses;
  let score = totalIncome > 0 ? Math.max(0, Math.min(100, Math.round((savings / totalIncome) * 100))) : 0;
  let status;
  if (score >= 90) status = 'Excellent';
  else if (score >= 75) status = 'Good';
  else if (score >= 60) status = 'Fair';
  else status = 'Poor';
  return { score, status };
}

function drawHeader(doc, title, subtitle, genDate) {
  const pageW = doc.page.width - 100;
  doc.rect(50, 40, pageW, 70).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('Smart Finance Insights', 65, 52, { width: pageW - 30 });
  doc.fontSize(12).font('Helvetica').text(title, 65, 78, { width: pageW - 30 });
  doc.fontSize(8).fillColor('#94a3b8').text(subtitle || `Generated: ${genDate}`, 65, 96, { width: pageW - 30 });
  doc.moveDown(2);
}

function drawSectionTitle(doc, y, title) {
  const pageW = doc.page.width - 100;
  doc.rect(50, y, pageW, 24).fill('#f1f5f9');
  doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(title, 62, y + 6, { width: pageW - 24 });
  return y + 32;
}

function drawSummaryCards(doc, y, cards) {
  const pageW = doc.page.width - 100;
  const cardW = (pageW - 20) / cards.length;
  cards.forEach((card, i) => {
    const x = 50 + i * (cardW + 10);
    doc.roundedRect(x, y, cardW, 48, 4).fill('#f8fafc');
    doc.rect(x, y, 4, 48).fill(card.color || '#3b82f6');
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(card.label, x + 12, y + 8, { width: cardW - 20 });
    doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold').text(card.value, x + 12, y + 22, { width: cardW - 20 });
  });
  return y + 60;
}

function drawTable(doc, y, headers, rows, opts = {}) {
  const pageW = doc.page.width - 100;
  const colCount = headers.length;
  const colWidths = opts.colWidths || headers.map(() => pageW / colCount);
  const rowH = opts.rowHeight || 20;
  const fontSize = opts.fontSize || 8;

  // Header row
  doc.rect(50, y, pageW, rowH).fill('#1e293b');
  let x = 54;
  headers.forEach((h, i) => {
    doc.fillColor('#ffffff').fontSize(fontSize).font('Helvetica-Bold').text(h, x, y + 5, { width: colWidths[i] - 8, align: opts.aligns?.[i] || 'left' });
    x += colWidths[i];
  });
  y += rowH;

  // Data rows
  rows.forEach((row, ri) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 60;
      // Re-draw header on new page
      doc.rect(50, y, pageW, rowH).fill('#1e293b');
      x = 54;
      headers.forEach((h, i) => {
        doc.fillColor('#ffffff').fontSize(fontSize).font('Helvetica-Bold').text(h, x, y + 5, { width: colWidths[i] - 8, align: opts.aligns?.[i] || 'left' });
        x += colWidths[i];
      });
      y += rowH;
    }
    const bgColor = ri % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(50, y, pageW, rowH).fill(bgColor);
    x = 54;
    row.forEach((cell, ci) => {
      doc.fillColor('#334155').fontSize(fontSize).font('Helvetica').text(String(cell ?? ''), x, y + 5, { width: colWidths[ci] - 8, align: opts.aligns?.[ci] || 'left' });
      x += colWidths[ci];
    });
    y += rowH;
  });

  return y + 4;
}

function drawFooter(doc) {
  const pageW = doc.page.width - 100;
  const y = doc.page.height - 40;
  doc.moveTo(50, y).lineTo(50 + pageW, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
    .text('Smart Finance Insights - Auto-generated financial report', 50, y + 6, { width: pageW / 2 });
  doc.text(`Page ${doc.bufferedPageRange().current + 1}`, 50 + pageW / 2, y + 6, { width: pageW / 2, align: 'right' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Export Expense Report to PDF
// ─────────────────────────────────────────────────────────────────────────────
const exportExpensePDF = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const user = await User.findById(req.userId).select('name email currency');
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [expenses, incomes, budgets] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
      Income.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Budget.find({ userId: req.userId, month: monthStr }),
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
    const health = getFinancialHealthScore(totalIncome, totalExpenses);

    // Category breakdown
    const catMap = {};
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + (e.amount || 0); });
    const categories = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 10000) / 100 : 0,
      }));

    // Budget utilization
    const budgetData = budgets.map(b => {
      const spent = catMap[b.category] || 0;
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 10000) / 100 : 0;
      let status = 'Safe';
      if (pct >= 100) status = 'Exceeded';
      else if (pct >= 75) status = 'Warning';
      return { category: b.category, budget: b.limit, spent, pct, status };
    }).sort((a, b) => b.pct - a.pct);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="expense-report-${monthStr}.pdf"`);
    doc.pipe(res);

    const genDate = fmtDateTime(now);
    drawHeader(doc, `Expense Report — ${monthStr}`, `User: ${user?.name || 'N/A'}`, genDate);
    let y = 120;

    // Summary cards
    y = drawSummaryCards(doc, y, [
      { label: 'Total Income', value: fmtINR(totalIncome), color: '#10b981' },
      { label: 'Total Expenses', value: fmtINR(totalExpenses), color: '#ef4444' },
      { label: 'Savings', value: fmtINR(savings), color: '#3b82f6' },
      { label: 'Savings Rate', value: `${savingsRate}%`, color: '#8b5cf6' },
    ]);

    // Financial health
    doc.rect(50, y, doc.page.width - 100, 24).fill('#f1f5f9');
    doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text(`Financial Health Score: ${health.score}/100 (${health.status})`, 62, y + 6);
    y += 36;

    // Category breakdown table
    if (categories.length > 0) {
      y = drawSectionTitle(doc, y, 'Category-wise Expense Breakdown');
      const pageW = doc.page.width - 100;
      y = drawTable(doc, y,
        ['Category', 'Amount', '% of Total'],
        categories.map(c => [c.category, fmtINR(c.amount), `${c.percentage}%`]),
        { colWidths: [pageW * 0.45, pageW * 0.3, pageW * 0.25], aligns: ['left', 'right', 'right'] }
      );
    }

    // Budget utilization
    if (budgetData.length > 0) {
      y += 4;
      y = drawSectionTitle(doc, y, 'Budget Utilization Summary');
      const pageW = doc.page.width - 100;
      y = drawTable(doc, y,
        ['Category', 'Budget', 'Spent', 'Utilization', 'Status'],
        budgetData.map(b => [b.category, fmtINR(b.budget), fmtINR(b.spent), `${b.pct}%`, b.status]),
        { colWidths: [pageW * 0.25, pageW * 0.2, pageW * 0.2, pageW * 0.17, pageW * 0.18], aligns: ['left', 'right', 'right', 'right', 'center'] }
      );
    }

    // Top spending categories
    if (categories.length > 0) {
      y += 4;
      y = drawSectionTitle(doc, y, 'Top Spending Categories');
      const top5 = categories.slice(0, 5);
      top5.forEach((c, i) => {
        doc.fillColor('#334155').fontSize(9).font('Helvetica')
          .text(`${i + 1}. ${c.category} — ${fmtINR(c.amount)} (${c.percentage}%)`, 62, y, { width: doc.page.width - 124 });
        y += 16;
      });
    }

    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error('[EXPORT EXPENSE PDF] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate expense report PDF' });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Export Investment Report to Excel
// ─────────────────────────────────────────────────────────────────────────────
const exportInvestmentExcel = asyncHandler(async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId }).sort({ createdAt: -1 });
    const user = await User.findById(req.userId).select('name email currency');
    const now = new Date();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Finance Insights';
    workbook.created = now;

    const sheet = workbook.addWorksheet('Investment Report', {
      properties: { defaultColWidth: 15 },
    });

    // Title row
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Smart Finance Insights — Investment Report';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Subtitle row
    sheet.mergeCells('A2:I2');
    const subCell = sheet.getCell('A2');
    subCell.value = `User: ${user?.name || 'N/A'} | Generated: ${fmtDateTime(now)}`;
    subCell.font = { size: 10, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'left' };
    sheet.getRow(2).height = 20;

    // Empty row
    sheet.getRow(3).height = 10;

    // Headers
    const headers = ['#', 'Investment Name', 'Type', 'Category', 'Amount Invested', 'Current Value', 'Profit / Loss', 'ROI %', 'Status'];
    const headerRow = sheet.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });
    headerRow.height = 26;

    // Data rows
    let totalInvested = 0;
    let totalCurrent = 0;

    investments.forEach((inv, i) => {
      const invested = inv.amount || 0;
      const current = inv.currentValue || invested;
      const pl = current - invested;
      const roi = invested > 0 ? Math.round((pl / invested) * 10000) / 100 : 0;
      totalInvested += invested;
      totalCurrent += current;

      const row = sheet.getRow(5 + i);
      row.values = [
        i + 1,
        inv.name,
        inv.type,
        inv.category,
        invested,
        current,
        pl,
        roi,
        inv.status || 'active',
      ];

      // Currency formatting for monetary columns
      [5, 6, 7].forEach(col => {
        row.getCell(col).numFmt = '₹#,##0';
      });
      row.getCell(8).numFmt = '0.00"%"';

      // Alternate row colors
      const bgColor = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
      for (let c = 1; c <= 9; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.getCell(c).alignment = { horizontal: c === 1 ? 'center' : 'left', vertical: 'middle' };
        row.getCell(c).border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }

      // Color profit/loss
      const plCell = row.getCell(7);
      if (pl > 0) plCell.font = { color: { argb: 'FF10B981' }, bold: true };
      else if (pl < 0) plCell.font = { color: { argb: 'FFEF4444' }, bold: true };

      // Color ROI
      const roiCell = row.getCell(8);
      if (roi > 0) roiCell.font = { color: { argb: 'FF10B981' }, bold: true };
      else if (roi < 0) roiCell.font = { color: { argb: 'FFEF4444' }, bold: true };
    });

    // Summary row
    const summaryRowNum = 5 + investments.length;
    const summaryRow = sheet.getRow(summaryRowNum);
    const totalPL = totalCurrent - totalInvested;
    const totalROI = totalInvested > 0 ? Math.round((totalPL / totalInvested) * 10000) / 100 : 0;

    summaryRow.getCell(1).value = '';
    summaryRow.getCell(2).value = 'PORTFOLIO TOTAL';
    summaryRow.getCell(3).value = '';
    summaryRow.getCell(4).value = '';
    summaryRow.getCell(5).value = totalInvested;
    summaryRow.getCell(6).value = totalCurrent;
    summaryRow.getCell(7).value = totalPL;
    summaryRow.getCell(8).value = totalROI;
    summaryRow.getCell(9).value = `${investments.filter(i => i.status === 'active').length} active`;

    [5, 6, 7].forEach(col => {
      summaryRow.getCell(col).numFmt = '₹#,##0';
    });
    summaryRow.getCell(8).numFmt = '0.00"%"';

    for (let c = 1; c <= 9; c++) {
      summaryRow.getCell(c).font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
      summaryRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      summaryRow.getCell(c).border = {
        top: { style: 'medium', color: { argb: 'FF3B82F6' } },
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      };
    }

    // Column widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 16;
    sheet.getColumn(8).width = 10;
    sheet.getColumn(9).width = 12;

    // Auto-filter
    sheet.autoFilter = { from: 'A4', to: `I${4 + investments.length}` };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="investment-report-${now.toISOString().slice(0, 10)}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[EXPORT INVESTMENT EXCEL] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate investment report Excel' });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Export Complete Financial Report to PDF
// ─────────────────────────────────────────────────────────────────────────────
const exportFinancialPDF = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const user = await User.findById(req.userId).select('name email currency');

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [expenses, incomes, budgets, goals, investments] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Income.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Budget.find({ userId: req.userId, month: monthStr }),
      Goal.find({ userId: req.userId }),
      Investment.find({ userId: req.userId }),
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
    const health = getFinancialHealthScore(totalIncome, totalExpenses);

    // Budget data
    const catMap = {};
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + (e.amount || 0); });
    const budgetData = budgets.map(b => {
      const spent = catMap[b.category] || 0;
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 10000) / 100 : 0;
      return { category: b.category, budget: b.limit, spent, pct };
    });

    // Goal data
    const activeGoals = goals.filter(g => g.status === 'active');
    const achievedGoals = goals.filter(g => g.status === 'achieved');
    const goalSummary = {
      total: goals.length,
      active: activeGoals.length,
      achieved: achievedGoals.length,
      overdue: goals.filter(g => g.status === 'overdue').length,
      totalTarget: goals.reduce((s, g) => s + (g.targetAmount || 0), 0),
      totalSaved: goals.reduce((s, g) => s + (g.savedAmount || 0), 0),
    };

    // Investment data
    const totalInvested = investments.reduce((s, i) => s + (i.amount || 0), 0);
    const totalCurrentValue = investments.reduce((s, i) => s + (i.currentValue || i.amount || 0), 0);
    const totalPL = totalCurrentValue - totalInvested;
    const overallROI = totalInvested > 0 ? Math.round((totalPL / totalInvested) * 100) : 0;

    // Category breakdown
    const categories = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 10000) / 100 : 0,
      }));

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report-${now.toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(res);

    const genDate = fmtDateTime(now);
    drawHeader(doc, 'Complete Financial Report', `User: ${user?.name || 'N/A'}`, genDate);
    let y = 120;

    // ── Dashboard Summary ──
    y = drawSectionTitle(doc, y, 'Dashboard Summary');
    y = drawSummaryCards(doc, y, [
      { label: 'Total Income', value: fmtINR(totalIncome), color: '#10b981' },
      { label: 'Total Expenses', value: fmtINR(totalExpenses), color: '#ef4444' },
      { label: 'Net Savings', value: fmtINR(savings), color: '#3b82f6' },
    ]);
    y = drawSummaryCards(doc, y, [
      { label: 'Savings Rate', value: `${savingsRate}%`, color: '#8b5cf6' },
      { label: 'Health Score', value: `${health.score}/100`, color: '#14b8a6' },
      { label: 'Status', value: health.status, color: health.score >= 75 ? '#10b981' : '#f59e0b' },
    ]);

    // ── Monthly Expenses ──
    if (categories.length > 0) {
      y += 4;
      y = drawSectionTitle(doc, y, 'Monthly Expense Breakdown');
      const pageW = doc.page.width - 100;
      y = drawTable(doc, y,
        ['Category', 'Amount', '% of Total'],
        categories.map(c => [c.category, fmtINR(c.amount), `${c.percentage}%`]),
        { colWidths: [pageW * 0.45, pageW * 0.3, pageW * 0.25], aligns: ['left', 'right', 'right'] }
      );
    }

    // ── Budget Utilization ──
    if (budgetData.length > 0) {
      y += 4;
      y = drawSectionTitle(doc, y, 'Budget Utilization');
      const pageW = doc.page.width - 100;
      y = drawTable(doc, y,
        ['Category', 'Budget', 'Spent', 'Utilization'],
        budgetData.map(b => [b.category, fmtINR(b.budget), fmtINR(b.spent), `${b.pct}%`]),
        { colWidths: [pageW * 0.3, pageW * 0.23, pageW * 0.23, pageW * 0.24], aligns: ['left', 'right', 'right', 'right'] }
      );
    }

    // ── Goal Progress ──
    y += 4;
    y = drawSectionTitle(doc, y, 'Goal Progress Summary');
    y = drawSummaryCards(doc, y, [
      { label: 'Total Goals', value: String(goalSummary.total), color: '#3b82f6' },
      { label: 'Active', value: String(goalSummary.active), color: '#10b981' },
      { label: 'Achieved', value: String(goalSummary.achieved), color: '#8b5cf6' },
    ]);
    if (goalSummary.totalTarget > 0) {
      const goalCompletion = Math.round((goalSummary.totalSaved / goalSummary.totalTarget) * 100);
      doc.fillColor('#334155').fontSize(9).font('Helvetica')
        .text(`Overall Goal Completion: ${goalCompletion}% (${fmtINR(goalSummary.totalSaved)} of ${fmtINR(goalSummary.totalTarget)})`, 62, y, { width: doc.page.width - 124 });
      y += 18;
    }

    // ── Investment Performance ──
    y += 4;
    y = drawSectionTitle(doc, y, 'Investment Performance');
    y = drawSummaryCards(doc, y, [
      { label: 'Total Invested', value: fmtINR(totalInvested), color: '#3b82f6' },
      { label: 'Current Value', value: fmtINR(totalCurrentValue), color: '#10b981' },
    ]);
    y = drawSummaryCards(doc, y, [
      { label: 'Profit / Loss', value: fmtINR(totalPL), color: totalPL >= 0 ? '#10b981' : '#ef4444' },
      { label: 'Overall ROI', value: `${overallROI}%`, color: overallROI >= 0 ? '#10b981' : '#ef4444' },
    ]);

    // ── Financial Health ──
    y += 8;
    y = drawSectionTitle(doc, y, 'Financial Health Assessment');
    const healthCards = [
      { label: 'Health Score', value: `${health.score}/100`, color: health.score >= 75 ? '#10b981' : '#f59e0b' },
      { label: 'Rating', value: health.status, color: health.score >= 75 ? '#10b981' : '#f59e0b' },
      { label: 'Savings Rate', value: `${savingsRate}%`, color: savingsRate >= 20 ? '#10b981' : '#f59e0b' },
    ];
    y = drawSummaryCards(doc, y, healthCards);

    // Health tips
    y += 4;
    const tips = [];
    if (savingsRate < 20) tips.push('Try to save at least 20% of your income.');
    if (health.score < 60) tips.push('Your expenses are high relative to income. Consider reducing discretionary spending.');
    if (overallROI < 0) tips.push('Your investments are in loss. Review your portfolio strategy.');
    if (goalSummary.overdue > 0) tips.push(`You have ${goalSummary.overdue} overdue goal(s). Consider revising targets.`);
    if (tips.length === 0) tips.push('Your finances look healthy. Keep up the good work!');

    tips.forEach(tip => {
      doc.fillColor('#475569').fontSize(9).font('Helvetica')
        .text(`• ${tip}`, 62, y, { width: doc.page.width - 124 });
      y += 14;
    });

    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error('[EXPORT FINANCIAL PDF] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate financial report PDF' });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Export Goal Progress Report to PDF
// ─────────────────────────────────────────────────────────────────────────────
const exportGoalPDF = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const user = await User.findById(req.userId).select('name email currency');
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });

    // Update statuses
    goals.forEach(g => {
      if (g.status !== 'paused') {
        if (g.targetAmount > 0 && g.savedAmount >= g.targetAmount) g.status = 'achieved';
        else if (g.targetDate && new Date(g.targetDate) < now && g.savedAmount < g.targetAmount) g.status = 'overdue';
      }
    });

    const goalDetails = goals.map(g => {
      const remaining = Math.max((g.targetAmount || 0) - (g.savedAmount || 0), 0);
      const completion = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 10000) / 100 : 0;
      return {
        name: g.goalName,
        category: g.category,
        target: g.targetAmount,
        saved: g.savedAmount,
        remaining,
        completion,
        targetDate: g.targetDate,
        status: g.status,
        priority: g.priority,
      };
    });

    const totalTarget = goalDetails.reduce((s, g) => s + g.target, 0);
    const totalSaved = goalDetails.reduce((s, g) => s + g.saved, 0);
    const overallCompletion = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 10000) / 100 : 0;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="goal-progress-${now.toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(res);

    const genDate = fmtDateTime(now);
    drawHeader(doc, 'Goal Progress Report', `User: ${user?.name || 'N/A'}`, genDate);
    let y = 120;

    // Summary cards
    y = drawSectionTitle(doc, y, 'Goals Overview');
    y = drawSummaryCards(doc, y, [
      { label: 'Total Goals', value: String(goals.length), color: '#3b82f6' },
      { label: 'Active', value: String(goals.filter(g => g.status === 'active').length), color: '#10b981' },
      { label: 'Achieved', value: String(goals.filter(g => g.status === 'achieved').length), color: '#8b5cf6' },
      { label: 'Overdue', value: String(goals.filter(g => g.status === 'overdue').length), color: '#ef4444' },
    ]);
    y = drawSummaryCards(doc, y, [
      { label: 'Total Target', value: fmtINR(totalTarget), color: '#3b82f6' },
      { label: 'Total Saved', value: fmtINR(totalSaved), color: '#10b981' },
      { label: 'Overall Completion', value: `${overallCompletion}%`, color: '#8b5cf6' },
    ]);

    // Goals table
    if (goalDetails.length > 0) {
      y += 4;
      y = drawSectionTitle(doc, y, 'Goal Details');
      const pageW = doc.page.width - 100;
      y = drawTable(doc, y,
        ['Goal', 'Target', 'Saved', 'Remaining', 'Completion', 'Target Date', 'Status'],
        goalDetails.map(g => [
          g.name,
          fmtINR(g.target),
          fmtINR(g.saved),
          fmtINR(g.remaining),
          `${g.completion}%`,
          fmtDate(g.targetDate),
          g.status.charAt(0).toUpperCase() + g.status.slice(1),
        ]),
        {
          colWidths: [pageW * 0.18, pageW * 0.14, pageW * 0.14, pageW * 0.14, pageW * 0.12, pageW * 0.14, pageW * 0.14],
          aligns: ['left', 'right', 'right', 'right', 'right', 'center', 'center'],
          fontSize: 7.5,
        }
      );
    }

    // Category distribution
    const catDist = {};
    goals.forEach(g => { catDist[g.category] = (catDist[g.category] || 0) + (g.targetAmount || 0); });
    const catEntries = Object.entries(catDist).sort(([, a], [, b]) => b - a);

    if (catEntries.length > 0) {
      y += 4;
      y = drawSectionTitle(doc, y, 'Category Distribution');
      const pageW = doc.page.width - 100;
      y = drawTable(doc, y,
        ['Category', 'Target Amount', '% of Total'],
        catEntries.map(([cat, amt]) => [
          cat,
          fmtINR(amt),
          totalTarget > 0 ? `${Math.round((amt / totalTarget) * 100)}%` : '0%',
        ]),
        { colWidths: [pageW * 0.4, pageW * 0.3, pageW * 0.3], aligns: ['left', 'right', 'right'] }
      );
    }

    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error('[EXPORT GOAL PDF] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate goal progress PDF' });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CSV Helper
// ─────────────────────────────────────────────────────────────────────────────
function generateCSV(headers, rows) {
  const escape = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(row.map(escape).join(',')));
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Export Expense Report to CSV
// ─────────────────────────────────────────────────────────────────────────────
const exportExpenseCSV = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [expenses, incomes] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
      Income.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);

    const headers = ['Date', 'Category', 'Amount', 'Description'];
    const rows = expenses.map(e => [
      new Date(e.date).toISOString().slice(0, 10),
      e.category,
      e.amount,
      e.description || '',
    ]);

    const csv = [
      `Expense Report - ${monthStr}`,
      `Total Income,${totalIncome}`,
      `Total Expenses,${totalExpenses}`,
      `Savings,${totalIncome - totalExpenses}`,
      '',
      generateCSV(headers, rows),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expense-report-${monthStr}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT EXPENSE CSV] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate expense CSV' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Export Expense Report to Excel
// ─────────────────────────────────────────────────────────────────────────────
const exportExpenseExcel = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [expenses, incomes] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
      Income.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Finance Insights';
    const sheet = workbook.addWorksheet('Expense Report');

    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = `Expense Report — ${monthStr}`;
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = `Generated: ${fmtDateTime(now)}`;
    sheet.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };

    sheet.getRow(3).height = 8;

    const headers = ['Date', 'Category', 'Amount', 'Description'];
    const headerRow = sheet.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 24;

    expenses.forEach((e, i) => {
      const row = sheet.getRow(5 + i);
      row.values = [
        new Date(e.date).toISOString().slice(0, 10),
        e.category,
        e.amount,
        e.description || '',
      ];
      row.getCell(3).numFmt = '₹#,##0';
      const bgColor = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
      for (let c = 1; c <= 4; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
    });

    const sumRow = sheet.getRow(5 + expenses.length + 1);
    sumRow.getCell(2).value = 'TOTAL';
    sumRow.getCell(2).font = { bold: true };
    sumRow.getCell(3).value = totalExpenses;
    sumRow.getCell(3).numFmt = '₹#,##0';
    sumRow.getCell(3).font = { bold: true };
    for (let c = 1; c <= 4; c++) {
      sumRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      sumRow.getCell(c).border = { top: { style: 'medium', color: { argb: 'FF3B82F6' } } };
    }

    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 30;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="expense-report-${monthStr}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[EXPORT EXPENSE EXCEL] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate expense Excel' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Export Financial Report to CSV
// ─────────────────────────────────────────────────────────────────────────────
const exportFinancialCSV = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [expenses, incomes, budgets, goals, investments] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Income.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Budget.find({ userId: req.userId, month: monthStr }),
      Goal.find({ userId: req.userId }),
      Investment.find({ userId: req.userId }),
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
    const totalInvested = investments.reduce((s, i) => s + (i.amount || 0), 0);
    const totalCurrentValue = investments.reduce((s, i) => s + (i.currentValue || i.amount || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);

    const sections = [
      'Financial Summary Report',
      `Generated,${fmtDateTime(now)}`,
      '',
      '--- SUMMARY ---',
      `Total Income,${totalIncome}`,
      `Total Expenses,${totalExpenses}`,
      `Net Savings,${totalIncome - totalExpenses}`,
      `Total Invested,${totalInvested}`,
      `Portfolio Value,${totalCurrentValue}`,
      `Goals Saved,${totalSaved}`,
      '',
      '--- EXPENSES ---',
      generateCSV(['Date', 'Category', 'Amount', 'Description'], expenses.map(e => [
        new Date(e.date).toISOString().slice(0, 10), e.category, e.amount, e.description || '',
      ])),
      '',
      '--- BUDGET ---',
      generateCSV(['Category', 'Limit', 'Month'], budgets.map(b => [b.category, b.limit, b.month])),
      '',
      '--- GOALS ---',
      generateCSV(['Goal', 'Target', 'Saved', 'Status'], goals.map(g => [g.goalName, g.targetAmount, g.savedAmount, g.status])),
      '',
      '--- INVESTMENTS ---',
      generateCSV(['Name', 'Type', 'Invested', 'Current Value', 'Status'], investments.map(i => [i.name, i.type, i.amount, i.currentValue || i.amount, i.status])),
    ];

    const csv = sections.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="financial-summary-${now.toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT FINANCIAL CSV] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate financial CSV' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Export Financial Report to Excel
// ─────────────────────────────────────────────────────────────────────────────
const exportFinancialExcel = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [expenses, incomes, budgets, goals, investments] = await Promise.all([
      Expense.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Income.find({ userId: req.userId, date: { $gte: start, $lte: end } }),
      Budget.find({ userId: req.userId, month: monthStr }),
      Goal.find({ userId: req.userId }),
      Investment.find({ userId: req.userId }),
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Finance Insights';

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.mergeCells('A1:C1');
    summarySheet.getCell('A1').value = 'Financial Summary';
    summarySheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    summarySheet.getCell('A2').value = `Generated: ${fmtDateTime(now)}`;
    summarySheet.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };

    const summaryData = [
      ['Total Income', totalIncome],
      ['Total Expenses', totalExpenses],
      ['Net Savings', totalIncome - totalExpenses],
      ['Total Invested', investments.reduce((s, i) => s + (i.amount || 0), 0)],
      ['Portfolio Value', investments.reduce((s, i) => s + (i.currentValue || i.amount || 0), 0)],
    ];
    summaryData.forEach((row, i) => {
      const r = summarySheet.getRow(4 + i);
      r.getCell(1).value = row[0];
      r.getCell(1).font = { bold: true };
      r.getCell(2).value = row[1];
      r.getCell(2).numFmt = '₹#,##0';
    });
    summarySheet.getColumn(1).width = 20;
    summarySheet.getColumn(2).width = 18;

    // Expenses sheet
    const expSheet = workbook.addWorksheet('Expenses');
    const expHeaders = ['Date', 'Category', 'Amount', 'Description'];
    const expHeaderRow = expSheet.getRow(1);
    expHeaders.forEach((h, i) => {
      const cell = expHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    });
    expenses.forEach((e, i) => {
      const row = expSheet.getRow(2 + i);
      row.values = [new Date(e.date).toISOString().slice(0, 10), e.category, e.amount, e.description || ''];
      row.getCell(3).numFmt = '₹#,##0';
    });
    expSheet.getColumn(1).width = 14;
    expSheet.getColumn(2).width = 18;
    expSheet.getColumn(3).width = 15;
    expSheet.getColumn(4).width = 30;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="financial-summary-${now.toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[EXPORT FINANCIAL EXCEL] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate financial Excel' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Export Goal Report to CSV
// ─────────────────────────────────────────────────────────────────────────────
const exportGoalCSV = asyncHandler(async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
    const now = new Date();

    goals.forEach(g => {
      if (g.status !== 'paused') {
        if (g.targetAmount > 0 && g.savedAmount >= g.targetAmount) g.status = 'achieved';
        else if (g.targetDate && new Date(g.targetDate) < now && g.savedAmount < g.targetAmount) g.status = 'overdue';
      }
    });

    const headers = ['Goal Name', 'Category', 'Target', 'Saved', 'Remaining', 'Completion %', 'Target Date', 'Status', 'Priority'];
    const rows = goals.map(g => {
      const remaining = Math.max((g.targetAmount || 0) - (g.savedAmount || 0), 0);
      const completion = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 10000) / 100 : 0;
      return [g.goalName, g.category, g.targetAmount, g.savedAmount, remaining, `${completion}%`, fmtDate(g.targetDate), g.status, g.priority];
    });

    const csv = generateCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="goal-progress-${now.toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT GOAL CSV] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate goal CSV' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Export Goal Report to Excel
// ─────────────────────────────────────────────────────────────────────────────
const exportGoalExcel = asyncHandler(async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
    const now = new Date();

    goals.forEach(g => {
      if (g.status !== 'paused') {
        if (g.targetAmount > 0 && g.savedAmount >= g.targetAmount) g.status = 'achieved';
        else if (g.targetDate && new Date(g.targetDate) < now && g.savedAmount < g.targetAmount) g.status = 'overdue';
      }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Finance Insights';
    const sheet = workbook.addWorksheet('Goal Progress');

    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = 'Goal Progress Report';
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    sheet.getRow(1).height = 28;

    const headers = ['Goal Name', 'Category', 'Target', 'Saved', 'Remaining', 'Completion %', 'Target Date', 'Status', 'Priority'];
    const headerRow = sheet.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 24;

    goals.forEach((g, i) => {
      const remaining = Math.max((g.targetAmount || 0) - (g.savedAmount || 0), 0);
      const completion = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 10000) / 100 : 0;
      const row = sheet.getRow(4 + i);
      row.values = [g.goalName, g.category, g.targetAmount, g.savedAmount, remaining, completion, fmtDate(g.targetDate), g.status, g.priority];
      [3, 4, 5].forEach(col => { row.getCell(col).numFmt = '₹#,##0'; });
      row.getCell(6).numFmt = '0.00"%"';
      const bgColor = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
      for (let c = 1; c <= 9; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
    });

    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 16;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 14;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 14;
    sheet.getColumn(7).width = 14;
    sheet.getColumn(8).width = 12;
    sheet.getColumn(9).width = 12;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="goal-progress-${now.toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[EXPORT GOAL EXCEL] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate goal Excel' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Export Investment Report to PDF
// ─────────────────────────────────────────────────────────────────────────────
const exportInvestmentPDF = asyncHandler(async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId }).sort({ createdAt: -1 });
    const user = await User.findById(req.userId).select('name email currency');
    const now = new Date();

    const totalInvested = investments.reduce((s, i) => s + (i.amount || 0), 0);
    const totalCurrentValue = investments.reduce((s, i) => s + (i.currentValue || i.amount || 0), 0);
    const totalPL = totalCurrentValue - totalInvested;
    const overallROI = totalInvested > 0 ? Math.round((totalPL / totalInvested) * 100) : 0;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="investment-report-${now.toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(res);

    drawHeader(doc, 'Investment Report', `User: ${user?.name || 'N/A'}`, fmtDateTime(now));
    let y = 120;

    y = drawSummaryCards(doc, y, [
      { label: 'Total Invested', value: fmtINR(totalInvested), color: '#3b82f6' },
      { label: 'Current Value', value: fmtINR(totalCurrentValue), color: '#10b981' },
      { label: 'Profit / Loss', value: fmtINR(totalPL), color: totalPL >= 0 ? '#10b981' : '#ef4444' },
      { label: 'Overall ROI', value: `${overallROI}%`, color: overallROI >= 0 ? '#10b981' : '#ef4444' },
    ]);

    if (investments.length > 0) {
      y = drawSectionTitle(doc, y, 'Investment Details');
      const pageW = doc.page.width - 100;
      y = drawTable(doc, y,
        ['Name', 'Type', 'Invested', 'Current', 'P/L', 'ROI', 'Status'],
        investments.map(inv => {
          const current = inv.currentValue || inv.amount || 0;
          const pl = current - (inv.amount || 0);
          const roi = inv.amount > 0 ? Math.round((pl / inv.amount) * 100) : 0;
          return [inv.name, inv.type, fmtINR(inv.amount), fmtINR(current), fmtINR(pl), `${roi}%`, inv.status || 'active'];
        }),
        {
          colWidths: [pageW * 0.2, pageW * 0.15, pageW * 0.14, pageW * 0.14, pageW * 0.13, pageW * 0.1, pageW * 0.14],
          aligns: ['left', 'left', 'right', 'right', 'right', 'right', 'center'],
          fontSize: 7.5,
        }
      );
    }

    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error('[EXPORT INVESTMENT PDF] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate investment PDF' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Export Investment Report to CSV
// ─────────────────────────────────────────────────────────────────────────────
const exportInvestmentCSV = asyncHandler(async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId }).sort({ createdAt: -1 });
    const now = new Date();

    const headers = ['Name', 'Type', 'Category', 'Invested', 'Current Value', 'Profit/Loss', 'ROI %', 'Status', 'Invested Date'];
    const rows = investments.map(inv => {
      const current = inv.currentValue || inv.amount || 0;
      const pl = current - (inv.amount || 0);
      const roi = inv.amount > 0 ? Math.round((pl / inv.amount) * 10000) / 100 : 0;
      return [inv.name, inv.type, inv.category, inv.amount, current, pl, `${roi}%`, inv.status || 'active', fmtDate(inv.investedDate)];
    });

    const csv = generateCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="investment-report-${now.toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT INVESTMENT CSV] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate investment CSV' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Export Comprehensive Financial Data to CSV
// ─────────────────────────────────────────────────────────────────────────────
const exportComprehensiveCSV = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const [incomes, expenses, budgets, goals, investments] = await Promise.all([
      Income.find({ userId: req.userId }).sort({ date: -1 }),
      Expense.find({ userId: req.userId }).sort({ date: -1 }),
      Budget.find({ userId: req.userId }).sort({ month: -1 }),
      Goal.find({ userId: req.userId }).sort({ createdAt: -1 }),
      Investment.find({ userId: req.userId }).sort({ createdAt: -1 }),
    ]);

    const sections = [
      'Smart Finance Insights - Complete Financial Data Export',
      `Generated,${fmtDateTime(now)}`,
      `Total Records,${incomes.length + expenses.length + budgets.length + goals.length + investments.length}`,
      '',
      '=== INCOME ===',
      generateCSV(['Date', 'Source', 'Amount', 'Description'], incomes.map(i => [
        new Date(i.date).toISOString().slice(0, 10), i.source, i.amount, i.description || '',
      ])),
      '',
      '=== EXPENSES ===',
      generateCSV(['Date', 'Category', 'Amount', 'Description'], expenses.map(e => [
        new Date(e.date).toISOString().slice(0, 10), e.category, e.amount, e.description || '',
      ])),
      '',
      '=== BUDGETS ===',
      generateCSV(['Month', 'Category', 'Limit'], budgets.map(b => [b.month, b.category, b.limit])),
      '',
      '=== GOALS ===',
      generateCSV(['Goal Name', 'Category', 'Target', 'Saved', 'Monthly Saving', 'Target Date', 'Priority', 'Status'],
        goals.map(g => [g.goalName, g.category, g.targetAmount, g.savedAmount, g.monthlySaving, fmtDate(g.targetDate), g.priority, g.status])),
      '',
      '=== INVESTMENTS ===',
      generateCSV(['Name', 'Type', 'Category', 'Invested', 'Current Value', 'Invested Date', 'Expected Returns', 'Status', 'Notes'],
        investments.map(i => [i.name, i.type, i.category, i.amount, i.currentValue || i.amount, fmtDate(i.investedDate), i.expectedReturns || 0, i.status, i.notes || ''])),
    ];

    const csv = sections.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="smart-finance-complete-${now.toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT COMPREHENSIVE CSV] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate comprehensive CSV' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Unified Export Handler
// ─────────────────────────────────────────────────────────────────────────────
const exportHandlers = {
  expenses: { pdf: exportExpensePDF, csv: exportExpenseCSV, xlsx: exportExpenseExcel },
  investments: { pdf: exportInvestmentPDF, csv: exportInvestmentCSV, xlsx: exportInvestmentExcel },
  'financial-report': { pdf: exportFinancialPDF, csv: exportFinancialCSV, xlsx: exportFinancialExcel },
  goals: { pdf: exportGoalPDF, csv: exportGoalCSV, xlsx: exportGoalExcel },
  comprehensive: { csv: exportComprehensiveCSV },
};

const unifiedExport = asyncHandler(async (req, res) => {
  const { type, format } = req.params;
  const handler = exportHandlers[type]?.[format];
  if (!handler) {
    return res.status(400).json({ error: `Unsupported export: ${type}/${format}` });
  }
  return handler(req, res);
});

module.exports = {
  exportExpensePDF,
  exportInvestmentExcel,
  exportFinancialPDF,
  exportGoalPDF,
  exportExpenseCSV,
  exportExpenseExcel,
  exportFinancialCSV,
  exportFinancialExcel,
  exportGoalCSV,
  exportGoalExcel,
  exportInvestmentPDF,
  exportInvestmentCSV,
  exportComprehensiveCSV,
  unifiedExport,
};
