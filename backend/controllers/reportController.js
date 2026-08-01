const asyncHandler = require('../middleware/asyncHandler');
const reportService = require('../services/reportService');

function fmtINR(val) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
}

const getMonthlyExpenses = asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Month parameter required in YYYY-MM format' });
  }
  try {
    const report = await reportService.generateMonthlyExpenseReport(req.userId, month);
    res.json(report);
  } catch (err) {
    console.error('[REPORT MONTHLY EXPENSES] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate monthly expense report' });
  }
});

const getBudgetUtilization = asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Month parameter required in YYYY-MM format' });
  }
  try {
    const report = await reportService.generateBudgetUtilizationReport(req.userId, month);
    res.json(report);
  } catch (err) {
    console.error('[REPORT BUDGET UTILIZATION] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate budget utilization report' });
  }
});

const getInvestmentPerformance = asyncHandler(async (req, res) => {
  try {
    const report = await reportService.generateInvestmentPerformanceReport(req.userId);
    res.json(report);
  } catch (err) {
    console.error('[REPORT INVESTMENT PERFORMANCE] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate investment performance report' });
  }
});

const getGoalProgress = asyncHandler(async (req, res) => {
  try {
    const report = await reportService.generateGoalProgressReport(req.userId);
    res.json(report);
  } catch (err) {
    console.error('[REPORT GOAL PROGRESS] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate goal progress report' });
  }
});

const exportCSV = asyncHandler(async (req, res) => {
  const { type, month } = req.query;
  if (!type) {
    return res.status(400).json({ error: 'Report type parameter required' });
  }

  try {
    let csv, filename;
    const now = new Date().toISOString().slice(0, 10);

    switch (type) {
      case 'monthly-expenses': {
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ error: 'Month parameter required for monthly-expenses report' });
        }
        const report = await reportService.generateMonthlyExpenseReport(req.userId, month);
        csv = reportService.expenseReportCSV(report);
        filename = `expense-report-${month}.csv`;
        break;
      }
      case 'budget-utilization': {
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ error: 'Month parameter required for budget-utilization report' });
        }
        const report = await reportService.generateBudgetUtilizationReport(req.userId, month);
        csv = reportService.budgetReportCSV(report);
        filename = `budget-report-${month}.csv`;
        break;
      }
      case 'investment-performance': {
        const report = await reportService.generateInvestmentPerformanceReport(req.userId);
        csv = reportService.investmentReportCSV(report);
        filename = `investment-report-${now}.csv`;
        break;
      }
      case 'goal-progress': {
        const report = await reportService.generateGoalProgressReport(req.userId);
        csv = reportService.goalReportCSV(report);
        filename = `goal-report-${now}.csv`;
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid report type. Use: monthly-expenses, budget-utilization, investment-performance, goal-progress' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('[REPORT EXPORT CSV] Error:', err.message);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

const exportPDF = asyncHandler(async (req, res) => {
  const { type, month } = req.query;
  if (!type) {
    return res.status(400).json({ error: 'Report type parameter required' });
  }

  try {
    let reportData;
    let title;

    switch (type) {
      case 'monthly-expenses': {
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ error: 'Month parameter required' });
        }
        reportData = await reportService.generateMonthlyExpenseReport(req.userId, month);
        title = `Monthly Expense Report - ${month}`;
        break;
      }
      case 'budget-utilization': {
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ error: 'Month parameter required' });
        }
        reportData = await reportService.generateBudgetUtilizationReport(req.userId, month);
        title = `Budget Utilization Report - ${month}`;
        break;
      }
      case 'investment-performance': {
        reportData = await reportService.generateInvestmentPerformanceReport(req.userId);
        title = 'Investment Performance Report';
        break;
      }
      case 'goal-progress': {
        reportData = await reportService.generateGoalProgressReport(req.userId);
        title = 'Goal Progress Report';
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    const html = generatePDFHTML(type, title, reportData, month);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="${type}-report.html"`);
    res.send(html);
  } catch (err) {
    console.error('[REPORT EXPORT PDF] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});



function generatePDFHTML(type, title, report, month) {
  const now = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  let body = '';

  if (type === 'monthly-expenses') {
    body = `
      <div class="summary">
        <div class="stat"><strong>Month:</strong> ${report.month}</div>
        <div class="stat"><strong>Total Expenses:</strong> ${fmtINR(report.totalExpenses)}</div>
        <div class="stat"><strong>Total Income:</strong> ${fmtINR(report.totalIncome)}</div>
        <div class="stat"><strong>Savings Rate:</strong> ${report.savingsRate}%</div>
        <div class="stat"><strong>Transactions:</strong> ${report.transactionCount}</div>
      </div>
      <h3>Category Breakdown</h3>
      <table>
        <tr><th>Category</th><th>Amount</th><th>Percentage</th></tr>
        ${report.categoryBreakdown.map(c => `<tr><td>${c.category}</td><td>${fmtINR(c.amount)}</td><td>${c.percentage}%</td></tr>`).join('')}
      </table>
      <h3>Comparison</h3>
      <p>Previous Month (${report.comparison.previousMonth}): ${fmtINR(report.comparison.previousExpenses)}</p>
      <p>Change: ${report.comparison.change !== null ? report.comparison.change + '%' : 'N/A'} ${report.comparison.changeType || ''}</p>
    `;
  } else if (type === 'budget-utilization') {
    body = `
      <div class="summary">
        <div class="stat"><strong>Month:</strong> ${report.month}</div>
        <div class="stat"><strong>Total Budget:</strong> ${fmtINR(report.totalBudget)}</div>
        <div class="stat"><strong>Total Spent:</strong> ${fmtINR(report.totalSpent)}</div>
        <div class="stat"><strong>Remaining:</strong> ${fmtINR(report.remaining)}</div>
        <div class="stat"><strong>Overall Status:</strong> ${report.overallStatus}</div>
      </div>
      <table>
        <tr><th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Utilization</th><th>Status</th></tr>
        ${report.categories.map(c => `<tr><td>${c.category}</td><td>${fmtINR(c.budgetLimit)}</td><td>${fmtINR(c.spent)}</td><td>${fmtINR(c.remaining)}</td><td>${c.percentUsed}%</td><td>${c.status}</td></tr>`).join('')}
      </table>
    `;
  } else if (type === 'investment-performance') {
    body = `
      <div class="summary">
        <div class="stat"><strong>Total Invested:</strong> ${fmtINR(report.summary.totalInvested)}</div>
        <div class="stat"><strong>Current Value:</strong> ${fmtINR(report.summary.totalCurrentValue)}</div>
        <div class="stat"><strong>Profit/Loss:</strong> ${fmtINR(report.summary.totalProfitLoss)}</div>
        <div class="stat"><strong>Overall ROI:</strong> ${report.summary.overallROI}%</div>
      </div>
      <table>
        <tr><th>Name</th><th>Type</th><th>Invested</th><th>Current Value</th><th>ROI</th></tr>
        ${report.performance.map(p => `<tr><td>${p.name}</td><td>${p.type}</td><td>${fmtINR(p.amount)}</td><td>${fmtINR(p.currentValue)}</td><td>${p.roi}%</td></tr>`).join('')}
      </table>
    `;
  } else if (type === 'goal-progress') {
    body = `
      <div class="summary">
        <div class="stat"><strong>Total Goals:</strong> ${report.summary.total}</div>
        <div class="stat"><strong>Active:</strong> ${report.summary.active}</div>
        <div class="stat"><strong>Achieved:</strong> ${report.summary.achieved}</div>
        <div class="stat"><strong>Overdue:</strong> ${report.summary.overdue}</div>
        <div class="stat"><strong>Overall Completion:</strong> ${report.summary.overallCompletion}%</div>
      </div>
      <table>
        <tr><th>Goal</th><th>Category</th><th>Target</th><th>Saved</th><th>Remaining</th><th>Completion</th><th>Status</th></tr>
        ${report.goals.map(g => `<tr><td>${g.goalName}</td><td>${g.category}</td><td>${fmtINR(g.targetAmount)}</td><td>${fmtINR(g.savedAmount)}</td><td>${fmtINR(g.remaining)}</td><td>${g.completionPercent}%</td><td>${g.status}</td></tr>`).join('')}
      </table>
    `;
  }

  return `<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; }
  h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
  h3 { color: #475569; margin-top: 24px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
  .stat { background: #f1f5f9; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #1e293b; color: #fff; padding: 10px 12px; text-align: left; font-size: 0.85rem; }
  td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; }
  tr:nth-child(even) { background: #f8fafc; }
  .footer { margin-top: 32px; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style></head><body>
<h1>${title}</h1>
<p style="color:#64748b;">Generated on ${now} | Smart Finance Insights</p>
${body}
<div class="footer">Smart Finance Insights - Financial Report. This report is auto-generated.</div>
</body></html>`;
}

module.exports = {
  getMonthlyExpenses,
  getBudgetUtilization,
  getInvestmentPerformance,
  getGoalProgress,
  exportCSV,
  exportPDF,
};
