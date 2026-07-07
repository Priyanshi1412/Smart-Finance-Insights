export function calculateFinancialHealth(totalIncome, totalExpenses) {
  const income = Number(totalIncome) || 0;
  const expenses = Number(totalExpenses) || 0;
  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  let score;
  if (savingsRate >= 50) score = 100;
  else if (savingsRate >= 40) score = 90;
  else if (savingsRate >= 30) score = 80;
  else if (savingsRate >= 20) score = 70;
  else if (savingsRate >= 10) score = 60;
  else score = 40;

  let status;
  if (score >= 90) status = 'Excellent';
  else if (score >= 75) status = 'Good';
  else if (score >= 60) status = 'Fair';
  else status = 'Poor';

  return {
    score,
    status,
    savingsRate: Math.round(savingsRate * 10) / 10,
    totalIncome: income,
    totalExpenses: expenses,
    totalSavings: savings,
    lastUpdated: new Date(),
  };
}
