import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, incomeAPI, expenseAPI, budgetAPI, goalAPI, investmentAPI, analyticsAPI } from '../services/api';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import { fmt, getMonthKey, getCurrentMonthKey, getPreviousMonthKey } from '../utils/formatters';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SemiCircleGauge from '../components/ui/SemiCircleGauge';


export default function AIInsights() {
  const navigate = useNavigate();
  const { health } = useFinancialHealth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [backendRecs, setBackendRecs] = useState([]);

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/login'); return; }

    let mounted = true;
    let interval;

    const load = async () => {
      try {
        const [sRes, iRes, eRes, bRes, gRes] = await Promise.all([
          dashboardAPI.getSummary(),
          incomeAPI.getAll(),
          expenseAPI.getAll(),
          budgetAPI.getAll(),
          goalAPI.getAll(),
        ]);
        if (mounted) {
          setSummary(sRes.data);
          setIncomes(iRes.data || []);
          setExpenses(eRes.data || []);
          setBudgets(bRes.data || []);
          setGoals(gRes.data || []);
        }
        try {
          const invRes = await investmentAPI.getAll();
          if (mounted) setInvestments(invRes.data || []);
        } catch {}
        try {
          const recRes = await analyticsAPI.getBudgetRecommendations();
          if (mounted && recRes.data?.recommendations) {
            setBackendRecs(recRes.data.recommendations);
          }
        } catch {}
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    interval = setInterval(load, 30000);
    window.addEventListener('focus', load);

    return () => { mounted = false; clearInterval(interval); window.removeEventListener('focus', load); };
  }, [navigate]);

  const computed = useMemo(() => {
    if (!summary) return null;

    const curMonth = getCurrentMonthKey();
    const prevMonth = getPreviousMonthKey();

    const curMonthIncome = incomes
      .filter(i => getMonthKey(i.date) === curMonth)
      .reduce((s, i) => s + Number(i.amount || 0), 0);
    const prevMonthIncome = incomes
      .filter(i => getMonthKey(i.date) === prevMonth)
      .reduce((s, i) => s + Number(i.amount || 0), 0);

    const curMonthExpenses = expenses
      .filter(e => getMonthKey(e.date) === curMonth)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const prevMonthExpenses = expenses
      .filter(e => getMonthKey(e.date) === prevMonth)
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const totalIncome = summary.totalIncome || 0;
    const totalExpenses = summary.totalExpenses || 0;
    const savings = summary.savings || 0;
    const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100) : 0;

    let expenseTrendPct = 0;
    let expenseTrendDir = 'flat';
    if (prevMonthExpenses > 0) {
      expenseTrendPct = Math.round(((curMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100);
      expenseTrendDir = expenseTrendPct > 0 ? 'up' : expenseTrendPct < 0 ? 'down' : 'flat';
    } else if (curMonthExpenses > 0) {
      expenseTrendPct = 100;
      expenseTrendDir = 'up';
    }

    const budgetStatus = summary.budget.status;

    let aiScore = 50;
    if (savingsRate > 0) aiScore += Math.min(20, savingsRate * 0.5);
    if (budgetStatus === 'On Track') aiScore += 15;
    else if (budgetStatus === 'Near Limit') aiScore += 5;
    else aiScore -= 10;
    if (curMonthIncome > prevMonthIncome && prevMonthIncome > 0) aiScore += 5;
    if (curMonthExpenses < prevMonthExpenses && prevMonthExpenses > 0) aiScore += 5;
    if (totalExpenses < totalIncome) aiScore += 5;
    aiScore = Math.max(0, Math.min(100, Math.round(aiScore)));

    let scoreLabel = 'Needs Improvement';
    if (aiScore >= 80) scoreLabel = 'Excellent';
    else if (aiScore >= 60) scoreLabel = 'Good';
    else if (aiScore >= 40) scoreLabel = 'Average';

    let budgetHealth = 'On Track';
    let budgetHealthColor = 'success';
    if (budgetStatus === 'Exceeded') { budgetHealth = 'Budget Exceeded'; budgetHealthColor = 'danger'; }
    else if (budgetStatus === 'Near Limit') { budgetHealth = 'Warning'; budgetHealthColor = 'warning'; }

    const expenseByCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0);
    });
    const topCategory = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];

    const curMonthExpenseByCategory = {};
    expenses
      .filter(e => getMonthKey(e.date) === curMonth)
      .forEach(e => {
        const cat = e.category || 'Other';
        curMonthExpenseByCategory[cat] = (curMonthExpenseByCategory[cat] || 0) + Number(e.amount || 0);
      });

    let overallPerformance = 'Needs Improvement';
    let overallPerformanceColor = 'danger';
    if (aiScore >= 80) { overallPerformance = 'Excellent'; overallPerformanceColor = 'success'; }
    else if (aiScore >= 60) { overallPerformance = 'Good'; overallPerformanceColor = 'info'; }
    else if (aiScore >= 40) { overallPerformance = 'Average'; overallPerformanceColor = 'warning'; }

    return {
      aiScore, scoreLabel,
      savingsRate,
      expenseTrendPct, expenseTrendDir,
      budgetHealth, budgetHealthColor,
      curMonthIncome, prevMonthIncome,
      curMonthExpenses, prevMonthExpenses,
      totalIncome, totalExpenses, savings,
      topCategory, expenseByCategory, curMonthExpenseByCategory,
      overallPerformance, overallPerformanceColor,
      goals,
      investments,
    };
  }, [summary, incomes, expenses, budgets, goals, investments]);

  const recommendations = useMemo(() => {
    if (!computed) return [];
    const recs = [];
    let id = 0;

    const add = (priority, icon, title, text) => {
      recs.push({ id: id++, priority, icon, title, text });
    };

    const { totalIncome, totalExpenses, savings, savingsRate,
      curMonthIncome, prevMonthIncome, curMonthExpenses, prevMonthExpenses,
      curMonthExpenseByCategory, goals: userGoals } = computed;

    if (totalExpenses > 0) {
      const sortedCats = Object.entries(curMonthExpenseByCategory).sort((a, b) => b[1] - a[1]);
      if (sortedCats.length > 0) {
        const [cat, amt] = sortedCats[0];
        const pctOfTotal = (amt / totalExpenses) * 100;
        if (pctOfTotal > 35) {
          const reduceAmt = Math.round(amt * 0.12);
          add('critical', icons.alertCircle,
            `${cat} dominates your spending`,
            `You spent ${fmt(amt)} on ${cat} this month, which is ${pctOfTotal.toFixed(0)}% of total expenses. Try reducing it by 10-15% — that's about ${fmt(reduceAmt)} — to rebalance your budget.`
          );
        } else if (pctOfTotal > 25) {
          add('moderate', icons.barChart,
            `${cat} is your top expense`,
            `${cat} accounts for ${pctOfTotal.toFixed(0)}% of your spending at ${fmt(amt)}. Keep an eye on this category to prevent it from growing further.`
          );
        }
      }
    }

    if (totalIncome > 0) {
      if (savingsRate < 20) {
        const targetSavings = totalIncome * 0.2;
        const gap = Math.round(targetSavings - savings);
        if (gap > 0) {
          add('critical', icons.target,
            'Savings rate is below 20%',
            `Your current savings rate is ${savingsRate.toFixed(1)}%. Save at least ${fmt(gap)} more this month to reach the recommended 20% savings rate.`
          );
        }
      } else if (savingsRate >= 20 && savingsRate < 40) {
        add('good', icons.check,
          'Healthy savings habit',
          `You're saving ${savingsRate.toFixed(1)}% of your income — that's a solid financial habit. Keep maintaining this discipline.`
        );
      } else if (savingsRate >= 40) {
        add('good', icons.trendingUp,
          'Excellent savings rate',
          `At ${savingsRate.toFixed(1)}%, your savings rate is outstanding. Consider investing a portion in SIPs, mutual funds, or index funds to grow your wealth faster.`
        );
      }
    }

    const curMonth = getCurrentMonthKey();
    const curMonthBudgets = budgets.filter(b => b.month === curMonth);
    if (curMonthBudgets.length > 0) {
      let anyExceeded = false;
      let anyNearLimit = false;
      curMonthBudgets.forEach(b => {
        const spent = curMonthExpenseByCategory[b.category] || 0;
        const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        const overBy = Math.round(spent - b.limit);
        if (pct >= 100 && overBy > 0) {
          add('critical', icons.alertCircle,
            `${b.category} exceeded budget`,
            `You exceeded your ${b.category} budget by ${fmt(overBy)} this month. Consider cutting back or adjusting next month's budget.`
          );
          anyExceeded = true;
        } else if (pct >= 80) {
          anyNearLimit = true;
        }
      });
      if (!anyExceeded && anyNearLimit) {
        add('moderate', icons.alertCircle,
          'Some budgets nearing limit',
          'One or more budget categories are above 80% usage. Monitor these closely to avoid overspending.'
        );
      }
      if (!anyExceeded && !anyNearLimit) {
        add('good', icons.check,
          'All budgets under control',
          'Your spending is within budget limits across all categories. Great financial discipline!'
        );
      }
    }

    if (prevMonthExpenses > 0) {
      const diff = curMonthExpenses - prevMonthExpenses;
      const pctChange = Math.round((diff / prevMonthExpenses) * 100);
      if (pctChange > 5) {
        add('critical', icons.trendingUp,
          `Expenses increased by ${pctChange}%`,
          `Your expenses rose from ${fmt(prevMonthExpenses)} to ${fmt(curMonthExpenses)} compared to last month. Review your spending patterns to identify areas to cut.`
        );
      } else if (pctChange < -5) {
        add('good', icons.trendingDown,
          `Expenses reduced by ${Math.abs(pctChange)}%`,
          `Great job! Your expenses dropped from ${fmt(prevMonthExpenses)} to ${fmt(curMonthExpenses)} — a ${Math.abs(pctChange)}% improvement from last month.`
        );
      }
    }

    if (prevMonthIncome > 0) {
      const diff = curMonthIncome - prevMonthIncome;
      const pctChange = Math.round((diff / prevMonthIncome) * 100);
      if (pctChange < -10) {
        add('critical', icons.trendingDown,
          `Income decreased by ${Math.abs(pctChange)}%`,
          `Your income dropped from ${fmt(prevMonthIncome)} to ${fmt(curMonthIncome)}. Monitor your spending carefully and consider diversifying income sources.`
        );
      } else if (pctChange > 10) {
        add('good', icons.trendingUp,
          `Income increased by ${pctChange}%`,
          `Income grew from ${fmt(prevMonthIncome)} to ${fmt(curMonthIncome)}. Consider allocating the extra income towards savings or debt repayment.`
        );
      }
    }

    if (health) {
      const { score } = health;
      if (score < 60) {
        add('critical', icons.shield,
          'Financial health needs attention',
          `Your financial health score is ${score}/100. Focus on increasing income, reducing unnecessary expenses, and building an emergency fund covering 3-6 months of expenses.`
        );
      } else if (score >= 60 && score < 80) {
        add('moderate', icons.shield,
          'Financial health is fair',
          `Your score is ${score}/100. You're on the right track — try to boost your savings rate and keep debt levels low to push into the "Excellent" range.`
        );
      } else if (score >= 80) {
        add('good', icons.shield,
          'Excellent financial health',
          `Your score is ${score}/100. Your finances are in great shape. Keep diversifying investments and maintaining your savings discipline.`
        );
      }
    }

    if (userGoals && userGoals.length > 0) {
      const now = new Date();
      userGoals.forEach(g => {
        const target = Number(g.targetAmount || 0);
        const saved = Number(g.savedAmount || 0);
        if (target <= 0) return;
        const pct = (saved / target) * 100;
        const remaining = Math.max(target - saved, 0);
        const targetDate = new Date(g.targetDate);
        const monthsLeft = Math.max(1, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24 * 30)));
        const needed = Math.ceil(remaining / monthsLeft);

        if (pct < 40 && remaining > 0) {
          add('moderate', icons.target,
            `${g.goalName} needs attention`,
            `You've saved ${pct.toFixed(0)}% of your ${fmt(target)} goal. Increase monthly savings to at least ${fmt(needed)} to reach it by the target date.`
          );
        } else if (pct >= 80 && pct < 100) {
          add('good', icons.check,
            `${g.goalName} is almost complete`,
            `You're ${pct.toFixed(0)}% there with ${fmt(remaining)} remaining. Just a bit more — keep the momentum going!`
          );
        } else if (pct >= 100) {
          add('good', icons.check,
            `${g.goalName} achieved!`,
            `Congratulations! You've reached your ${fmt(target)} savings goal. Consider setting a new goal to keep growing your wealth.`
          );
        }
      });
    }

    if (totalIncome > 0) {
      const spendRatio = (totalExpenses / totalIncome) * 100;
      if (spendRatio > 90) {
        add('critical', icons.alertCircle,
          'Spending almost matches income',
          `You're spending ${spendRatio.toFixed(0)}% of your income. This leaves little room for savings or emergencies. Aim to keep expenses below 70-80% of income.`
        );
      }
    }

    const userInvestments = computed?.investments || [];
    if (userInvestments.length > 0) {
      const activeInvestments = userInvestments.filter(inv => inv.status === 'active');
      const totalInvested = activeInvestments.reduce((s, inv) => s + (inv.amount || 0), 0);
      const totalCurrentValue = activeInvestments.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
      const overallReturn = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;

      if (overallReturn < -5) {
        add('critical', icons.trendingDown,
          'Investment portfolio declining',
          `Your portfolio is down ${Math.abs(overallReturn).toFixed(1)}%. Review underperforming investments and consider rebalancing your portfolio.`
        );
      } else if (overallReturn > 15) {
        add('good', icons.trendingUp,
          'Strong investment performance',
          `Your portfolio is up ${overallReturn.toFixed(1)}%. Consider booking partial profits and diversifying into other asset classes.`
        );
      }

      if (activeInvestments.length === 1) {
        add('moderate', icons.alertCircle,
          'Concentrated portfolio risk',
          'You only have 1 active investment. Diversify across different asset classes (mutual funds, stocks, FDs, bonds) to reduce risk.'
        );
      }

      if (totalInvested > 0 && computed.savingsRate > 20) {
        const monthlySavings = computed.savings - (computed.savings * 0.1);
        if (monthlySavings > 0) {
          add('good', icons.piggyBank,
            'Consider increasing SIP',
            `With a ${computed.savingsRate.toFixed(0)}% savings rate, consider starting a monthly SIP of ${fmt(Math.round(monthlySavings * 0.2))} in mutual funds or index funds.`
          );
        }
      }

      const types = [...new Set(activeInvestments.map(inv => inv.type))];
      if (types.length <= 2 && activeInvestments.length >= 2) {
        add('moderate', icons.pieChart,
          'Low diversification',
          `Your investments span only ${types.length} asset class${types.length > 1 ? 'es' : ''}. Consider adding bonds, gold, or real estate for better diversification.`
        );
      }
    } else if (totalIncome > 0 && computed.savingsRate > 10) {
      add('moderate', icons.piggyBank,
        'Start investing',
        `You're saving ${computed.savingsRate.toFixed(0)}% of income. Consider starting with SIPs in index funds or mutual funds to grow your wealth.`
      );
    }

    const allExpenses = computed?.expenseByCategory || {};
    const totalExp = Object.values(allExpenses).reduce((s, v) => s + v, 0);
    if (totalExp > 0) {
      const sortedCats = Object.entries(allExpenses).sort((a, b) => b[1] - a[1]);
      const discretionaryCats = ['Shopping', 'Entertainment', 'Travel'];
      const discretionaryTotal = sortedCats.filter(([cat]) => discretionaryCats.includes(cat)).reduce((s, [, v]) => s + v, 0);
      const discretionaryPct = (discretionaryTotal / totalExp) * 100;
      if (discretionaryPct > 30) {
        add('moderate', icons.alertCircle,
          'High discretionary spending',
          `Discretionary expenses (Shopping, Entertainment, Travel) make up ${discretionaryPct.toFixed(0)}% of your spending. Consider reducing these by 10-15%.`
        );
      }
    }

    const priorityOrder = { critical: 0, moderate: 1, good: 2 };
    recs.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

    // Merge with backend recommendations (backend takes priority)
    const backendMapped = backendRecs.map(rec => ({
      id: `backend-${rec.id}`,
      priority: rec.priority === 'high' ? 'critical' : rec.priority === 'medium' ? 'moderate' : 'good',
      icon: rec.type === 'reduce' ? icons.trendingDown
        : rec.type === 'increase_savings' ? icons.piggyBank
        : rec.type === 'reduce_discretionary' ? icons.alertCircle
        : rec.type === 'trend_warning' ? icons.trendingUp
        : rec.type === 'emergency_fund' ? icons.shield
        : rec.type === 'optimize' ? icons.barChart
        : rec.type === 'monitor' ? icons.eye
        : rec.type === 'create' ? icons.plus
        : rec.type === 'good' ? icons.check
        : icons.send,
      title: rec.title,
      text: rec.message,
      category: rec.category,
      backendData: rec,
    }));

    // Deduplicate: if backend has a rec for the same category, use backend version
    const catSeen = new Set(backendMapped.map(r => r.category).filter(Boolean));
    const clientFiltered = recs.filter(r => !r.category || !catSeen.has(r.category));

    const merged = [...backendMapped, ...clientFiltered];
    merged.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

    return merged.slice(0, 8);
  }, [computed, budgets, backendRecs, health]);

  if (loading) return <Layout title="AI Insights"><LoadingSpinner text="Analyzing your finances..." /></Layout>;
  if (!computed) return <Layout title="AI Insights"><LoadingSpinner text="Loading data..." /></Layout>;

  const summaryCards = [
    {
      title: 'AI Score',
      value: `${computed.aiScore}/100`,
      subtitle: computed.scoreLabel,
      gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))',
      color: 'var(--purple-light)',
      icon: icons.brain,
      badgeColor: computed.aiScore >= 70 ? 'success' : computed.aiScore >= 40 ? 'warning' : 'danger',
    },
    {
      title: 'Savings Rate',
      value: `${computed.savingsRate.toFixed(1)}%`,
      subtitle: computed.savingsRate >= 20 ? 'Excellent' : computed.savingsRate >= 10 ? 'Good' : computed.savingsRate > 0 ? 'Fair' : 'Neutral',
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))',
      color: 'var(--success-light)',
      icon: icons.piggyBank,
      badgeColor: computed.savingsRate >= 20 ? 'success' : computed.savingsRate >= 10 ? 'info' : 'warning',
    },
    {
      title: 'Expense Trend',
      value: computed.expenseTrendDir === 'flat' ? '0%' : `${Math.abs(computed.expenseTrendPct)}%`,
      subtitle: computed.expenseTrendDir === 'down'
        ? 'Lower than last month'
        : computed.expenseTrendDir === 'up'
          ? 'Higher than last month'
          : 'Same as last month',
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
      color: 'var(--warning-light)',
      icon: computed.expenseTrendDir === 'down' ? icons.trendingDown : icons.trendingUp,
      badgeColor: computed.expenseTrendDir === 'down' ? 'success' : computed.expenseTrendDir === 'up' ? 'danger' : 'info',
    },
    {
      title: 'Budget Health',
      value: computed.budgetHealth,
      subtitle: `${Math.round(computed.totalIncome > 0 ? (computed.totalExpenses / computed.totalIncome) * 100 : 0)}% of income spent`,
      gradient: computed.budgetHealthColor === 'success'
        ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))'
        : computed.budgetHealthColor === 'warning'
          ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))'
          : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
      color: computed.budgetHealthColor === 'success'
        ? 'var(--success-light)'
        : computed.budgetHealthColor === 'warning'
          ? 'var(--warning-light)'
          : 'var(--danger-light)',
      icon: icons.target,
      badgeColor: computed.budgetHealthColor,
    },
  ];

  const analysisInsights = [];

  if (computed.topCategory) {
    analysisInsights.push({
      icon: icons.barChart,
      label: 'Highest expense category',
      value: `${computed.topCategory[0]} — ${fmt(computed.topCategory[1])}`,
      color: 'var(--danger-light)',
    });
  }

  analysisInsights.push({
    icon: icons.trendingUp,
    label: 'Total income this month',
    value: fmt(computed.curMonthIncome),
    color: 'var(--success-light)',
  });

  analysisInsights.push({
    icon: icons.trendingDown,
    label: 'Total expenses this month',
    value: fmt(computed.curMonthExpenses),
    color: 'var(--danger-light)',
  });

  analysisInsights.push({
    icon: icons.piggyBank,
    label: 'Total savings this month',
    value: fmt(computed.curMonthIncome - computed.curMonthExpenses),
    color: computed.curMonthIncome - computed.curMonthExpenses >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
  });

  if (computed.prevMonthIncome > 0) {
    const incChange = computed.curMonthIncome - computed.prevMonthIncome;
    analysisInsights.push({
      icon: incChange >= 0 ? icons.trendingUp : icons.trendingDown,
      label: 'Income vs last month',
      value: incChange >= 0 ? `↑ ${fmt(incChange)} higher` : `↓ ${fmt(Math.abs(incChange))} lower`,
      color: incChange >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
    });
  }

  if (computed.prevMonthExpenses > 0) {
    const expChange = computed.curMonthExpenses - computed.prevMonthExpenses;
    analysisInsights.push({
      icon: expChange <= 0 ? icons.trendingDown : icons.trendingUp,
      label: 'Expenses vs last month',
      value: expChange <= 0 ? `↓ ${fmt(Math.abs(expChange))} lower` : `↑ ${fmt(expChange)} higher`,
      color: expChange <= 0 ? 'var(--success-light)' : 'var(--danger-light)',
    });
  }

  analysisInsights.push({
    icon: icons.activity,
    label: 'Overall financial performance',
    value: computed.overallPerformance,
    color: computed.overallPerformanceColor === 'success' ? 'var(--success-light)' : computed.overallPerformanceColor === 'info' ? 'var(--accent-light)' : computed.overallPerformanceColor === 'warning' ? 'var(--warning-light)' : 'var(--danger-light)',
  });

  analysisInsights.push({
    icon: icons.shield,
    label: 'Savings habit',
    value: computed.savingsRate >= 10
      ? 'Maintaining healthy savings'
      : 'Consider improving savings',
    color: computed.savingsRate >= 10 ? 'var(--success-light)' : 'var(--warning-light)',
  });

  return (
    <Layout title="AI Insights">
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          AI-powered analysis based on your financial data
        </h3>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        {summaryCards.map((card, i) => (
          <Card key={i} hoverable style={{ background: card.gradient, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.08 }}>
              <Icon path={card.icon} size={80} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{card.title}</span>
              <Badge color={card.badgeColor} dot>{card.subtitle}</Badge>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: card.color }}>
              {card.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Two-column layout: Analysis + Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
        {/* Left: AI Financial Analysis */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--purple-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.brain} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Smart Financial Analysis
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {analysisInsights.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon path={item.icon} size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: item.color }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '20px', paddingTop: '16px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Overall Financial Performance
            </span>
            <Badge color={computed.overallPerformanceColor} dot>{computed.overallPerformance}</Badge>
          </div>
        </Card>

        {/* Right: AI Recommendations */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.send} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                AI Recommendations
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {recommendations.length} insight{recommendations.length !== 1 ? 's' : ''} based on your data
              </span>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <Icon path={icons.check} size={32} />
              <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Your finances look balanced. Keep monitoring your spending.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recommendations.map((rec) => {
                const priorityConfig = {
                  critical: { bg: 'var(--danger-glow)', border: 'rgba(239,68,68,0.3)', dot: 'var(--danger)', badge: 'danger', label: 'Critical' },
                  moderate: { bg: 'var(--warning-glow)', border: 'rgba(245,158,11,0.3)', dot: 'var(--warning)', badge: 'warning', label: 'Moderate' },
                  good: { bg: 'var(--success-glow)', border: 'rgba(16,185,129,0.3)', dot: 'var(--success)', badge: 'success', label: 'Good' },
                };
                const pc = priorityConfig[rec.priority] || priorityConfig.moderate;
                return (
                  <div
                    key={rec.id}
                    style={{
                      display: 'flex', gap: '14px',
                      padding: '16px', borderRadius: 'var(--radius-lg)',
                      background: pc.bg, border: `1px solid ${pc.border}`,
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      background: `${pc.dot}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon path={rec.icon} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rec.title}
                        </span>
                        <Badge color={pc.badge} style={{ fontSize: '0.65rem', padding: '2px 7px' }}>{pc.label}</Badge>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                        {rec.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Spending Trends & Investment Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {/* Monthly Spending Trends */}
        {computed.expenseByCategory && Object.keys(computed.expenseByCategory).length > 0 && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.activity} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Spending Distribution</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(computed.expenseByCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([cat, amount], i) => {
                  const pct = computed.totalExpenses > 0 ? (amount / computed.totalExpenses) * 100 : 0;
                  const colors = ['#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B', '#14B8A6', '#EC4899'];
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', width: 90, fontWeight: 500 }}>{cat}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: colors[i % colors.length], transition: 'width 0.8s ease' }} />
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 60, textAlign: 'right' }}>{fmt(amount)}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 35, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        {/* Investment Performance Summary */}
        {computed.investments && computed.investments.length > 0 && (() => {
          const activeInvs = computed.investments.filter(inv => inv.status === 'active');
          const totalInv = activeInvs.reduce((s, inv) => s + (inv.amount || 0), 0);
          const totalCurr = activeInvs.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
          const totalRet = totalInv > 0 ? ((totalCurr - totalInv) / totalInv) * 100 : 0;
          const types = [...new Set(activeInvs.map(inv => inv.type))];
          const bestInv = activeInvs.reduce((best, inv) => {
            const ret = inv.amount > 0 ? ((inv.currentValue - inv.amount) / inv.amount) * 100 : 0;
            const bestRet = best.amount > 0 ? ((best.currentValue - best.amount) / best.amount) * 100 : -Infinity;
            return ret > bestRet ? inv : best;
          }, activeInvs[0] || {});
          return (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.investments} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Investment Performance</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'Total Invested', value: fmt(totalInv), color: 'var(--accent-light)' },
                  { label: 'Current Value', value: fmt(totalCurr), color: totalCurr >= totalInv ? 'var(--success-light)' : 'var(--danger-light)' },
                  { label: 'Overall Return', value: `${totalRet >= 0 ? '+' : ''}${totalRet.toFixed(1)}%`, color: totalRet >= 0 ? 'var(--success)' : 'var(--danger)' },
                  { label: 'Asset Classes', value: types.length, color: 'var(--purple-light)' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{item.label}</div>
                  </div>
                ))}
              </div>
              {bestInv && bestInv.name && (
                <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success-light)', marginBottom: '4px' }}>Best Performer</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bestInv.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{bestInv.type} - {bestInv.category}</div>
                </div>
              )}
            </Card>
          );
        })()}
      </div>

      {/* Financial Health Score */}
      {health && (() => {
        const fh = health;
        const fhColor = fh.status === 'Excellent' ? 'var(--success)' : fh.status === 'Good' ? 'var(--accent)' : fh.status === 'Fair' ? 'var(--warning)' : 'var(--danger)';
        const fhLight = fh.status === 'Excellent' ? 'var(--success-light)' : fh.status === 'Good' ? 'var(--accent-light)' : fh.status === 'Fair' ? 'var(--warning-light)' : 'var(--danger-light)';
        const fhBadge = fh.status === 'Excellent' ? 'success' : fh.status === 'Good' ? 'info' : fh.status === 'Fair' ? 'warning' : 'danger';
        const lastUpdated = fh.lastUpdated ? new Date(fh.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today';

        return (
          <Card style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--success-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.shield} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Financial Health Score
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
              {/* Gauge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <SemiCircleGauge score={fh.score} size={280} color={fhColor} />
                <div style={{ textAlign: 'center', marginTop: '-8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: fhLight }}>{fh.score}/100</div>
                  <Badge color={fhBadge} dot style={{ marginTop: '6px' }}>{fh.status}</Badge>
                </div>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Savings Rate', value: `${fh.savingsRate}%`, color: 'var(--accent-light)' },
                  { label: 'Total Income', value: fmt(fh.totalIncome), color: 'var(--success-light)' },
                  { label: 'Total Expenses', value: fmt(fh.totalExpenses), color: 'var(--danger-light)' },
                  { label: 'Total Savings', value: fmt(fh.totalSavings), color: fh.totalSavings >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
                  { label: 'Last Updated', value: lastUpdated, color: 'var(--text-secondary)' },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })()}
    </Layout>
  );
}
