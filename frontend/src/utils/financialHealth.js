export function calculateFinancialHealth(totalIncome, totalExpenses) {
  const income = Number(totalIncome) || 0;
  const expenses = Number(totalExpenses) || 0;
  const savings = income - expenses;

  let score;
  if (income === 0) {
    score = 0;
  } else {
    score = Math.max(0, Math.min(100, Math.round((savings / income) * 100)));
  }

  const savingsRate = income > 0 ? Math.round((savings / income) * 100 * 10) / 10 : 0;

  let status;
  if (score >= 90) status = 'Excellent';
  else if (score >= 75) status = 'Good';
  else if (score >= 60) status = 'Fair';
  else status = 'Poor';

  return {
    score,
    status,
    savingsRate,
    totalIncome: income,
    totalExpenses: expenses,
    totalSavings: savings,
    lastUpdated: new Date(),
  };
}
