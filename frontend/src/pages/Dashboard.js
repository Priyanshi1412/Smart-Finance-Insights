import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, incomeAPI, expenseAPI, investmentAPI, portfolioAPI, goalAPI, analyticsAPI, notificationAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { fmt, fmtDate } from '../utils/formatters';

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  FiTrendingDown, FiTrendingUp, FiDollarSign, FiEye, FiAlertTriangle,
  FiShield, FiSettings, FiPlusCircle, FiCheckCircle, FiZap,
  FiAlertOctagon, FiTarget, FiClock,
} from 'react-icons/fi';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler,
);

const summaryStyles = [
  { gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))', color: 'var(--success-light)', icon: icons.trendingUp },
  { gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))', color: 'var(--danger-light)', icon: icons.trendingDown },
  { gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))', color: 'var(--accent-light)', icon: icons.piggyBank },
  { gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', color: 'var(--warning-light)', icon: icons.target },
];

const chartColors = {
  green: '#10B981',
  greenLight: '#34D399',
  red: '#EF4444',
  redLight: '#F87171',
  blue: '#3B82F6',
  blueLight: '#60A5FA',
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  amber: '#F59E0B',
  amberLight: '#FBBF24',
  teal: '#14B8A6',
  tealLight: '#2DD4BF',
  pink: '#EC4899',
  indigo: '#6366F1',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, savings: 0, budget: { status: 'On Track', percentUsed: 0, limit: 0 } });
  const [transactions, setTransactions] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invAnalytics, setInvAnalytics] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [budgetRecommendations, setBudgetRecommendations] = useState(null);
  const [financialHealthData, setFinancialHealthData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    let mounted = true;
    let interval;

    const load = async () => {
      try {
        const [sRes, tRes, iRes, eRes] = await Promise.all([
          dashboardAPI.getSummary(),
          dashboardAPI.getRecentTransactions(),
          incomeAPI.getAll(),
          expenseAPI.getAll(),
        ]);
        if (mounted) {
          setSummary(sRes.data);
          setTransactions(tRes.data);
          setIncomes(iRes.data || []);
          setExpenses(eRes.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }

      try {
        const [invRes, portRes, goalRes] = await Promise.allSettled([
          investmentAPI.getAnalytics(),
          portfolioAPI.getAnalytics(),
          goalAPI.getAll(),
        ]);
        if (mounted) {
          if (invRes.status === 'fulfilled') setInvAnalytics(invRes.value.data);
          if (portRes.status === 'fulfilled') setPortfolioData(portRes.value.data);
          if (goalRes.status === 'fulfilled') setGoals(goalRes.value.data || []);
        }
      } catch {}

      try {
        const [brRes, fhRes] = await Promise.allSettled([
          analyticsAPI.getBudgetRecommendations(),
          analyticsAPI.getFinancialHealth(),
        ]);
        if (mounted) {
          if (brRes.status === 'fulfilled') setBudgetRecommendations(brRes.value.data);
          if (fhRes.status === 'fulfilled') setFinancialHealthData(fhRes.value.data);
        }
      } catch {}

      try {
        await notificationAPI.generate();
      } catch {}
    };

    load();
    interval = setInterval(load, 30000);
    window.addEventListener('focus', load);

    return () => { mounted = false; clearInterval(interval); window.removeEventListener('focus', load); };
  }, [navigate]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount || 0);
    });
    return map;
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      months.push(key);
    }
    const incByMonth = {};
    const expByMonth = {};
    months.forEach(m => { incByMonth[m] = 0; expByMonth[m] = 0; });
    incomes.forEach(inc => {
      const m = new Date(inc.date).toISOString().slice(0, 7);
      if (incByMonth[m] !== undefined) incByMonth[m] += Number(inc.amount || 0);
    });
    expenses.forEach(exp => {
      const m = new Date(exp.date).toISOString().slice(0, 7);
      if (expByMonth[m] !== undefined) expByMonth[m] += Number(exp.amount || 0);
    });
    return {
      labels: months.map(m => {
        const [y, mo] = m.split('-');
        return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short' });
      }),
      income: months.map(m => incByMonth[m]),
      expenses: months.map(m => expByMonth[m]),
    };
  }, [incomes, expenses]);

  const sixMonthData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = currentMonth - i;
      const d = new Date(currentYear, m, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const incByMonth = {};
    const expByMonth = {};
    months.forEach(m => { incByMonth[m] = 0; expByMonth[m] = 0; });
    incomes.forEach(inc => {
      const m = new Date(inc.date).toISOString().slice(0, 7);
      if (incByMonth[m] !== undefined) incByMonth[m] += Number(inc.amount || 0);
    });
    expenses.forEach(exp => {
      const m = new Date(exp.date).toISOString().slice(0, 7);
      if (expByMonth[m] !== undefined) expByMonth[m] += Number(exp.amount || 0);
    });
    return {
      labels: months.map(m => {
        const [y, mo] = m.split('-');
        return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short' });
      }),
      income: months.map(m => incByMonth[m]),
      expenses: months.map(m => expByMonth[m]),
    };
  }, [incomes, expenses]);

  if (loading) return <Layout title="Dashboard"><LoadingSpinner text="Loading your dashboard..." /></Layout>;

  const summaryCards = [
    { label: 'Total Income', value: fmt(summary.totalIncome), trend: '+12%', ...summaryStyles[0] },
    { label: 'Total Expenses', value: fmt(summary.totalExpenses), trend: summary.totalIncome > 0 ? `-${Math.min(100, Math.round((summary.totalExpenses / summary.totalIncome) * 100))}%` : '0%', ...summaryStyles[1] },
    { label: 'Net Savings', value: fmt(summary.savings), trend: summary.totalIncome > 0 ? `${((summary.savings / summary.totalIncome) * 100).toFixed(1)}%` : '0%', ...summaryStyles[2] },
    { label: 'Budget Status', value: summary.budget.status, trend: `${Math.round(summary.budget.percentUsed)}% used`, ...summaryStyles[3] },
  ];

  const budgetColor = summary.budget.status === 'Exceeded' ? 'danger' : summary.budget.status === 'Near Limit' ? 'warning' : 'success';

  const barChartData = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Income',
        data: monthlyData.income,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: chartColors.green,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Expenses',
        data: monthlyData.expenses,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: chartColors.red,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  const catColors = [chartColors.blue, chartColors.red, chartColors.purple, chartColors.amber, chartColors.teal, chartColors.pink, chartColors.indigo, chartColors.green, chartColors.blueLight, chartColors.redLight];
  const catLabels = Object.keys(expenseByCategory);
  const catValues = Object.values(expenseByCategory);

  const doughnutData = {
    labels: catLabels.length > 0 ? catLabels : ['No Data'],
    datasets: [{
      data: catValues.length > 0 ? catValues : [1],
      backgroundColor: catLabels.length > 0 ? catColors.slice(0, catLabels.length) : ['#334155'],
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } },
    },
  };

  const lineChartData = {
    labels: sixMonthData.labels,
    datasets: [
      {
        label: 'Income',
        data: sixMonthData.income,
        borderColor: chartColors.green,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: chartColors.green,
        pointBorderColor: '#111827',
        pointBorderWidth: 2,
      },
      {
        label: 'Expenses',
        data: sixMonthData.expenses,
        borderColor: chartColors.red,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: chartColors.red,
        pointBorderColor: '#111827',
        pointBorderWidth: 2,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  return (
    <Layout title="Dashboard">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        {summaryCards.map((card, i) => (
          <Card key={i} hoverable style={{ background: card.gradient, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.08 }}>
              <Icon path={card.icon} size={80} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{card.label}</span>
              <Badge color={i === 0 ? 'success' : i === 1 ? 'danger' : i === 2 ? 'info' : budgetColor}>
                {card.trend}
              </Badge>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: card.color }}>
              {card.value}
            </div>
            {i === 3 && (
              <div style={{ marginTop: '12px', height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999, width: `${Math.min(summary.budget.percentUsed, 100)}%`,
                  background: budgetColor === 'danger' ? 'var(--danger)' : budgetColor === 'warning' ? 'var(--warning)' : 'var(--success)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Income vs Expenses</h2>
          </div>
          <div style={{ height: 260 }}>
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Expense Breakdown</h2>
          </div>
          <div style={{ height: 260 }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.activity} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6-Month Trend</h2>
          </div>
          <div style={{ height: 260 }}>
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.clock} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent Transactions</h2>
            </div>
          </div>
          {transactions.length === 0 ? (
            <EmptyState icon={icons.wallet} title="No transactions yet" description="Add income or expenses to see them here" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transactions.map((tx) => (
                <div key={tx._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-glow)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: tx.type === 'income' ? 'var(--success-glow)' : 'var(--danger-glow)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon path={tx.type === 'income' ? icons.trendingUp : icons.trendingDown} size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{tx.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.category}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: tx.type === 'income' ? 'var(--success-light)' : 'var(--danger-light)' }}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(tx.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ===== Investment Summary Cards ===== */}
      {invAnalytics && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '28px' }}>
            {[
              { label: 'Total Investment', value: fmt(invAnalytics.summary.totalInvested), icon: icons.investments, color: 'var(--purple)' },
              { label: 'Portfolio Value', value: fmt(invAnalytics.summary.totalCurrentValue), icon: icons.trendingUp, color: 'var(--success)' },
              { label: 'Profit / Loss', value: `${invAnalytics.summary.totalReturns >= 0 ? '+' : ''}${fmt(invAnalytics.summary.totalReturns)}`, icon: icons.activity, color: invAnalytics.summary.totalReturns >= 0 ? 'var(--success)' : 'var(--danger)' },
              { label: 'Overall ROI', value: `${invAnalytics.summary.returnPct >= 0 ? '+' : ''}${invAnalytics.summary.returnPct}%`, icon: icons.target, color: invAnalytics.summary.returnPct >= 0 ? 'var(--success)' : 'var(--danger)' },
            ].map((card, i) => (
              <Card key={i} hoverable style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.08 }}>
                  <Icon path={card.icon} size={80} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{card.label}</span>
                  <Badge color="info">{card.value}</Badge>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: card.color }}>{card.value}</div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Portfolio Growth */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.trendingUp} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Portfolio Growth</h2>
              </div>
              {portfolioData?.monthlyGrowth?.length > 0 ? (
                <div style={{ height: 260 }}>
                  <Line data={{
                    labels: portfolioData.monthlyGrowth.map(d => d.month),
                    datasets: [
                      { label: 'Invested', data: portfolioData.monthlyGrowth.map(d => d.invested), borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#8B5CF6', pointBorderColor: '#111827', pointBorderWidth: 2 },
                      { label: 'Current Value', data: portfolioData.monthlyGrowth.map(d => d.value), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#10B981', pointBorderColor: '#111827', pointBorderWidth: 2 },
                    ],
                  }} options={lineChartOptions} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No portfolio data yet</div>
              )}
            </Card>

            {/* Asset Allocation */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.pieChart} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Asset Allocation</h2>
              </div>
              {invAnalytics.typeBreakdown.length > 0 ? (
                <div style={{ height: 260 }}>
                  <Doughnut data={{
                    labels: invAnalytics.typeBreakdown.map(t => t.type),
                    datasets: [{ data: invAnalytics.typeBreakdown.map(t => t.currentValue), backgroundColor: invAnalytics.typeBreakdown.map((t, i) => [chartColors.blue, chartColors.green, chartColors.amber, chartColors.purple, chartColors.teal, chartColors.pink, chartColors.red, chartColors.indigo][i % 8] + 'CC'), borderColor: '#111827', borderWidth: 3, hoverOffset: 6 }],
                  }} options={doughnutOptions} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No investments yet</div>
              )}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Top Performing Assets */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.trendingUp} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Top Performing Assets</h2>
              </div>
              {(!portfolioData?.topPerformers || portfolioData.topPerformers.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No profitable investments yet</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'Name', 'Type', 'Invested', 'Current', 'ROI'].map(h => (
                          <th key={h} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(portfolioData?.topPerformers || []).map((p, i) => (
                        <tr key={i} style={{ transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{i + 1}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{p.type}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.amount)}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.currentValue)}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600, padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>+{p.returnPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Worst Performing Assets */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.trendingDown} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Worst Performing Assets</h2>
              </div>
              {(!portfolioData?.lowestPerformers || portfolioData.lowestPerformers.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No loss-making investments</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'Name', 'Type', 'Invested', 'Current', 'ROI'].map(h => (
                          <th key={h} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(portfolioData?.lowestPerformers || []).map((p, i) => (
                        <tr key={i} style={{ transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{i + 1}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{p.type}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.amount)}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.currentValue)}</td>
                          <td style={{ fontSize: '0.85rem', color: p.returnPct >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600, padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>{p.returnPct >= 0 ? '+' : ''}{p.returnPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Financial Goal Planning Summary + Risk Analysis */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Financial Goal Planning Summary Widget */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon path={icons.target} size={18} />
                  </div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Goal Planning Summary</h2>
                </div>
                <button
                  onClick={() => navigate('/financial-goal-planning')}
                  style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 600,
                    background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.2)',
                    color: 'var(--accent-light)', cursor: 'pointer', transition: 'all var(--transition-fast)',
                  }}
                >
                  View All
                </button>
              </div>
              {goals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No goals created yet</div>
              ) : (
                (() => {
                  const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
                  const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
                  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
                  const isCompleted = (g) => g.status === 'achieved';
                  const isActive = (g) => g.status === 'active';
                  const isOverdue = (g) => g.status === 'overdue';
                  const active = goals.filter(g => isActive(g)).length;
                  const completed = goals.filter(g => isCompleted(g)).length;
                  const overdue = goals.filter(g => isOverdue(g)).length;
                  const upcoming = goals.filter(g => {
                    if (!isActive(g)) return false;
                    const d = g.targetDate ? Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24)) : Infinity;
                    return d > 0 && d <= 30;
                  }).length;
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                        {[
                          { label: 'Overall', value: `${overallPct}%`, color: 'var(--accent)' },
                          { label: 'Active', value: active, color: 'var(--success)' },
                          { label: 'Completed', value: completed, color: 'var(--purple)' },
                          { label: 'Overdue', value: overdue, color: overdue > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                        ].map((item, i) => (
                          <div key={i} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: '10px' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${overallPct}%`, background: 'var(--accent)', transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>{fmt(totalSaved)} saved of {fmt(totalTarget)}</span>
                        <span>{goals.length} total goals</span>
                      </div>
                    </>
                  );
                })()
              )}
            </Card>

            {/* Risk Analysis */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.shield} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Risk Analysis</h2>
              </div>
              {portfolioData?.risk ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
                    <div style={{ position: 'relative', width: 90, height: 90 }}>
                      <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={45} cy={45} r={38} fill="none" stroke="var(--border)" strokeWidth={8} />
                        <circle cx={45} cy={45} r={38} fill="none" stroke={portfolioData.risk.score >= 70 ? 'var(--success)' : portfolioData.risk.score >= 40 ? 'var(--warning)' : 'var(--danger)'} strokeWidth={8} strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 * (1 - Math.min(portfolioData.risk.score, 100) / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{portfolioData.risk.score}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Risk Score</div>
                      <Badge color={portfolioData.risk.score >= 70 ? 'success' : portfolioData.risk.score >= 40 ? 'warning' : 'danger'}>{portfolioData.risk.label}</Badge>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '12px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Asset Classes</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{portfolioData.risk.numTypes}</div>
                    </div>
                    <div style={{ padding: '12px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Max Allocation</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: portfolioData.risk.maxAllocation > 60 ? 'var(--danger)' : 'var(--text-primary)' }}>{portfolioData.risk.maxAllocation}%</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No investment data for risk analysis</div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* ===== Milestone 3: Intelligence & Insights Sections ===== */}

      {/* Budget Recommendations */}
      <div style={{ marginBottom: '20px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.send} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Budget Recommendations</h2>
          </div>
          {budgetRecommendations ? (
            <>
              {budgetRecommendations.overspendingAlerts.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--danger-light)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon path={icons.alertCircle} size={14} /> Overspending Alerts
                  </div>
                  {budgetRecommendations.overspendingAlerts.map((alert, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--danger-light)' }}>
                          <FiAlertOctagon size={15} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{alert.category}</span>
                          <Badge color="danger">Exceeded by {fmt(alert.overBy)}</Badge>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '42px' }}>Spent {fmt(alert.spent)} of {fmt(alert.limit)} ({alert.percentage}%)</div>
                    </div>
                  ))}
                </div>
              )}
              {budgetRecommendations.recommendations.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-light)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon path={icons.send} size={14} /> Suggestions
                  </div>
                  {budgetRecommendations.recommendations.slice(0, 5).map((rec, i) => {
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
                    const recIcon = typeIconMap[rec.type] || <FiZap size={14} />;
                    return (
                    <div key={i} style={{ display: 'flex', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', marginBottom: '8px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: rec.priority === 'high' ? 'var(--danger-glow)' : rec.priority === 'medium' ? 'var(--warning-glow)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: rec.priority === 'high' ? 'var(--danger-light)' : rec.priority === 'medium' ? 'var(--warning-light)' : 'var(--success-light)' }}>
                        {recIcon}
                      </div>
                      <div style={{ flex: 1 }}>
                        {rec.title && <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{rec.title}</div>}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{rec.message}</div>
                        {rec.suggestedBudget && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--accent-light)', marginTop: '4px' }}>Suggested: {fmt(rec.suggestedBudget)}/month</div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
              {budgetRecommendations.recommendations.length === 0 && budgetRecommendations.overspendingAlerts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <Icon path={icons.check} size={32} />
                  <p style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Your budgets look good! No alerts or recommendations.</p>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Set budgets to get personalized recommendations</div>
          )}
        </Card>
      </div>

      {/* Financial Health Score */}
      <div style={{ marginBottom: '20px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.shield} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Financial Health Score</h2>
          </div>
          {financialHealthData ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
                <div style={{ position: 'relative', width: 110, height: 110 }}>
                  <svg width={110} height={110} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={55} cy={55} r={46} fill="none" stroke="var(--border)" strokeWidth={9} />
                    <circle cx={55} cy={55} r={46} fill="none"
                      stroke={financialHealthData.score >= 80 ? 'var(--success)' : financialHealthData.score >= 60 ? 'var(--accent)' : financialHealthData.score >= 40 ? 'var(--warning)' : 'var(--danger)'}
                      strokeWidth={9} strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 * (1 - Math.min(financialHealthData.score, 100) / 100)}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{financialHealthData.score}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/100</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <Badge color={financialHealthData.status === 'Excellent' ? 'success' : financialHealthData.status === 'Good' ? 'info' : financialHealthData.status === 'Fair' ? 'warning' : 'danger'} dot>{financialHealthData.status}</Badge>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>Overall Health</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
                    {financialHealthData.status === 'Excellent' ? 'Your finances are in great shape. Keep maintaining these habits!' :
                     financialHealthData.status === 'Good' ? 'Solid financial foundation. A few tweaks could make it excellent.' :
                     financialHealthData.status === 'Fair' ? 'Some areas need attention. Focus on the suggestions below.' :
                     'Your finances need urgent attention. Review the insights below.'}
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              {financialHealthData.scoreBreakdown && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Score Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'savingsRate', label: 'Savings Rate', icon: icons.piggyBank },
                      { key: 'investments', label: 'Investments', icon: icons.trendingUp },
                      { key: 'expenses', label: 'Expenses', icon: icons.expenses },
                      { key: 'debt', label: 'Debt Level', icon: icons.wallet },
                      { key: 'goals', label: 'Goal Progress', icon: icons.target },
                    ].map(({ key, label, icon }) => {
                      const item = financialHealthData.scoreBreakdown[key];
                      if (!item) return null;
                      const pct = item.max > 0 ? (item.score / item.max) * 100 : 0;
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon path={icon} size={12} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{item.score}/{item.max}</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Key Indicators */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  { label: 'Savings Ratio', value: `${financialHealthData.indicators.savingsRate}%`, color: financialHealthData.indicators.savingsRate >= 20 ? 'var(--success)' : 'var(--warning)' },
                  { label: 'Expense Ratio', value: `${financialHealthData.indicators.expenseRatio}%`, color: financialHealthData.indicators.expenseRatio < 70 ? 'var(--success)' : 'var(--danger)' },
                  { label: 'Investment Growth', value: `${financialHealthData.indicators.investmentGrowth}%`, color: financialHealthData.indicators.investmentGrowth >= 0 ? 'var(--success)' : 'var(--danger)' },
                  { label: 'Budget Used', value: `${financialHealthData.indicators.avgBudgetUtilization || 0}%`, color: (financialHealthData.indicators.avgBudgetUtilization || 0) <= 80 ? 'var(--success)' : (financialHealthData.indicators.avgBudgetUtilization || 0) <= 100 ? 'var(--warning)' : 'var(--danger)' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Insights */}
              {financialHealthData.insights.length > 0 && (
                <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Recommendations</div>
                  {financialHealthData.insights.slice(0, 3).map((insight, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: insight.type === 'critical' ? 'var(--danger-glow)' : insight.type === 'good' ? 'rgba(16,185,129,0.1)' : 'var(--warning-glow)' }}>
                      <Icon path={insight.type === 'critical' ? icons.alertCircle : insight.type === 'good' ? icons.check : icons.alertCircle} size={14} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insight.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Add financial data to see your health score</div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
