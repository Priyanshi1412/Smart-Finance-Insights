import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dashboardAPI, incomeAPI, expenseAPI, investmentAPI, portfolioAPI,
  goalAPI, analyticsAPI, notificationAPI,
} from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import ProgressRing from '../components/ui/ProgressRing';
import SemiCircleGauge from '../components/ui/SemiCircleGauge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { fmt, fmtDate } from '../utils/formatters';
import { notifTypeIcons, getNotifPriorityBg } from '../utils/notifications';
import {
  FiTrendingDown, FiTrendingUp, FiDollarSign, FiEye, FiAlertTriangle,
  FiShield, FiSettings, FiPlusCircle, FiCheckCircle, FiZap,
  FiAlertOctagon, FiTarget, FiClock, FiActivity, FiZap as FiZapIcon,
} from 'react-icons/fi';

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler,
);

const chartColors = {
  green: '#10B981', red: '#EF4444', blue: '#3B82F6',
  purple: '#8B5CF6', amber: '#F59E0B', teal: '#14B8A6',
  pink: '#EC4899', indigo: '#6366F1', blueLight: '#60A5FA', redLight: '#F87171',
};

const catColorPalette = [
  chartColors.blue, chartColors.red, chartColors.purple, chartColors.amber,
  chartColors.teal, chartColors.pink, chartColors.indigo, chartColors.green,
  chartColors.blueLight, chartColors.redLight,
];

const fadeInUp = { animation: 'fadeInUp 0.5s ease-out forwards', opacity: 0 };
const stagger = (i) => ({ animationDelay: `${i * 0.06}s` });

const recIconMap = {
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

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function IntelligenceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, savings: 0, budget: { status: 'On Track', percentUsed: 0, limit: 0 } });
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invAnalytics, setInvAnalytics] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [budgetRecs, setBudgetRecs] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    let mounted = true;

    const loadAll = async () => {
      try {
        const [sRes, iRes, eRes] = await Promise.all([
          dashboardAPI.getSummary(),
          incomeAPI.getAll(),
          expenseAPI.getAll(),
        ]);
        if (!mounted) return;
        setSummary(sRes.data);
        setIncomes(iRes.data || []);
        setExpenses(eRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }

      try {
        const [invRes, portRes, goalRes, brRes, fhRes, notifRes] = await Promise.allSettled([
          investmentAPI.getAnalytics(),
          portfolioAPI.getAnalytics(),
          goalAPI.getAll(),
          analyticsAPI.getBudgetRecommendations(),
          analyticsAPI.getFinancialHealth(),
          notificationAPI.getAll(),
        ]);
        if (!mounted) return;
        if (invRes.status === 'fulfilled') setInvAnalytics(invRes.value.data);
        if (portRes.status === 'fulfilled') setPortfolioData(portRes.value.data);
        if (goalRes.status === 'fulfilled') setGoals(goalRes.value.data || []);
        if (brRes.status === 'fulfilled') setBudgetRecs(brRes.value.data);
        if (fhRes.status === 'fulfilled') setHealthData(fhRes.value.data);
        if (notifRes.status === 'fulfilled') {
          setNotifications(notifRes.value.data.notifications || []);
          setNotifUnread(notifRes.value.data.unreadCount || 0);
        }
      } catch {}

      try { await notificationAPI.generate(); } catch {}
    };

    loadAll();
    const interval = setInterval(loadAll, 30000);
    window.addEventListener('sfi-data-imported', loadAll);
    return () => { mounted = false; clearInterval(interval); window.removeEventListener('sfi-data-imported', loadAll); };
  }, [navigate]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount || 0); });
    return map;
  }, [expenses]);

  const sixMonthData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const inc = {}, exp = {};
    months.forEach(m => { inc[m] = 0; exp[m] = 0; });
    incomes.forEach(i => {
      const m = new Date(i.date).toISOString().slice(0, 7);
      if (inc[m] !== undefined) inc[m] += Number(i.amount || 0);
    });
    expenses.forEach(e => {
      const m = new Date(e.date).toISOString().slice(0, 7);
      if (exp[m] !== undefined) exp[m] += Number(e.amount || 0);
    });
    return {
      labels: months.map(m => {
        const [y, mo] = m.split('-');
        return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short' });
      }),
      income: months.map(m => inc[m]),
      expenses: months.map(m => exp[m]),
    };
  }, [incomes, expenses]);

  const topCategory = useMemo(() => {
    const entries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
    return entries[0] ? { name: entries[0][0], amount: entries[0][1] } : null;
  }, [expenseByCategory]);

  const savingsRate = useMemo(() => {
    if (!summary.totalIncome) return 0;
    return Math.round(((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100 * 10) / 10;
  }, [summary]);

  if (loading) {
    return (
      <Layout title="Intelligence Dashboard">
        <LoadingSpinner text="Loading intelligence dashboard..." />
      </Layout>
    );
  }

  const budgetColor = summary.budget.status === 'Exceeded' ? 'danger' : summary.budget.status === 'Near Limit' ? 'warning' : 'success';
  const healthColor = healthData
    ? (healthData.score >= 80 ? 'var(--success)' : healthData.score >= 60 ? 'var(--accent)' : healthData.score >= 40 ? 'var(--warning)' : 'var(--danger)')
    : 'var(--accent)';

  const catLabels = Object.keys(expenseByCategory);
  const catValues = Object.values(expenseByCategory);

  const doughnutData = {
    labels: catLabels.length > 0 ? catLabels : ['No Data'],
    datasets: [{
      data: catValues.length > 0 ? catValues : [1],
      backgroundColor: catLabels.length > 0 ? catColorPalette.slice(0, catLabels.length) : ['#334155'],
      borderColor: '#111827', borderWidth: 3, hoverOffset: 6,
    }],
  };

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } },
    },
  };

  const barData = {
    labels: sixMonthData.labels,
    datasets: [
      { label: 'Income', data: sixMonthData.income, backgroundColor: 'rgba(16,185,129,0.7)', borderColor: chartColors.green, borderWidth: 2, borderRadius: 6, borderSkipped: false },
      { label: 'Expenses', data: sixMonthData.expenses, backgroundColor: 'rgba(239,68,68,0.7)', borderColor: chartColors.red, borderWidth: 2, borderRadius: 6, borderSkipped: false },
    ],
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  const lineData = {
    labels: sixMonthData.labels,
    datasets: [
      { label: 'Income', data: sixMonthData.income, borderColor: chartColors.green, backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: chartColors.green, pointBorderColor: '#111827', pointBorderWidth: 2 },
      { label: 'Expenses', data: sixMonthData.expenses, borderColor: chartColors.red, backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: chartColors.red, pointBorderColor: '#111827', pointBorderWidth: 2 },
    ],
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'overdue');
  const achievedGoals = goals.filter(g => g.status === 'achieved');
  const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
  const overallGoalPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <Layout title="Intelligence Dashboard">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .int-card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .int-card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
      `}</style>

      {/* ===== SECTION 1: Hero Row — Health Score + Analytics Summary ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '24px' }}>

        {/* Financial Health Score */}
        <div style={fadeInUp}>
          <Card style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.06 }}>
              <Icon path={icons.shield} size={120} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.shield} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Financial Health</h2>
            </div>

            {healthData ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px' }}>
                  <SemiCircleGauge score={healthData.score} size={180} />
                  <div style={{ flex: 1 }}>
                    <Badge
                      color={healthData.status === 'Excellent' ? 'success' : healthData.status === 'Good' ? 'info' : healthData.status === 'Fair' ? 'warning' : 'danger'}
                      dot
                      style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                    >
                      {healthData.status}
                    </Badge>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                      {healthData.status === 'Excellent' ? 'Your finances are in great shape. Keep it up!' :
                       healthData.status === 'Good' ? 'Solid foundation. A few tweaks could make it excellent.' :
                       healthData.status === 'Fair' ? 'Some areas need attention. Review insights below.' :
                       'Urgent attention needed. Review your financial plan.'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                      {[
                        { label: 'Savings Rate', value: `${healthData.indicators.savingsRate}%`, color: healthData.indicators.savingsRate >= 20 ? 'var(--success)' : 'var(--warning)' },
                        { label: 'Expense Ratio', value: `${healthData.indicators.expenseRatio}%`, color: healthData.indicators.expenseRatio < 70 ? 'var(--success)' : 'var(--danger)' },
                        { label: 'Investment Growth', value: `${healthData.indicators.investmentGrowth}%`, color: healthData.indicators.investmentGrowth >= 0 ? 'var(--success)' : 'var(--danger)' },
                        { label: 'Budget Used', value: `${healthData.indicators.avgBudgetUtilization || 0}%`, color: (healthData.indicators.avgBudgetUtilization || 0) <= 80 ? 'var(--success)' : 'var(--warning)' },
                      ].map((item, i) => (
                        <div key={i} style={{ padding: '8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                {healthData.scoreBreakdown && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'savingsRate', label: 'Savings', icon: icons.piggyBank },
                      { key: 'investments', label: 'Investments', icon: icons.trendingUp },
                      { key: 'expenses', label: 'Expenses', icon: icons.expenses },
                      { key: 'debt', label: 'Debt', icon: icons.wallet },
                      { key: 'goals', label: 'Goals', icon: icons.target },
                    ].map(({ key, label, icon }) => {
                      const item = healthData.scoreBreakdown[key];
                      if (!item) return null;
                      const pct = item.max > 0 ? (item.score / item.max) * 100 : 0;
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 22, height: 22, borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon path={icon} size={11} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{item.score}/{item.max}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Add data to see health score</div>
            )}
          </Card>
        </div>

        {/* Analytics Summary Cards */}
        <div style={{ ...fadeInUp, ...stagger(1) }}>
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.barChart} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Analytics Overview</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
              {[
                { label: 'Total Income', value: fmt(summary.totalIncome), icon: icons.trendingUp, color: 'var(--success)', bg: 'rgba(16,185,129,0.08)' },
                { label: 'Total Expenses', value: fmt(summary.totalExpenses), icon: icons.trendingDown, color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)' },
                { label: 'Net Savings', value: fmt(summary.savings), icon: icons.piggyBank, color: 'var(--accent)', bg: 'rgba(59,130,246,0.08)' },
                { label: 'Savings Rate', value: `${savingsRate}%`, icon: icons.target, color: savingsRate >= 20 ? 'var(--success)' : 'var(--warning)', bg: savingsRate >= 20 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)' },
                { label: 'Budget Status', value: summary.budget.status, icon: icons.wallet, color: budgetColor === 'danger' ? 'var(--danger)' : budgetColor === 'warning' ? 'var(--warning)' : 'var(--success)', bg: budgetColor === 'danger' ? 'rgba(239,68,68,0.08)' : budgetColor === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)' },
                { label: 'Top Spending', value: topCategory ? topCategory.name : 'N/A', icon: icons.alertCircle, color: 'var(--pink)', bg: 'rgba(236,72,153,0.08)' },
                ...(invAnalytics ? [
                  { label: 'Portfolio Value', value: fmt(invAnalytics.summary.totalCurrentValue), icon: icons.investments, color: 'var(--purple)', bg: 'rgba(139,92,246,0.08)' },
                  { label: 'Investment ROI', value: `${invAnalytics.summary.returnPct >= 0 ? '+' : ''}${invAnalytics.summary.returnPct}%`, icon: icons.activity, color: invAnalytics.summary.returnPct >= 0 ? 'var(--success)' : 'var(--danger)', bg: invAnalytics.summary.returnPct >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' },
                ] : []),
              ].map((card, i) => (
                <div key={i} className="int-card-hover" style={{
                  padding: '14px', borderRadius: 'var(--radius-lg)', background: card.bg,
                  border: '1px solid var(--border-light)', cursor: 'default',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: `${card.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                      <Icon path={card.icon} size={14} />
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Budget Progress Bar */}
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Budget Utilization</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: budgetColor === 'danger' ? 'var(--danger)' : budgetColor === 'warning' ? 'var(--warning)' : 'var(--success)' }}>{Math.round(summary.budget.percentUsed)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${Math.min(summary.budget.percentUsed, 100)}%`,
                  background: budgetColor === 'danger' ? 'var(--danger)' : budgetColor === 'warning' ? 'var(--warning)' : 'var(--success)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
              {summary.budget.limit > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {fmt(summary.totalExpenses)} spent of {fmt(summary.budget.limit)} limit
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ===== SECTION 2: Charts Row ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Expense Breakdown Pie */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.pieChart} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Spending by Category</h2>
            </div>
            <div style={{ height: 280 }}>
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </Card>
        </div>

        {/* Income vs Expenses Bar */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.barChart} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Income vs Expenses</h2>
            </div>
            <div style={{ height: 280 }}>
              <Bar data={barData} options={barOptions} />
            </div>
          </Card>
        </div>
      </div>

      {/* ===== SECTION 3: 6-Month Trend + Category Breakdown Table ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* 6-Month Trend */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.activity} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6-Month Trend</h2>
            </div>
            <div style={{ height: 280 }}>
              <Line data={lineData} options={lineOptions} />
            </div>
          </Card>
        </div>

        {/* Category Breakdown Table */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.expenses} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Category Breakdown</h2>
            </div>
            {catLabels.length === 0 ? (
              <EmptyState icon={icons.wallet} title="No expenses yet" description="Add expenses to see category breakdown" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Category', 'Amount', '% of Total', 'Bar'].map(h => (
                        <th key={h} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(expenseByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt], i) => {
                        const totalExp = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);
                        const pct = totalExp > 0 ? Math.round((amt / totalExp) * 100) : 0;
                        return (
                          <tr key={cat} style={{ transition: 'background var(--transition-fast)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '10px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: catColorPalette[i % catColorPalette.length], flexShrink: 0 }} />
                                {cat}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '10px', borderBottom: '1px solid var(--border-light)' }}>{fmt(amt)}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '10px', borderBottom: '1px solid var(--border-light)' }}>{pct}%</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid var(--border-light)', width: '30%' }}>
                              <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: catColorPalette[i % catColorPalette.length], transition: 'width 0.6s ease' }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ===== SECTION 4: Budget Recommendations + AI Insights ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Budget Recommendations */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.send} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Budget Recommendations</h2>
            </div>
            {budgetRecs ? (
              <>
                {budgetRecs.overspendingAlerts.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--danger-light)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon path={icons.alertCircle} size={13} /> Overspending Alerts
                    </div>
                    {budgetRecs.overspendingAlerts.map((alert, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{alert.category}</span>
                          <Badge color="danger">+{fmt(alert.overBy)}</Badge>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>{fmt(alert.spent)} / {fmt(alert.limit)} ({alert.percentage}%)</div>
                      </div>
                    ))}
                  </div>
                )}
                {budgetRecs.recommendations.length > 0 ? (
                  <div>
                    {budgetRecs.recommendations.slice(0, 5).map((rec, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', marginBottom: '8px' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                          background: rec.priority === 'high' ? 'var(--danger-glow)' : rec.priority === 'medium' ? 'var(--warning-glow)' : 'rgba(16,185,129,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          color: rec.priority === 'high' ? 'var(--danger-light)' : rec.priority === 'medium' ? 'var(--warning-light)' : 'var(--success-light)',
                        }}>
                          {recIconMap[rec.type] || <FiZap size={14} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          {rec.title && <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{rec.title}</div>}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{rec.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : budgetRecs.overspendingAlerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                    <Icon path={icons.check} size={28} />
                    <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your budgets are on track! No alerts.</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Set budgets to get recommendations</div>
            )}
          </Card>
        </div>

        {/* AI Financial Insights */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.brain} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>AI Financial Insights</h2>
            </div>
            {healthData?.insights && healthData.insights.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {healthData.insights.map((insight, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)',
                    background: insight.type === 'critical' ? 'var(--danger-glow)' : insight.type === 'good' ? 'rgba(16,185,129,0.1)' : 'var(--warning-glow)',
                    border: `1px solid ${insight.type === 'critical' ? 'rgba(239,68,68,0.2)' : insight.type === 'good' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                      background: insight.type === 'critical' ? 'rgba(239,68,68,0.2)' : insight.type === 'good' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: insight.type === 'critical' ? 'var(--danger-light)' : insight.type === 'good' ? 'var(--success-light)' : 'var(--warning-light)',
                    }}>
                      {insight.type === 'critical' ? <FiAlertOctagon size={13} /> : insight.type === 'good' ? <FiCheckCircle size={13} /> : <FiEye size={13} />}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insight.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Add data to generate AI insights</div>
            )}

            {/* Quick Health Actions */}
            {healthData && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Quick Actions</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Spending Analysis', path: '/spending-pattern-analysis', color: 'var(--accent)' },
                    { label: 'AI Insights', path: '/ai-insights', color: 'var(--purple)' },
                    { label: 'Goal Planning', path: '/financial-goal-planning', color: 'var(--success)' },
                    { label: 'View Detailed Reports', path: '/reports', color: 'var(--warning)' },
                  ].map((action, i) => (
                    <button key={i} onClick={() => navigate(action.path)} style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600,
                      background: 'var(--bg-glass)', border: `1px solid ${action.color}30`,
                      color: action.color, cursor: 'pointer', transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${action.color}15`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; }}
                    >
                      {action.label} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ===== SECTION 5: Notifications + Goal Progress ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Notifications */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.bell} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Active Alerts</h2>
              </div>
              {notifUnread > 0 && <Badge color="danger" dot>{notifUnread} unread</Badge>}
            </div>
            {notifications.length === 0 ? (
              <EmptyState icon={icons.bell} title="No alerts" description="All clear! Notifications will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 400, overflowY: 'auto' }}>
                {notifications.slice(0, 8).map((notif) => {
                  const NotifIcon = notifTypeIcons[notif.type] || icons.bell;
                  const priorityColor = notif.priority === 'critical' ? 'danger' : notif.priority === 'high' ? 'warning' : notif.priority === 'medium' ? 'info' : 'success';
                  return (
                    <div key={notif._id} style={{
                      display: 'flex', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)',
                      background: notif.read ? 'var(--bg-glass)' : getNotifPriorityBg(notif.priority),
                      border: `1px solid ${notif.read ? 'var(--border-light)' : 'var(--border)'}`,
                      transition: 'all var(--transition-fast)',
                      opacity: notif.read ? 0.7 : 1,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                        background: notif.priority === 'critical' ? 'rgba(239,68,68,0.2)' : notif.priority === 'high' ? 'rgba(245,158,11,0.2)' : notif.priority === 'medium' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: notif.priority === 'critical' ? 'var(--danger-light)' : notif.priority === 'high' ? 'var(--warning-light)' : notif.priority === 'medium' ? 'var(--accent-light)' : 'var(--success-light)',
                      }}>
                        <Icon path={NotifIcon} size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.title}</span>
                          <Badge color={priorityColor} style={{ fontSize: '0.65rem', padding: '2px 8px', flexShrink: 0 }}>{notif.priority}</Badge>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{notif.message}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px' }}>{timeAgo(notif.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {notifications.length > 8 && (
              <button onClick={() => navigate('/notifications')} style={{
                display: 'block', width: '100%', marginTop: '12px', padding: '8px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                color: 'var(--accent-light)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-glow)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; }}
              >
                View All Notifications
              </button>
            )}
          </Card>
        </div>

        {/* Goal Progress */}
        <div style={fadeInUp}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.target} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Goal Progress</h2>
              </div>
              <button onClick={() => navigate('/financial-goal-planning')} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600,
                background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.2)',
                color: 'var(--accent-light)', cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-glow)'; }}
              >
                View All
              </button>
            </div>

            {goals.length === 0 ? (
              <EmptyState icon={icons.target} title="No goals yet" description="Create financial goals to track your progress" />
            ) : (
              <>
                {/* Overall Progress */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', padding: '16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                  <ProgressRing percent={overallGoalPct} size={80} strokeWidth={6} color="var(--accent)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Overall Progress</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{fmt(totalSaved)} saved of {fmt(totalTarget)}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>{activeGoals.length} active</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--purple)' }}>{achievedGoals.length} achieved</span>
                      {goals.filter(g => g.status === 'overdue').length > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{goals.filter(g => g.status === 'overdue').length} overdue</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Individual Goals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 320, overflowY: 'auto' }}>
                  {goals.slice(0, 6).map((goal) => {
                    const pct = goal.targetAmount > 0 ? Math.round((goal.savedAmount / goal.targetAmount) * 100) : 0;
                    const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
                    const statusColor = goal.status === 'achieved' ? 'success' : goal.status === 'overdue' ? 'danger' : pct >= 75 ? 'success' : pct >= 40 ? 'info' : 'warning';
                    const goalColor = goal.status === 'achieved' ? 'var(--success)' : goal.status === 'overdue' ? 'var(--danger)' : pct >= 75 ? 'var(--success)' : pct >= 40 ? 'var(--accent)' : 'var(--warning)';

                    return (
                      <div key={goal._id} style={{
                        padding: '12px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                        transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                              background: `${goalColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: goalColor,
                            }}>
                              <Icon path={icons.target} size={13} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{goal.goalName}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{goal.category}</div>
                            </div>
                          </div>
                          <Badge color={statusColor} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                            {goal.status === 'achieved' ? 'Done' : goal.status === 'overdue' ? 'Overdue' : `${pct}%`}
                          </Badge>
                        </div>
                        <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: '6px' }}>
                          <div style={{ height: '100%', borderRadius: 999, width: `${Math.min(pct, 100)}%`, background: goalColor, transition: 'width 0.6s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          <span>{fmt(goal.savedAmount)} saved</span>
                          <span>{remaining > 0 ? `${fmt(remaining)} left` : 'Complete'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ===== SECTION 6: Investment Insights (if available) ===== */}
      {invAnalytics && invAnalytics.typeBreakdown.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* Asset Allocation */}
          <div style={fadeInUp}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.pieChart} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Asset Allocation</h2>
              </div>
              <div style={{ height: 240 }}>
                <Doughnut data={{
                  labels: invAnalytics.typeBreakdown.map(t => t.type),
                  datasets: [{ data: invAnalytics.typeBreakdown.map(t => t.currentValue), backgroundColor: invAnalytics.typeBreakdown.map((t, i) => catColorPalette[i % catColorPalette.length] + 'CC'), borderColor: '#111827', borderWidth: 3, hoverOffset: 6 }],
                }} options={doughnutOptions} />
              </div>
            </Card>
          </div>

          {/* Investment Summary */}
          <div style={fadeInUp}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.investments} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Investment Performance</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'Invested', value: fmt(invAnalytics.summary.totalInvested), color: 'var(--accent)' },
                  { label: 'Current Value', value: fmt(invAnalytics.summary.totalCurrentValue), color: invAnalytics.summary.totalReturns >= 0 ? 'var(--success)' : 'var(--danger)' },
                  { label: 'Profit/Loss', value: `${invAnalytics.summary.totalReturns >= 0 ? '+' : ''}${fmt(invAnalytics.summary.totalReturns)}`, color: invAnalytics.summary.totalReturns >= 0 ? 'var(--success)' : 'var(--danger)' },
                  { label: 'ROI', value: `${invAnalytics.summary.returnPct >= 0 ? '+' : ''}${invAnalytics.summary.returnPct}%`, color: invAnalytics.summary.returnPct >= 0 ? 'var(--success)' : 'var(--danger)' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Top Performers */}
              {portfolioData?.topPerformers?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Top Performers</div>
                  {portfolioData.topPerformers.slice(0, 3).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)' }}>+{p.returnPct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </Layout>
  );
}
