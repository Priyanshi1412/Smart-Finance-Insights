import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, incomeAPI, expenseAPI, budgetAPI, goalAPI, investmentAPI, analyticsAPI, mlAPI } from '../services/api';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import { fmt, getMonthKey, getCurrentMonthKey, getPreviousMonthKey } from '../utils/formatters';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SemiCircleGauge from '../components/ui/SemiCircleGauge';

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

import {
  FiTrendingDown, FiTrendingUp, FiDollarSign, FiEye, FiAlertTriangle,
  FiShield, FiSettings, FiPlusCircle, FiCheckCircle, FiZap,
  FiAlertOctagon, FiTarget, FiClock, FiPieChart, FiBarChart2,
  FiActivity, FiArrowUp, FiArrowDown, FiMinus, FiBrain,
  FiSmartphone, FiCreditCard, FiBriefcase, FiHome, FiBookOpen, FiCpu,
} from 'react-icons/fi';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler,
);

const CATEGORY_COLORS = {
  Food: '#EF4444', Transport: '#3B82F6', Shopping: '#8B5CF6',
  'Bills & Utilities': '#F59E0B', Entertainment: '#EC4899',
  Healthcare: '#10B981', Education: '#6366F1', Travel: '#14B8A6',
  Rent: '#F97316', Other: '#6B7280',
};

const typeIconMap = {
  reduce: <FiTrendingDown size={14} />,
  increase_savings: <FiDollarSign size={14} />,
  monitor: <FiEye size={14} />,
  reduce_discretionary: <FiAlertTriangle size={14} />,
  trend_warning: <FiTrendingUp size={14} />,
  emergency_fund: <FiShield size={14} />,
  optimize: <FiSettings size={14} />,
  create: <FiPlusCircle size={14} />,
  good: <FiCheckCircle size={14} />,
};

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
  const [mlInsights, setMlInsights] = useState(null);
  const [mlPredictions, setMlPredictions] = useState(null);
  const [mlAvailable, setMlAvailable] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/login'); return; }
    let mounted = true;
    let interval;
    const load = async () => {
      try {
        const [sRes, iRes, eRes, bRes, gRes] = await Promise.all([
          dashboardAPI.getSummary(), incomeAPI.getAll(), expenseAPI.getAll(),
          budgetAPI.getAll(), goalAPI.getAll(),
        ]);
        if (mounted) {
          setSummary(sRes.data); setIncomes(iRes.data || []);
          setExpenses(eRes.data || []); setBudgets(bRes.data || []);
          setGoals(gRes.data || []);
        }
        try { const invRes = await investmentAPI.getAll(); if (mounted) setInvestments(invRes.data || []); } catch {}
        try { const recRes = await analyticsAPI.getBudgetRecommendations(); if (mounted && recRes.data?.recommendations) setBackendRecs(recRes.data.recommendations); } catch {}
        // ML service integration — graceful fallback if unavailable
        try {
          const [healthRes, insightsRes] = await Promise.all([
            mlAPI.getHealth(),
            mlAPI.getFinancialInsights(),
          ]);
          if (mounted) {
            const mlUp = healthRes.data?.mlServiceAvailable || false;
            setMlAvailable(mlUp);
            if (mlUp && insightsRes.data) {
              setMlInsights(insightsRes.data);
              setMlPredictions(insightsRes.data.predictions || null);
            }
          }
        } catch {
          if (mounted) setMlAvailable(false);
        }
      } catch (err) { console.error(err); }
      finally { if (mounted) setLoading(false); }
    };
    load();
    interval = setInterval(load, 30000);
    window.addEventListener('focus', load);
    window.addEventListener('sfi-data-imported', load);
    return () => { mounted = false; clearInterval(interval); window.removeEventListener('focus', load); window.removeEventListener('sfi-data-imported', load); };
  }, [navigate]);

  const computed = useMemo(() => {
    if (!summary) return null;
    const curMonth = getCurrentMonthKey();
    const prevMonth = getPreviousMonthKey();
    const curMonthIncome = incomes.filter(i => getMonthKey(i.date) === curMonth).reduce((s, i) => s + Number(i.amount || 0), 0);
    const prevMonthIncome = incomes.filter(i => getMonthKey(i.date) === prevMonth).reduce((s, i) => s + Number(i.amount || 0), 0);
    const curMonthExpenses = expenses.filter(e => getMonthKey(e.date) === curMonth).reduce((s, e) => s + Number(e.amount || 0), 0);
    const prevMonthExpenses = expenses.filter(e => getMonthKey(e.date) === prevMonth).reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalIncome = summary.totalIncome || 0;
    const totalExpenses = summary.totalExpenses || 0;
    const savings = summary.savings || 0;
    const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100) : 0;
    let expenseTrendPct = 0;
    let expenseTrendDir = 'flat';
    if (prevMonthExpenses > 0) {
      expenseTrendPct = Math.round(((curMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100);
      expenseTrendDir = expenseTrendPct > 0 ? 'up' : expenseTrendPct < 0 ? 'down' : 'flat';
    } else if (curMonthExpenses > 0) { expenseTrendPct = 100; expenseTrendDir = 'up'; }
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
    if (budgetStatus === 'Exceeded') { budgetHealth = 'Exceeded'; budgetHealthColor = 'danger'; }
    else if (budgetStatus === 'Near Limit') { budgetHealth = 'Near Limit'; budgetHealthColor = 'warning'; }
    const expenseByCategory = {};
    expenses.forEach(e => { const cat = e.category || 'Other'; expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0); });
    const topCategory = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
    const curMonthExpenseByCategory = {};
    expenses.filter(e => getMonthKey(e.date) === curMonth).forEach(e => { const cat = e.category || 'Other'; curMonthExpenseByCategory[cat] = (curMonthExpenseByCategory[cat] || 0) + Number(e.amount || 0); });
    let overallPerformance = 'Needs Improvement';
    let overallPerformanceColor = 'danger';
    if (aiScore >= 80) { overallPerformance = 'Excellent'; overallPerformanceColor = 'success'; }
    else if (aiScore >= 60) { overallPerformance = 'Good'; overallPerformanceColor = 'info'; }
    else if (aiScore >= 40) { overallPerformance = 'Average'; overallPerformanceColor = 'warning'; }
    return {
      aiScore, scoreLabel, savingsRate, expenseTrendPct, expenseTrendDir,
      budgetHealth, budgetHealthColor, curMonthIncome, prevMonthIncome,
      curMonthExpenses, prevMonthExpenses, totalIncome, totalExpenses, savings,
      topCategory, expenseByCategory, curMonthExpenseByCategory,
      overallPerformance, overallPerformanceColor, goals, investments,
    };
  }, [summary, incomes, expenses, budgets, goals, investments]);

  const recommendations = useMemo(() => {
    if (!computed) return [];
    const recs = [];
    let id = 0;
    const add = (priority, icon, title, text) => { recs.push({ id: id++, priority, icon, title, text }); };
    const { totalIncome, totalExpenses, savings, savingsRate, curMonthIncome, prevMonthIncome, curMonthExpenses, prevMonthExpenses, curMonthExpenseByCategory, goals: userGoals } = computed;

    if (totalExpenses > 0) {
      const sortedCats = Object.entries(curMonthExpenseByCategory).sort((a, b) => b[1] - a[1]);
      if (sortedCats.length > 0) {
        const [cat, amt] = sortedCats[0];
        const pctOfTotal = (amt / totalExpenses) * 100;
        if (pctOfTotal > 35) {
          const reduceAmt = Math.round(amt * 0.12);
          add('critical', icons.alertCircle, `${cat} dominates your spending`, `You spent ${fmt(amt)} on ${cat} this month (${pctOfTotal.toFixed(0)}% of total). Try reducing by 10-15% — about ${fmt(reduceAmt)} — to rebalance.`);
        } else if (pctOfTotal > 25) {
          add('moderate', icons.barChart, `${cat} is your top expense`, `${cat} accounts for ${pctOfTotal.toFixed(0)}% at ${fmt(amt)}. Keep an eye on this category.`);
        }
      }
    }

    if (totalIncome > 0) {
      if (savingsRate < 20) {
        const gap = Math.round(totalIncome * 0.2 - savings);
        if (gap > 0) add('critical', icons.target, 'Savings rate below 20%', `Your savings rate is ${savingsRate.toFixed(1)}%. Save at least ${fmt(gap)} more to reach the recommended 20%.`);
      } else if (savingsRate >= 20 && savingsRate < 40) {
        add('good', icons.check, 'Healthy savings habit', `You're saving ${savingsRate.toFixed(1)}% of income — a solid financial habit. Keep it up!`);
      } else if (savingsRate >= 40) {
        add('good', icons.trendingUp, 'Excellent savings rate', `At ${savingsRate.toFixed(1)}%, consider investing a portion in SIPs or mutual funds to grow wealth faster.`);
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
          add('critical', icons.alertCircle, `${b.category} exceeded budget`, `You exceeded by ${fmt(overBy)}. Consider cutting back.`);
          anyExceeded = true;
        } else if (pct >= 80) anyNearLimit = true;
      });
      if (!anyExceeded && anyNearLimit) add('moderate', icons.alertCircle, 'Budgets nearing limit', 'Some categories are above 80%. Monitor closely.');
      if (!anyExceeded && !anyNearLimit) add('good', icons.check, 'All budgets on track', 'Spending within limits across all categories!');
    }

    if (prevMonthExpenses > 0) {
      const pctChange = Math.round(((curMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100);
      if (pctChange > 5) add('critical', icons.trendingUp, `Expenses up ${pctChange}%`, `Rose from ${fmt(prevMonthExpenses)} to ${fmt(curMonthExpenses)}. Review spending patterns.`);
      else if (pctChange < -5) add('good', icons.trendingDown, `Expenses down ${Math.abs(pctChange)}%`, `Great! Dropped from ${fmt(prevMonthExpenses)} to ${fmt(curMonthExpenses)}.`);
    }

    if (prevMonthIncome > 0) {
      const pctChange = Math.round(((curMonthIncome - prevMonthIncome) / prevMonthIncome) * 100);
      if (pctChange < -10) add('critical', icons.trendingDown, `Income down ${Math.abs(pctChange)}%`, `Dropped from ${fmt(prevMonthIncome)} to ${fmt(curMonthIncome)}. Diversify income sources.`);
      else if (pctChange > 10) add('good', icons.trendingUp, `Income up ${pctChange}%`, `Grew from ${fmt(prevMonthIncome)} to ${fmt(curMonthIncome)}. Allocate extra towards savings.`);
    }

    if (health) {
      const { score } = health;
      if (score < 60) add('critical', icons.shield, 'Health needs attention', `Score: ${score}/100. Focus on increasing income and building emergency fund.`);
      else if (score >= 60 && score < 80) add('moderate', icons.shield, 'Health is fair', `Score: ${score}/100. Boost savings rate to push into Excellent range.`);
      else if (score >= 80) add('good', icons.shield, 'Excellent health', `Score: ${score}/100. Great shape! Keep diversifying investments.`);
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
        if (pct < 40 && remaining > 0) add('moderate', icons.target, `${g.goalName} needs attention`, `Saved ${pct.toFixed(0)}% of ${fmt(target)}. Save ${fmt(needed)}/month to reach it.`);
        else if (pct >= 80 && pct < 100) add('good', icons.check, `${g.goalName} almost done`, `${pct.toFixed(0)}% there with ${fmt(remaining)} remaining!`);
        else if (pct >= 100) add('good', icons.check, `${g.goalName} achieved!`, `Congrats! You reached your ${fmt(target)} goal.`);
      });
    }

    if (totalIncome > 0 && (totalExpenses / totalIncome) > 0.9) {
      add('critical', icons.alertCircle, 'Spending matches income', `Spending ${(totalExpenses / totalIncome * 100).toFixed(0)}% of income. Keep below 70-80%.`);
    }

    const userInvestments = computed?.investments || [];
    if (userInvestments.length > 0) {
      const active = userInvestments.filter(inv => inv.status === 'active');
      const totalInv = active.reduce((s, inv) => s + (inv.amount || 0), 0);
      const totalCurr = active.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
      const overallReturn = totalInv > 0 ? ((totalCurr - totalInv) / totalInv) * 100 : 0;
      if (overallReturn < -5) add('critical', icons.trendingDown, 'Portfolio declining', `Down ${Math.abs(overallReturn).toFixed(1)}%. Review and rebalance.`);
      else if (overallReturn > 15) add('good', icons.trendingUp, 'Strong performance', `Up ${overallReturn.toFixed(1)}%. Consider booking partial profits.`);
      if (active.length === 1) add('moderate', icons.alertCircle, 'Concentrated risk', 'Only 1 investment. Diversify across asset classes.');
      const types = [...new Set(active.map(inv => inv.type))];
      if (types.length <= 2 && active.length >= 2) add('moderate', icons.pieChart, 'Low diversification', `Only ${types.length} asset class(es). Add bonds, gold, or real estate.`);
    } else if (totalIncome > 0 && savingsRate > 10) {
      add('moderate', icons.piggyBank, 'Start investing', `Saving ${savingsRate.toFixed(0)}%. Consider SIPs in index funds.`);
    }

    const discretionaryCats = ['Shopping', 'Entertainment', 'Travel'];
    const discretionaryTotal = Object.entries(computed.expenseByCategory).filter(([cat]) => discretionaryCats.includes(cat)).reduce((s, [, v]) => s + v, 0);
    if (totalExpenses > 0 && (discretionaryTotal / totalExpenses) > 0.3) {
      add('moderate', icons.alertCircle, 'High discretionary spending', `Shopping/Entertainment/Travel = ${((discretionaryTotal / totalExpenses) * 100).toFixed(0)}%. Reduce by 10-15%.`);
    }

    const priorityOrder = { critical: 0, moderate: 1, good: 2 };
    recs.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
    const backendMapped = backendRecs.map(rec => ({
      id: `backend-${rec.id}`, priority: rec.priority === 'high' ? 'critical' : rec.priority === 'medium' ? 'moderate' : 'good',
      icon: typeIconMap[rec.type] || <FiZap size={14} />, title: rec.title, text: rec.message, category: rec.category,
    }));
    // ML-generated recommendations
    const mlRecs = (mlInsights?.recommendations || []).map((rec, i) => ({
      id: `ml-${i}`, priority: rec.priority === 'high' ? 'critical' : rec.priority === 'medium' ? 'moderate' : 'good',
      icon: <FiCpu size={14} />, title: rec.title, text: rec.message, category: rec.type, source: 'ml',
    }));
    const allSources = [...mlRecs, ...backendMapped];
    const catSeen = new Set(allSources.map(r => r.category).filter(Boolean));
    const clientFiltered = recs.filter(r => !r.category || !catSeen.has(r.category));
    const merged = [...allSources, ...clientFiltered];
    merged.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
    return merged.slice(0, 10);
  }, [computed, budgets, backendRecs, health, mlInsights]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const incByMonth = {};
    const expByMonth = {};
    months.forEach(m => { incByMonth[m] = 0; expByMonth[m] = 0; });
    incomes.forEach(inc => { const m = new Date(inc.date).toISOString().slice(0, 7); if (incByMonth[m] !== undefined) incByMonth[m] += Number(inc.amount || 0); });
    expenses.forEach(exp => { const m = new Date(exp.date).toISOString().slice(0, 7); if (expByMonth[m] !== undefined) expByMonth[m] += Number(exp.amount || 0); });
    return {
      labels: months.map(m => { const [y, mo] = m.split('-'); return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short' }); }),
      income: months.map(m => incByMonth[m]), expenses: months.map(m => expByMonth[m]),
    };
  }, [incomes, expenses]);

  if (loading) return <Layout title="AI Financial Insights"><LoadingSpinner text="Analyzing your finances with AI..." /></Layout>;
  if (!computed) return <Layout title="AI Financial Insights"><LoadingSpinner text="Loading data..." /></Layout>;

  const monthlyTrendData = {
    labels: monthlyData.labels,
    datasets: [
      { label: 'Income', data: monthlyData.income, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#10B981', pointBorderColor: '#111827', pointBorderWidth: 2 },
      { label: 'Expenses', data: monthlyData.expenses, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#EF4444', pointBorderColor: '#111827', pointBorderWidth: 2 },
    ],
  };

  const monthlyTrendOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } } },
    scales: { x: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } }, y: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } } },
  };

  const catLabels = Object.keys(computed.expenseByCategory);
  const catValues = Object.values(computed.expenseByCategory);
  const catColors = ['#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#10B981', '#6366F1', '#14B8A6', '#F97316', '#6B7280'];

  const doughnutData = {
    labels: catLabels.length > 0 ? catLabels : ['No Data'],
    datasets: [{ data: catValues.length > 0 ? catValues : [1], backgroundColor: catLabels.length > 0 ? catColors.slice(0, catLabels.length) : ['#334155'], borderColor: '#111827', borderWidth: 3, hoverOffset: 6 }],
  };

  const doughnutOptions = { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } } } };

  const aiColor = computed.aiScore >= 80 ? '#10B981' : computed.aiScore >= 60 ? '#3B82F6' : computed.aiScore >= 40 ? '#F59E0B' : '#EF4444';
  const aiBadge = computed.aiScore >= 80 ? 'success' : computed.aiScore >= 60 ? 'info' : computed.aiScore >= 40 ? 'warning' : 'danger';

  return (
    <Layout title="AI Financial Insights">
      {/* Hero Banner */}
      <Card style={{ marginBottom: '16px', background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))', border: '1px solid rgba(139,92,246,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FiCpu size={28} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>AI-Powered Financial Intelligence</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Personalized insights based on your income, expenses, savings, investments & goals</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {mlAvailable && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 999, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', fontSize: '0.68rem', fontWeight: 600, color: '#A78BFA' }}>
                <FiCpu size={11} />
                ML Active
              </div>
            )}
            <div style={{ position: 'relative', width: 70, height: 70 }}>
              <svg width={70} height={70} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={35} cy={35} r={28} fill="none" stroke="var(--border)" strokeWidth={6} />
                <circle cx={35} cy={35} r={28} fill="none" stroke={aiColor} strokeWidth={6} strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - computed.aiScore / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: aiColor }}>{computed.aiScore}</span>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>/100</span>
              </div>
            </div>
            <div>
              <Badge color={aiBadge} dot>{computed.scoreLabel}</Badge>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>AI Score</div>
            </div>
          </div>
        </div>
      </Card>

      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Total Income', value: fmt(computed.totalIncome), icon: <FiTrendingUp size={18} />, color: 'var(--success-light)', bg: 'rgba(16,185,129,0.12)', change: computed.prevMonthIncome > 0 ? Math.round(((computed.curMonthIncome - computed.prevMonthIncome) / computed.prevMonthIncome) * 100) : null },
          { label: 'Total Expenses', value: fmt(computed.totalExpenses), icon: <FiTrendingDown size={18} />, color: 'var(--danger-light)', bg: 'rgba(239,68,68,0.12)', change: computed.prevMonthExpenses > 0 ? Math.round(((computed.curMonthExpenses - computed.prevMonthExpenses) / computed.prevMonthExpenses) * 100) : null },
          { label: 'Net Savings', value: fmt(computed.savings), icon: <FiDollarSign size={18} />, color: computed.savings >= 0 ? 'var(--success-light)' : 'var(--danger-light)', bg: computed.savings >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', sub: `${computed.savingsRate.toFixed(1)}% rate` },
          { label: 'Budget Status', value: computed.budgetHealth, icon: <FiTarget size={18} />, color: computed.budgetHealthColor === 'success' ? 'var(--success-light)' : computed.budgetHealthColor === 'warning' ? 'var(--warning-light)' : 'var(--danger-light)', bg: computed.budgetHealthColor === 'success' ? 'rgba(16,185,129,0.12)' : computed.budgetHealthColor === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)' },
        ].map((s, i) => (
          <Card key={i} style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -6, right: -6, opacity: 0.06 }}>{s.icon}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                {s.change !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', fontWeight: 600, color: s.change >= 0 ? 'var(--success-light)' : 'var(--danger-light)', marginTop: '2px' }}>
                    {s.change >= 0 ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />}
                    {Math.abs(s.change)}% vs last month
                  </div>
                )}
                {s.sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.sub}</div>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Two Column: AI Analysis + Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px', marginBottom: '0' }}>
        {/* Left: AI Financial Analysis */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiBarChart2 size={16} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Smart Financial Analysis</h2>
          </div>

          {/* Quick Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {[
              { label: 'Income', value: fmt(computed.curMonthIncome), color: 'var(--success-light)', bg: 'rgba(16,185,129,0.08)' },
              { label: 'Expenses', value: fmt(computed.curMonthExpenses), color: 'var(--danger-light)', bg: 'rgba(239,68,68,0.08)' },
              { label: 'Savings', value: fmt(computed.curMonthIncome - computed.curMonthExpenses), color: (computed.curMonthIncome - computed.curMonthExpenses) >= 0 ? 'var(--success-light)' : 'var(--danger-light)', bg: (computed.curMonthIncome - computed.curMonthExpenses) >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: item.bg, border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Analysis Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { icon: <FiBarChart2 size={13} />, label: 'Top expense', value: computed.topCategory ? `${computed.topCategory[0]} — ${fmt(computed.topCategory[1])}` : 'N/A', color: 'var(--danger-light)' },
              { icon: computed.expenseTrendDir === 'down' ? <FiArrowDown size={13} /> : <FiArrowUp size={13} />, label: 'Expense trend', value: computed.expenseTrendDir === 'flat' ? 'Same as last month' : `${Math.abs(computed.expenseTrendPct)}% ${computed.expenseTrendDir === 'down' ? 'lower' : 'higher'}`, color: computed.expenseTrendDir === 'down' ? 'var(--success-light)' : 'var(--danger-light)' },
              { icon: <FiTarget size={13} />, label: 'Budget status', value: computed.budgetHealth, color: computed.budgetHealthColor === 'success' ? 'var(--success-light)' : computed.budgetHealthColor === 'warning' ? 'var(--warning-light)' : 'var(--danger-light)' },
              { icon: <FiDollarSign size={13} />, label: 'Savings rate', value: `${computed.savingsRate.toFixed(1)}%`, color: computed.savingsRate >= 20 ? 'var(--success-light)' : computed.savingsRate >= 10 ? 'var(--accent-light)' : 'var(--warning-light)' },
              { icon: <FiActivity size={13} />, label: 'Performance', value: computed.overallPerformance, color: computed.overallPerformanceColor === 'success' ? 'var(--success-light)' : computed.overallPerformanceColor === 'info' ? 'var(--accent-light)' : 'var(--warning-light)' },
              { icon: <FiShield size={13} />, label: 'Financial health', value: health ? `${health.score}/100 — ${health.status}` : 'N/A', color: health ? (health.score >= 80 ? 'var(--success-light)' : health.score >= 60 ? 'var(--accent-light)' : 'var(--warning-light)') : 'var(--text-muted)' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: 'var(--radius-md)', transition: 'all var(--transition-fast)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.label}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: item.color }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Goals Progress */}
          {computed.goals && computed.goals.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goal Progress</div>
              {computed.goals.slice(0, 3).map((g, i) => {
                const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
                return (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{g.goalName}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: pct >= 80 ? 'var(--success-light)' : 'var(--text-muted)' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--accent)' : 'var(--warning)', transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right: AI Recommendations */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiZap size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>AI Recommendations</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{recommendations.length} insight{recommendations.length !== 1 ? 's' : ''} generated</span>
            </div>
          </div>
          {recommendations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <FiCheckCircle size={32} style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '0.9rem' }}>Your finances look balanced!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recommendations.map((rec) => {
                const pc = rec.priority === 'critical' ? { bg: 'var(--danger-glow)', border: 'rgba(239,68,68,0.3)', dot: 'var(--danger)', badge: 'danger', label: 'Critical' }
                  : rec.priority === 'moderate' ? { bg: 'var(--warning-glow)', border: 'rgba(245,158,11,0.3)', dot: 'var(--warning)', badge: 'warning', label: 'Moderate' }
                  : { bg: 'var(--success-glow)', border: 'rgba(16,185,129,0.3)', dot: 'var(--success)', badge: 'success', label: 'Good' };
                return (
                  <div key={rec.id} style={{ display: 'flex', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', background: pc.bg, border: `1px solid ${pc.border}`, transition: 'all var(--transition-fast)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: `${pc.dot}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: pc.dot }}>
                      {typeof rec.icon === 'string' ? <Icon path={rec.icon} size={15} /> : rec.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rec.title}</span>
                        <Badge color={pc.badge} style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{pc.label}</Badge>
                      </div>
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>{rec.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ML Predictions (when available) */}
      {mlAvailable && mlInsights && (
        <Card style={{ marginBottom: '16px', border: '1px solid rgba(139,92,246,0.2)', background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(59,130,246,0.05))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiCpu size={16} style={{ color: '#A78BFA' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ML Predictions</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Powered by Flask ML service &bull; {mlInsights.dataPoints || 0} data points</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Predicted Savings', value: fmt(mlPredictions?.predictedSavingsNextMonth || 0), color: (mlPredictions?.predictedSavingsNextMonth || 0) >= 0 ? 'var(--success-light)' : 'var(--danger-light)', sub: mlPredictions?.savingsTrend ? `Trend: ${mlPredictions.savingsTrend}` : null },
              { label: 'Predicted Expenses', value: fmt(mlPredictions?.predictedExpensesNextMonth || 0), color: 'var(--danger-light)', sub: mlPredictions?.expenseTrend ? `Trend: ${mlPredictions.expenseTrend}` : null },
              { label: 'Health Score', value: `${mlInsights.financialHealth?.score || 0}/100`, color: (mlInsights.financialHealth?.score || 0) >= 80 ? 'var(--success-light)' : (mlInsights.financialHealth?.score || 0) >= 60 ? 'var(--accent-light)' : 'var(--warning-light)', sub: mlInsights.financialHealth?.status || null },
              { label: 'Income Trend', value: mlPredictions?.incomeTrend || 'stable', color: mlPredictions?.incomeTrend === 'increasing' ? 'var(--success-light)' : mlPredictions?.incomeTrend === 'decreasing' ? 'var(--danger-light)' : 'var(--text-muted)', sub: mlPredictions?.incomeTrendPercent ? `${mlPredictions.incomeTrendPercent > 0 ? '+' : ''}${mlPredictions.incomeTrendPercent}%` : null },
            ].map((item, i) => (
              <div key={i} style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '3px' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sub}</div>}
              </div>
            ))}
          </div>
          {mlInsights.recommendations && mlInsights.recommendations.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ML Recommendations</div>
              {mlInsights.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: 'var(--radius-md)', marginBottom: '6px', background: rec.priority === 'high' ? 'rgba(239,68,68,0.06)' : rec.priority === 'low' ? 'rgba(16,185,129,0.06)' : 'var(--bg-glass)', border: `1px solid ${rec.priority === 'high' ? 'rgba(239,68,68,0.15)' : rec.priority === 'low' ? 'rgba(16,185,129,0.15)' : 'var(--border-light)'}` }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</span>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.4 }}>{rec.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Charts Row: 6-Month Trend + Expense Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiActivity size={16} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6-Month Income vs Expenses</h2>
          </div>
          <div style={{ height: 260 }}><Line data={monthlyTrendData} options={monthlyTrendOptions} /></div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiPieChart size={16} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Expense Breakdown</h2>
          </div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
            {catLabels.slice(0, 5).map((cat, i) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: catColors[i % catColors.length] }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{cat}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Investment Performance */}
      {computed.investments && computed.investments.length > 0 && (() => {
        const activeInvs = computed.investments.filter(inv => inv.status === 'active');
        const totalInv = activeInvs.reduce((s, inv) => s + (inv.amount || 0), 0);
        const totalCurr = activeInvs.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
        const totalRet = totalInv > 0 ? ((totalCurr - totalInv) / totalInv) * 100 : 0;
        const types = [...new Set(activeInvs.map(inv => inv.type))];
        const bestInv = activeInvs.reduce((best, inv) => {
          const ret = inv.amount > 0 ? ((inv.currentValue - inv.amount) / inv.amount) * 100 : 0;
          const bestRet = best?.amount > 0 ? ((best.currentValue - best.amount) / best.amount) * 100 : -Infinity;
          return ret > bestRet ? inv : best;
        }, activeInvs[0]);
        return (
          <Card style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiBriefcase size={16} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Investment Performance</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Invested', value: fmt(totalInv), color: 'var(--accent-light)' },
                { label: 'Current Value', value: fmt(totalCurr), color: totalCurr >= totalInv ? 'var(--success-light)' : 'var(--danger-light)' },
                { label: 'Return', value: `${totalRet >= 0 ? '+' : ''}${totalRet.toFixed(1)}%`, color: totalRet >= 0 ? 'var(--success)' : 'var(--danger)' },
                { label: 'Asset Classes', value: types.length, color: 'var(--purple-light)' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
            {bestInv && bestInv.name && (
              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FiTrendingUp size={16} style={{ color: 'var(--success-light)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success-light)' }}>Best Performer</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bestInv.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{bestInv.type} &bull; {bestInv.category}</div>
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Financial Health Score */}
      {health && (() => {
        const fh = health;
        const fhColor = fh.status === 'Excellent' ? 'var(--success)' : fh.status === 'Good' ? 'var(--accent)' : fh.status === 'Fair' ? 'var(--warning)' : 'var(--danger)';
        const fhBadge = fh.status === 'Excellent' ? 'success' : fh.status === 'Good' ? 'info' : fh.status === 'Fair' ? 'warning' : 'danger';
        return (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiShield size={16} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Financial Health Score</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <SemiCircleGauge score={fh.score} size={240} color={fhColor} />
                <div style={{ textAlign: 'center', marginTop: '-8px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: fhColor }}>{fh.score}/100</div>
                  <Badge color={fhBadge} dot style={{ marginTop: '6px' }}>{fh.status}</Badge>
                </div>
              </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Savings Rate', value: `${fh.savingsRate}%`, color: 'var(--accent-light)' },
                  { label: 'Total Income', value: fmt(fh.totalIncome), color: 'var(--success-light)' },
                  { label: 'Total Expenses', value: fmt(fh.totalExpenses), color: 'var(--danger-light)' },
                  { label: 'Total Savings', value: fmt(fh.totalSavings), color: fh.totalSavings >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: row.color }}>{row.value}</span>
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
