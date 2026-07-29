const { Investment, Goal } = require('../models');
const asyncHandler = require('../middleware/asyncHandler');

const getAnalytics = asyncHandler(async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId });
    const goals = await Goal.find({ userId: req.userId });
    const totalInvested = investments.reduce((s, inv) => s + (inv.amount || 0), 0);
    const totalCurrentValue = investments.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
    const totalReturns = totalCurrentValue - totalInvested;
    const overallROI = totalInvested > 0 ? ((totalReturns / totalInvested) * 100) : 0;
    const performance = investments.map(inv => {
      const curr = inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
      const profit = curr - (inv.amount || 0);
      const retPct = inv.amount > 0 ? ((profit / inv.amount) * 100) : 0;
      return { name: inv.name, type: inv.type, category: inv.category, amount: inv.amount, currentValue: curr, profit, returnPct: Math.round(retPct * 100) / 100, investedDate: inv.investedDate, status: inv.status };
    }).sort((a, b) => b.returnPct - a.returnPct);
    const topPerformers = performance.filter(p => p.profit > 0).slice(0, 5);
    const lowestPerformers = [...performance].filter(p => p.profit < 0).sort((a, b) => a.returnPct - b.returnPct).slice(0, 5);
    const typeAllocation = {};
    investments.forEach(inv => { if (!typeAllocation[inv.type]) typeAllocation[inv.type] = 0; typeAllocation[inv.type] += inv.currentValue != null ? inv.currentValue : (inv.amount || 0); });
    const typeAllocationArr = Object.entries(typeAllocation).map(([type, value]) => ({ type, value, pct: totalCurrentValue > 0 ? Math.round((value / totalCurrentValue) * 10000) / 100 : 0 })).sort((a, b) => b.value - a.value);
    const totalGoalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
    const totalGoalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
    const goalsAchieved = goals.filter(g => g.targetAmount > 0 && (g.savedAmount / g.targetAmount) * 100 >= 100).length;
    const goalCompletionPct = goals.length > 0 ? Math.round((goalsAchieved / goals.length) * 100) : 0;
    const remainingSavings = Math.max(totalGoalTarget - totalGoalSaved, 0);
    const goalProgress = goals.map(g => { const pct = g.targetAmount > 0 ? Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100) : 0; return { name: g.goalName, category: g.category, target: g.targetAmount, saved: g.savedAmount, pct }; }).sort((a, b) => b.pct - a.pct);
    const numTypes = typeAllocationArr.length;
    const maxAlloc = typeAllocationArr.length > 0 ? typeAllocationArr[0].pct : 0;
    const riskScore = numTypes === 0 ? 0 : Math.round(100 - (numTypes <= 2 ? 30 : numTypes <= 4 ? 15 : 5) - (maxAlloc > 70 ? 30 : maxAlloc > 50 ? 15 : 0) - (overallROI < 0 ? 20 : 0));
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })); }
    const monthlyGrowth = months.map((m, idx) => ({ month: m, invested: totalInvested * ((idx + 1) / months.length), value: totalCurrentValue * ((idx + 1) / months.length) }));
    res.json({
      investments: { totalInvested, totalCurrentValue, totalReturns, overallROI: Math.round(overallROI * 100) / 100, count: investments.length, activeCount: investments.filter(i => i.status === 'active').length },
      topPerformers, lowestPerformers, typeAllocation: typeAllocationArr,
      goals: { totalTarget: totalGoalTarget, totalSaved: totalGoalSaved, totalGoals: goals.length, goalsAchieved, goalCompletionPct, remainingSavings, progress: goalProgress },
      risk: { score: Math.max(0, Math.min(100, riskScore)), label: riskScore >= 70 ? 'Low Risk' : riskScore >= 40 ? 'Moderate Risk' : 'High Risk', numTypes, maxAllocation: maxAlloc },
      monthlyGrowth,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { getAnalytics };
