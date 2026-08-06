import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, investmentAPI, portfolioAPI, goalAPI, analyticsAPI, notificationAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard, SkeletonChart, SkeletonTransactionList } from '../components/ui/Skeleton';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import { fmt, fmtRelativeTime, fmtTrend } from '../utils/formatters';
import { useCurrency } from '../context/CurrencyContext';

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
  green: '#10B981', greenLight: '#34D399',
  red: '#EF4444', redLight: '#F87171',
  blue: '#3B82F6', blueLight: '#60A5FA',
  purple: '#8B5CF6', purpleLight: '#A78BFA',
  amber: '#F59E0B', amberLight: '#FBBF24',
  teal: '#14B8A6', tealLight: '#2DD4BF',
  pink: '#EC4899', indigo: '#6366F1',
};

const categoryPalette = [
  chartColors.blue, chartColors.red, chartColors.purple, chartColors.amber,
  chartColors.teal, chartColors.pink, chartColors.indigo, chartColors.green,
];

const SummaryCard = ({ label, value, trend, trendValue, icon, gradient, color, children }) => {
  const trendInfo = fmtTrend(trendValue);
  return (
    <Card hoverable style={{ background: gradient, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.07 }}>
        <Icon path={icon} size={80} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
        {trendValue !== undefined && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            padding: '3px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
            background: trendInfo.direction === 'up' ? 'rgba(16,185,129,0.12)' : trendInfo.direction === 'down' ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)',
            color: trendInfo.direction === 'up' ? 'var(--success-light)' : trendInfo.direction === 'down' ? 'var(--danger-light)' : 'var(--text-muted)',
          }}>
            <span style={{ fontSize: '0.65rem' }}>{trendInfo.direction === 'up' ? '\u2191' : trendInfo.direction === 'down' ? '\u2193' : '\u2192'}</span>
            {trendInfo.text}
          </span>
        )}
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color, lineHeight: 1.2 }}>
        {value}
      </div>
      {trend && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{trend}</div>}
      {children}
    </Card>
  );
};

const ChartCard = ({ title, iconPath, iconBg, children, action }) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 'var(--radius-md)',
          background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon path={iconPath} size={17} />
        </div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </Card>
);

const TransactionRow = memo(({ tx }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 14px', borderRadius: 'var(--radius-md)',
    background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
    transition: 'all var(--transition-fast)',
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-glow)'; }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 'var(--radius-sm)', flexShrink: 0,
        background: tx.type === 'income' ? 'var(--success-glow)' : 'var(--danger-glow)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon path={tx.type === 'income' ? icons.trendingUp : icons.trendingDown} size={15} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tx.name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.category}</div>
      </div>
    </div>
    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
      <div style={{
        fontWeight: 700, fontSize: '0.85rem',
        color: tx.type === 'income' ? 'var(--success-light)' : 'var(--danger-light)',
      }}>
        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtRelativeTime(tx.date)}</div>
    </div>
  </div>
));
TransactionRow.displayName = 'TransactionRow';

function getBaseChartOptions(currency) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw, currency)}` },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => fmt(v, currency) } },
    },
  };
}

function getDoughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: { animateRotate: true, duration: 800 },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 10, font: { size: 10 }, boxWidth: 8 } },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` },
      },
    },
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [invAnalytics, setInvAnalytics] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [budgetRecommendations, setBudgetRecommendations] = useState(null);
  const [financialHealthData, setFinancialHealthData] = useState(null);

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    try {
      const overviewRes = await dashboardAPI.getOverview();
      setOverview(overviewRes.data);
      setError(null);
    } catch (err) {
      console.error('Dashboard overview error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }

    try {
      const [invRes, portRes, goalRes] = await Promise.allSettled([
        investmentAPI.getAnalytics(),
        portfolioAPI.getAnalytics(),
        goalAPI.getAll(),
      ]);
      if (invRes.status === 'fulfilled') setInvAnalytics(invRes.value.data);
      if (portRes.status === 'fulfilled') setPortfolioData(portRes.value.data);
      if (goalRes.status === 'fulfilled') setGoals(goalRes.value.data || []);
    } catch {}

    try {
      const [brRes, fhRes] = await Promise.allSettled([
        analyticsAPI.getBudgetRecommendations(),
        analyticsAPI.getFinancialHealth(),
      ]);
      if (brRes.status === 'fulfilled') setBudgetRecommendations(brRes.value.data);
      if (fhRes.status === 'fulfilled') setFinancialHealthData(fhRes.value.data);
    } catch {}

    try { await notificationAPI.generate(); } catch {}
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => { if (mounted) loadDashboard(); }, 30000);
    const handleFocus = () => { if (mounted) loadDashboard(); };
    const handleImport = () => { if (mounted) loadDashboard(); };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('sfi-data-imported', handleImport);
    loadDashboard();
    return () => { mounted = false; clearInterval(interval); window.removeEventListener('focus', handleFocus); window.removeEventListener('sfi-data-imported', handleImport); };
  }, [loadDashboard]);

  const barChartData = useMemo(() => {
    if (!overview?.sixMonthData) return null;
    return {
      labels: overview.sixMonthData.map(d => d.label),
      datasets: [
        {
          label: 'Income',
          data: overview.sixMonthData.map(d => d.income),
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          borderColor: chartColors.green,
          borderWidth: 2, borderRadius: 6, borderSkipped: false,
        },
        {
          label: 'Expenses',
          data: overview.sixMonthData.map(d => d.expenses),
          backgroundColor: 'rgba(239, 68, 68, 0.65)',
          borderColor: chartColors.red,
          borderWidth: 2, borderRadius: 6, borderSkipped: false,
        },
      ],
    };
  }, [overview]);

  const barChartOptions = useMemo(() => getBaseChartOptions(currency), [currency]);

  const doughnutData = useMemo(() => {
    const cats = overview?.categoryBreakdown || [];
    if (cats.length === 0) {
      return { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#334155'], borderColor: '#111827', borderWidth: 3, hoverOffset: 6 }] };
    }
    return {
      labels: cats.map(c => c.category),
      datasets: [{
        data: cats.map(c => c.amount),
        backgroundColor: cats.map((_, i) => categoryPalette[i % categoryPalette.length] + 'CC'),
        borderColor: '#111827', borderWidth: 3, hoverOffset: 6,
      }],
    };
  }, [overview]);

  const doughnutOptions = useMemo(() => getDoughnutOptions(), []);

  const lineChartData = useMemo(() => {
    if (!overview?.sixMonthData) return null;
    return {
      labels: overview.sixMonthData.map(d => d.label),
      datasets: [
        {
          label: 'Income',
          data: overview.sixMonthData.map(d => d.income),
          borderColor: chartColors.green,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true, tension: 0.4, pointRadius: 4,
          pointBackgroundColor: chartColors.green, pointBorderColor: '#111827', pointBorderWidth: 2,
        },
        {
          label: 'Expenses',
          data: overview.sixMonthData.map(d => d.expenses),
          borderColor: chartColors.red,
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          fill: true, tension: 0.4, pointRadius: 4,
          pointBackgroundColor: chartColors.red, pointBorderColor: '#111827', pointBorderWidth: 2,
        },
      ],
    };
  }, [overview]);

  const lineChartOptions = useMemo(() => getBaseChartOptions(currency), [currency]);

  const summary = overview?.summary;
  const budgetColor = summary?.budget?.status === 'Exceeded' ? 'danger' : summary?.budget?.status === 'Near Limit' ? 'warning' : 'success';

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height={115} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <SkeletonChart height={240} />
          <SkeletonChart height={240} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
          <SkeletonChart height={240} />
          <SkeletonTransactionList items={5} />
        </div>
      </Layout>
    );
  }

  if (error && !overview) {
    return (
      <Layout title="Dashboard">
        <EmptyState
          icon={icons.alertTriangle}
          title="Unable to load dashboard"
          description={error}
          action={
            <button onClick={loadDashboard} style={{
              padding: '10px 24px', borderRadius: 'var(--radius-md)',
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
            }}>Retry</button>
          }
        />
      </Layout>
    );
  }

  const summaryCards = summary ? [
    { label: 'Total Income', value: fmt(summary.totalIncome, currency), trendValue: summary.incomeChange, icon: icons.trendingUp, gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))', color: 'var(--success-light)' },
    { label: 'Total Expenses', value: fmt(summary.totalExpenses, currency), trendValue: summary.expenseChange, icon: icons.trendingDown, gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))', color: 'var(--danger-light)' },
    { label: 'Net Savings', value: fmt(summary.savings, currency), trend: `${summary.savingsRate}% savings rate`, icon: icons.piggyBank, gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))', color: 'var(--accent-light)' },
    { label: 'Savings Rate', value: `${summary.savingsRate}%`, trend: summary.savingsRate >= 20 ? 'Healthy' : summary.savingsRate >= 10 ? 'Moderate' : 'Low', icon: icons.target, gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', color: 'var(--warning-light)' },
    { label: 'Budget Status', value: summary.budget.status, trend: `${Math.round(summary.budget.percentUsed)}% used`, icon: icons.shield, gradient: 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(20,184,166,0.04))', color: 'var(--teal-light)' },

  ] : [];

  return (
    <Layout title="Dashboard">
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {summaryCards.map((card, i) => (
          <SummaryCard key={i} {...card}>
            {card.label === 'Budget Status' && (
              <div style={{ marginTop: '10px', height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${Math.min(summary.budget.percentUsed, 100)}%`,
                  background: budgetColor === 'danger' ? 'var(--danger)' : budgetColor === 'warning' ? 'var(--warning)' : 'var(--success)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            )}
          </SummaryCard>
        ))}
      </div>

      {/* Charts + Transactions Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <WidgetErrorBoundary name="Income vs Expenses">
          <ChartCard title="Income vs Expenses" iconPath={icons.barChart} iconBg="var(--accent-glow)">
            <div style={{ height: 250 }}>
              {barChartData ? <Bar data={barChartData} options={barChartOptions} /> : <EmptyState icon={icons.barChart} title="No data yet" description="Add income and expenses to see comparison" />}
            </div>
          </ChartCard>
        </WidgetErrorBoundary>

        <WidgetErrorBoundary name="Expense Breakdown">
          <ChartCard title="Expense Breakdown" iconPath={icons.pieChart} iconBg="var(--purple-glow)">
            <div style={{ height: 250 }}>
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </ChartCard>
        </WidgetErrorBoundary>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <WidgetErrorBoundary name="6-Month Trend">
          <ChartCard title="6-Month Trend" iconPath={icons.activity} iconBg="var(--success-glow)">
            <div style={{ height: 250 }}>
              {lineChartData ? <Line data={lineChartData} options={lineChartOptions} /> : <EmptyState icon={icons.activity} title="No trend data" description="Data will appear after a few months" />}
            </div>
          </ChartCard>
        </WidgetErrorBoundary>

        <WidgetErrorBoundary name="Recent Transactions">
          <ChartCard
            title="Recent Transactions"
            iconPath={icons.clock}
            iconBg="var(--purple-glow)"
            action={
              <button onClick={() => navigate('/income')} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600,
                background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.2)',
                color: 'var(--accent-light)', cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}>View All</button>
            }
          >
            {!overview?.transactions || overview.transactions.length === 0 ? (
              <EmptyState icon={icons.wallet} title="No transactions yet" description="Add income or expenses to see them here" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {overview.transactions.map((tx) => (
                  <TransactionRow key={tx._id} tx={tx} />
                ))}
              </div>
            )}
          </ChartCard>
        </WidgetErrorBoundary>
      </div>

      {/* Investment Summary */}
      {invAnalytics && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Total Investment', value: fmt(invAnalytics.summary.totalInvested, currency), icon: icons.investments, gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', color: 'var(--purple-light)' },
              { label: 'Portfolio Value', value: fmt(invAnalytics.summary.totalCurrentValue, currency), icon: icons.trendingUp, gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))', color: 'var(--success-light)' },
              { label: 'Profit / Loss', value: `${invAnalytics.summary.totalReturns >= 0 ? '+' : ''}${fmt(invAnalytics.summary.totalReturns, currency)}`, icon: icons.activity, gradient: `linear-gradient(135deg, rgba(${invAnalytics.summary.totalReturns >= 0 ? '16,185,129' : '239,68,68'},0.12), rgba(${invAnalytics.summary.totalReturns >= 0 ? '16,185,129' : '239,68,68'},0.04))`, color: invAnalytics.summary.totalReturns >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
              { label: 'Overall ROI', value: `${invAnalytics.summary.returnPct >= 0 ? '+' : ''}${invAnalytics.summary.returnPct}%`, icon: icons.target, gradient: `linear-gradient(135deg, rgba(${invAnalytics.summary.returnPct >= 0 ? '16,185,129' : '239,68,68'},0.12), rgba(${invAnalytics.summary.returnPct >= 0 ? '16,185,129' : '239,68,68'},0.04))`, color: invAnalytics.summary.returnPct >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
            ].map((card, i) => (
              <SummaryCard key={i} {...card} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <WidgetErrorBoundary name="Portfolio Growth">
              <ChartCard title="Portfolio Growth" iconPath={icons.trendingUp} iconBg="var(--success-glow)">
                {portfolioData?.monthlyGrowth?.length > 0 ? (
                  <div style={{ height: 250 }}>
                    <Line data={{
                      labels: portfolioData.monthlyGrowth.map(d => d.month),
                      datasets: [
                        { label: 'Invested', data: portfolioData.monthlyGrowth.map(d => d.invested), borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#8B5CF6', pointBorderColor: '#111827', pointBorderWidth: 2 },
                        { label: 'Current Value', data: portfolioData.monthlyGrowth.map(d => d.value), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#10B981', pointBorderColor: '#111827', pointBorderWidth: 2 },
                      ],
                    }} options={lineChartOptions} />
                  </div>
                ) : (
                  <EmptyState icon={icons.trendingUp} title="No portfolio data yet" description="Start investing to track your growth" />
                )}
              </ChartCard>
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Asset Allocation">
              <ChartCard title="Asset Allocation" iconPath={icons.pieChart} iconBg="var(--purple-glow)">
                {invAnalytics.typeBreakdown?.length > 0 ? (
                  <div style={{ height: 250 }}>
                    <Doughnut data={{
                      labels: invAnalytics.typeBreakdown.map(t => t.type),
                      datasets: [{ data: invAnalytics.typeBreakdown.map(t => t.currentValue), backgroundColor: invAnalytics.typeBreakdown.map((_, i) => categoryPalette[i % categoryPalette.length] + 'CC'), borderColor: '#111827', borderWidth: 3, hoverOffset: 6 }],
                    }} options={doughnutOptions} />
                  </div>
                ) : (
                  <EmptyState icon={icons.pieChart} title="No investments yet" description="Add investments to see allocation" />
                )}
              </ChartCard>
            </WidgetErrorBoundary>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <WidgetErrorBoundary name="Top Performing Assets">
              <ChartCard title="Top Performing Assets" iconPath={icons.trendingUp} iconBg="var(--success-glow)">
                {(!portfolioData?.topPerformers || portfolioData.topPerformers.length === 0) ? (
                  <EmptyState icon={icons.trendingUp} title="No profitable investments yet" description="Your top performers will appear here" />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['#', 'Name', 'Type', 'Invested', 'Current', 'ROI'].map(h => (
                            <th key={h} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioData.topPerformers.map((p, i) => (
                          <tr key={i} style={{ transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{i + 1}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{p.name}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{p.type}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.amount, currency)}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.currentValue, currency)}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600, padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>+{p.returnPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Worst Performing Assets">
              <ChartCard title="Worst Performing Assets" iconPath={icons.trendingDown} iconBg="var(--danger-glow)">
                {(!portfolioData?.lowestPerformers || portfolioData.lowestPerformers.length === 0) ? (
                  <EmptyState icon={icons.trendingDown} title="No loss-making investments" description="Your worst performers will appear here" />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['#', 'Name', 'Type', 'Invested', 'Current', 'ROI'].map(h => (
                            <th key={h} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioData.lowestPerformers.map((p, i) => (
                          <tr key={i} style={{ transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{i + 1}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{p.name}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{p.type}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.amount, currency)}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{fmt(p.currentValue, currency)}</td>
                            <td style={{ fontSize: '0.82rem', color: p.returnPct >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600, padding: '9px 10px', borderBottom: '1px solid var(--border-light)' }}>{p.returnPct >= 0 ? '+' : ''}{p.returnPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>
            </WidgetErrorBoundary>
          </div>

          {/* Goal Planning + Risk Analysis */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <WidgetErrorBoundary name="Goal Planning">
              <ChartCard
                title="Goal Planning Summary"
                iconPath={icons.target}
                iconBg="var(--accent-glow)"
                action={
                  <button onClick={() => navigate('/financial-goal-planning')} style={{
                    padding: '5px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600,
                    background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.2)',
                    color: 'var(--accent-light)', cursor: 'pointer', transition: 'all var(--transition-fast)',
                  }}>View All</button>
                }
              >
                {goals.length === 0 ? (
                  <EmptyState icon={icons.target} title="No goals created yet" description="Set financial goals to track your progress" />
                ) : (() => {
                  const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
                  const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
                  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
                  const active = goals.filter(g => g.status === 'active').length;
                  const completed = goals.filter(g => g.status === 'achieved').length;
                  const overdue = goals.filter(g => g.status === 'overdue').length;
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
                        {[
                          { label: 'Overall', value: `${overallPct}%`, color: 'var(--accent)' },
                          { label: 'Active', value: active, color: 'var(--success)' },
                          { label: 'Completed', value: completed, color: 'var(--purple)' },
                          { label: 'Overdue', value: overdue, color: overdue > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                        ].map((item, i) => (
                          <div key={i} style={{ padding: '8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: '8px' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${overallPct}%`, background: 'var(--accent)', transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>{fmt(totalSaved, currency)} saved of {fmt(totalTarget, currency)}</span>
                        <span>{goals.length} total goals</span>
                      </div>
                    </>
                  );
                })()}
              </ChartCard>
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Risk Analysis">
              <ChartCard title="Risk Analysis" iconPath={icons.shield} iconBg="var(--warning-glow)">
                {portfolioData?.risk ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
                      <div style={{ position: 'relative', width: 85, height: 85, flexShrink: 0 }}>
                        <svg width={85} height={85} style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx={42.5} cy={42.5} r={36} fill="none" stroke="var(--border)" strokeWidth={7} />
                          <circle cx={42.5} cy={42.5} r={36} fill="none"
                            stroke={portfolioData.risk.score >= 70 ? 'var(--success)' : portfolioData.risk.score >= 40 ? 'var(--warning)' : 'var(--danger)'}
                            strokeWidth={7} strokeDasharray={2 * Math.PI * 36}
                            strokeDashoffset={2 * Math.PI * 36 * (1 - Math.min(portfolioData.risk.score, 100) / 100)}
                            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {portfolioData.risk.score}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Risk Score</div>
                        <Badge color={portfolioData.risk.score >= 70 ? 'success' : portfolioData.risk.score >= 40 ? 'warning' : 'danger'} dot>{portfolioData.risk.label}</Badge>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ padding: '10px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>Asset Classes</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{portfolioData.risk.numTypes}</div>
                      </div>
                      <div style={{ padding: '10px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>Max Allocation</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: portfolioData.risk.maxAllocation > 60 ? 'var(--danger)' : 'var(--text-primary)' }}>{portfolioData.risk.maxAllocation}%</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState icon={icons.shield} title="No risk data" description="Add investments to see risk analysis" />
                )}
              </ChartCard>
            </WidgetErrorBoundary>
          </div>
        </>
      )}

      {/* Budget Recommendations + Financial Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <WidgetErrorBoundary name="Budget Recommendations">
          <ChartCard title="Budget Recommendations" iconPath={icons.send} iconBg="var(--accent-glow)">
            {budgetRecommendations ? (
              <>
                {budgetRecommendations.overspendingAlerts?.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    {budgetRecommendations.overspendingAlerts.slice(0, 2).map((alert, i) => (
                      <div key={i} style={{
                        padding: '9px 12px', borderRadius: 'var(--radius-md)',
                        background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.15)',
                        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i === 0 ? '6px' : 0,
                      }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Icon path={icons.alertCircle} size={12} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{alert.category}</span>
                            <Badge color="danger" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>+{fmt(alert.overBy, currency)}</Badge>
                          </div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '1px' }}>{alert.percentage}% of budget used</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {budgetRecommendations.recommendations?.length > 0 && (
                  <div>
                    {budgetRecommendations.recommendations.slice(0, 2).map((rec, i) => {
                      const prioColor = rec.priority === 'high' ? 'var(--danger-light)' : rec.priority === 'medium' ? 'var(--warning-light)' : 'var(--success-light)';
                      const prioBg = rec.priority === 'high' ? 'var(--danger-glow)' : rec.priority === 'medium' ? 'var(--warning-glow)' : 'rgba(16,185,129,0.1)';
                      return (
                        <div key={i} style={{
                          display: 'flex', gap: '10px', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                          marginBottom: i === 0 ? '6px' : 0, transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-glow)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; }}
                        >
                          <div style={{
                            width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: prioBg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: prioColor, fontSize: '0.7rem',
                          }}>
                            <Icon path={icons.target} size={11} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{rec.title || rec.message}</div>
                            {rec.suggestedBudget && (
                              <div style={{ fontSize: '0.64rem', color: 'var(--accent-light)', marginTop: '2px' }}>Suggested: {fmt(rec.suggestedBudget, currency)}/mo</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(!budgetRecommendations.recommendations || budgetRecommendations.recommendations.length === 0) &&
                 (!budgetRecommendations.overspendingAlerts || budgetRecommendations.overspendingAlerts.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <Icon path={icons.check} size={24} />
                    <div style={{ marginTop: '8px' }}>Your budgets look good!</div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon={icons.send} title="Set budgets to get recommendations" description="Create budget limits to receive smart suggestions" />
            )}
          </ChartCard>
        </WidgetErrorBoundary>

        <WidgetErrorBoundary name="Financial Health">
          <ChartCard title="Financial Health Score" iconPath={icons.shield} iconBg="var(--success-glow)">
            {financialHealthData ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '14px' }}>
                  <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
                    <svg width={78} height={78} style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx={39} cy={39} r={32} fill="none" stroke="var(--border)" strokeWidth={6} />
                      <circle cx={39} cy={39} r={32} fill="none"
                        stroke={financialHealthData.score >= 80 ? 'var(--success)' : financialHealthData.score >= 60 ? 'var(--accent)' : financialHealthData.score >= 40 ? 'var(--warning)' : 'var(--danger)'}
                        strokeWidth={6} strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - Math.min(financialHealthData.score, 100) / 100)}
                        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{financialHealthData.score}</div>
                      <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>/100</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Badge color={financialHealthData.status === 'Excellent' ? 'success' : financialHealthData.status === 'Good' ? 'info' : financialHealthData.status === 'Fair' ? 'warning' : 'danger'} dot>{financialHealthData.status}</Badge>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.4 }}>
                      {financialHealthData.status === 'Excellent' ? 'Your finances are in great shape.' :
                       financialHealthData.status === 'Good' ? 'Solid foundation — a few tweaks could make it excellent.' :
                       financialHealthData.status === 'Fair' ? 'Some areas need attention.' :
                       'Your finances need urgent attention.'}
                    </div>
                  </div>
                </div>
                {financialHealthData.indicators && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto' }}>
                    <div style={{ padding: '9px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: financialHealthData.indicators.savingsRate >= 20 ? 'var(--success)' : 'var(--warning)' }}>
                        {financialHealthData.indicators.savingsRate}%
                      </div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Savings Rate</div>
                    </div>
                    <div style={{ padding: '9px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: financialHealthData.indicators.expenseRatio < 70 ? 'var(--success)' : 'var(--danger)' }}>
                        {financialHealthData.indicators.expenseRatio}%
                      </div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Expense Ratio</div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon={icons.shield} title="Add financial data to see your health score" description="Track income and expenses to calculate your score" />
            )}
          </ChartCard>
        </WidgetErrorBoundary>
      </div>
    </Layout>
  );
}
