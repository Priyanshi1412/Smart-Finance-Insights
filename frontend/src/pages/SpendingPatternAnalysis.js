import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, expenseAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { fmt } from '../utils/formatters';

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

const CATEGORY_COLORS = {
  Food: '#EF4444',
  Transport: '#3B82F6',
  Shopping: '#8B5CF6',
  'Bills & Utilities': '#F59E0B',
  Entertainment: '#EC4899',
  Healthcare: '#10B981',
  Education: '#6366F1',
  Travel: '#14B8A6',
  Rent: '#F97316',
  Other: '#6B7280',
};

const colorPalette = ['#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#10B981', '#6366F1', '#14B8A6', '#F97316', '#6B7280'];

export default function SpendingPatternAnalysis() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [spending, setSpending] = useState(null);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    let mounted = true;
    const load = async () => {
      try {
        const [spRes, expRes] = await Promise.all([
          analyticsAPI.getSpendingPatterns(),
          expenseAPI.getAll(),
        ]);
        if (mounted) {
          setSpending(spRes.data);
          setExpenses(expRes.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [navigate]);

  const monthlyData12 = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      months.push(`${year}-${String(m + 1).padStart(2, '0')}`);
    }
    const byMonth = {};
    months.forEach(m => { byMonth[m] = 0; });
    expenses.forEach(e => {
      const m = new Date(e.date).toISOString().slice(0, 7);
      if (byMonth[m] !== undefined) byMonth[m] += Number(e.amount || 0);
    });
    return {
      labels: months.map(m => {
        const [y, mo] = m.split('-');
        return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short' });
      }),
      data: months.map(m => byMonth[m]),
    };
  }, [expenses]);

  const dailyThisMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const currentDay = now.getDate();
    const days = [];
    for (let d = 1; d <= currentDay; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(key);
    }
    const byDay = {};
    days.forEach(d => { byDay[d] = 0; });
    expenses.forEach(e => {
      const d = new Date(e.date).toISOString().slice(0, 10);
      if (byDay[d] !== undefined) byDay[d] += Number(e.amount || 0);
    });
    let cumulative = 0;
    const cumData = days.map(d => {
      cumulative += byDay[d];
      return cumulative;
    });
    return {
      labels: days.map(d => {
        const day = parseInt(d.split('-')[2]);
        return day % 5 === 0 || day === 1 || day === currentDay ? `${day}` : '';
      }),
      daily: days.map(d => byDay[d]),
      cumulative: cumData,
      daysInMonth,
    };
  }, [expenses]);

  if (loading) return <Layout title="Spending Pattern Analysis"><LoadingSpinner text="Analyzing your spending patterns..." /></Layout>;

  if (!spending || spending.categorySummary.length === 0) {
    return (
      <Layout title="Spending Pattern Analysis">
        <EmptyState
          icon={icons.barChart}
          title="No spending data yet"
          description="Add some expenses to see your spending pattern analysis"
        />
      </Layout>
    );
  }

  const { categorySummary, monthlyTrend, totalExpenses, totalIncome, avgMonthlySpend, highestCategory, spendingHabits, transactionCount } = spending;

  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
  const expenseToIncome = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

  // Bar chart: Category-wise spending
  const categoryBarData = {
    labels: categorySummary.map(c => c.category),
    datasets: [{
      label: 'Spent',
      data: categorySummary.map(c => c.total),
      backgroundColor: categorySummary.map((c, i) => (CATEGORY_COLORS[c.category] || colorPalette[i % colorPalette.length]) + 'CC'),
      borderColor: categorySummary.map((c, i) => CATEGORY_COLORS[c.category] || colorPalette[i % colorPalette.length]),
      borderWidth: 2,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const categoryBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: { label: (ctx) => `${fmt(ctx.raw)} (${categorySummary[ctx.dataIndex]?.percentage || 0}%)` },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
      y: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 12, weight: 500 } } },
    },
  };

  // Doughnut: Category distribution
  const doughnutData = {
    labels: categorySummary.map(c => c.category),
    datasets: [{
      data: categorySummary.map(c => c.total),
      backgroundColor: categorySummary.map((c, i) => (CATEGORY_COLORS[c.category] || colorPalette[i % colorPalette.length]) + 'CC'),
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} (${categorySummary[ctx.dataIndex]?.percentage || 0}%)` },
      },
    },
  };

  // Line chart: Monthly spending trend (6 months)
  const monthlyLineData = {
    labels: monthlyTrend.map(m => m.label),
    datasets: [{
      label: 'Monthly Spending',
      data: monthlyTrend.map(m => m.total),
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239,68,68,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 5,
      pointBackgroundColor: '#EF4444',
      pointBorderColor: '#111827',
      pointBorderWidth: 2,
    }],
  };

  const monthlyLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: { label: (ctx) => `Spent: ${fmt(ctx.raw)}` },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  // Bar chart: 12-month spending
  const yearlyBarData = {
    labels: monthlyData12.labels,
    datasets: [{
      label: 'Spending',
      data: monthlyData12.data,
      backgroundColor: monthlyData12.data.map((v, i) => {
        const currentMonth = new Date().getMonth();
        return i === currentMonth ? 'rgba(239,68,68,0.9)' : i < currentMonth ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.15)';
      }),
      borderColor: monthlyData12.data.map((v, i) => {
        const currentMonth = new Date().getMonth();
        return i === currentMonth ? '#EF4444' : i < currentMonth ? '#F87171' : '#FCA5A5';
      }),
      borderWidth: 2,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const yearlyBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: { label: (ctx) => `Spent: ${fmt(ctx.raw)}` },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  // Line chart: Daily spending this month
  const dailyLineData = {
    labels: dailyThisMonth.labels,
    datasets: [
      {
        label: 'Daily Spend',
        data: dailyThisMonth.daily,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245,158,11,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: '#F59E0B',
      },
      {
        label: 'Cumulative',
        data: dailyThisMonth.cumulative,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239,68,68,0.05)',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderDash: [5, 5],
      },
    ],
  };

  const dailyLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 } } },
      y: { grid: { color: 'rgba(51,65,85,0.2)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 }, callback: (v) => `₹${v}` } },
    },
  };

  const maxSpendingMonth = monthlyTrend.reduce((max, m) => m.total > max.total ? m : max, monthlyTrend[0]);
  const minSpendingMonth = monthlyTrend.reduce((min, m) => m.total < min.total ? m : min, monthlyTrend[0]);

  return (
    <Layout title="Spending Pattern Analysis">
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Spent', value: fmt(totalExpenses), icon: icons.expenses, color: 'var(--danger-light)', bg: 'rgba(239,68,68,0.12)' },
          { label: 'Avg Monthly', value: fmt(avgMonthlySpend), icon: icons.clock, color: 'var(--warning-light)', bg: 'rgba(245,158,11,0.12)' },
          { label: 'Transactions', value: transactionCount, icon: icons.activity, color: 'var(--accent-light)', bg: 'rgba(59,130,246,0.12)' },
          { label: 'Savings Rate', value: `${savingsRate}%`, icon: icons.piggyBank, color: savingsRate >= 20 ? 'var(--success-light)' : 'var(--danger-light)', bg: savingsRate >= 20 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' },
          { label: 'Expense/Income', value: `${expenseToIncome}%`, icon: icons.trendingDown, color: expenseToIncome <= 80 ? 'var(--success-light)' : 'var(--danger-light)', bg: expenseToIncome <= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' },
        ].map((s, i) => (
          <Card key={i} style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -6, right: -6, opacity: 0.06 }}>
              <Icon path={s.icon} size={56} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={s.icon} size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Spending Habits Alerts */}
      {spendingHabits.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {spendingHabits.map((habit, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px',
              borderRadius: 'var(--radius-lg)',
              background: habit.type === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${habit.type === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                background: habit.type === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
              }}>
                <Icon path={icons.alertCircle} size={14} />
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{habit.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row 1: Category Bar + Category Doughnut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Category-wise Spending</h2>
          </div>
          <div style={{ height: 300 }}>
            <Bar data={categoryBarData} options={categoryBarOptions} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Spending Distribution</h2>
          </div>
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
            {categorySummary.slice(0, 6).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[c.category] || colorPalette[i % colorPalette.length] }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.category} ({c.percentage}%)</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts Row 2: 12-Month Bar + Monthly Trend Line */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>12-Month Spending Overview</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Jan - Dec {new Date().getFullYear()}</p>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Bar data={yearlyBarData} options={yearlyBarOptions} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.trendingUp} size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>6-Month Spending Trend</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Highest: {maxSpendingMonth.label} ({fmt(maxSpendingMonth.total)}) &bull; Lowest: {minSpendingMonth.label} ({fmt(minSpendingMonth.total)})
              </p>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Line data={monthlyLineData} options={monthlyLineOptions} />
          </div>
        </Card>
      </div>

      {/* Charts Row 3: Daily Spending + Category Detail Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.activity} size={18} />
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Daily Spending - This Month</h2>
          </div>
          <div style={{ height: 280 }}>
            <Line data={dailyLineData} options={dailyLineOptions} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.target} size={18} />
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Top Categories</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categorySummary.slice(0, 5).map((cat, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[cat.category] || colorPalette[i % colorPalette.length] }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cat.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(cat.total)}</span>
                    <Badge color={cat.percentage > 25 ? 'danger' : cat.percentage > 15 ? 'warning' : 'info'}>{cat.percentage}%</Badge>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999, width: `${cat.percentage}%`,
                    background: CATEGORY_COLORS[cat.category] || colorPalette[i % colorPalette.length],
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>{cat.count} transactions</span>
                  <span>Avg {fmt(cat.avgPerTransaction)}/tx</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Full Category Breakdown Table */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.reports} size={18} />
          </div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Complete Category Breakdown</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Category', 'Total Spent', '% of Total', 'Transactions', 'Avg / Transaction', 'Daily Avg (30d)'].map(h => (
                  <th key={h} style={{
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categorySummary.map((cat, i) => (
                <tr key={i} style={{ transition: 'background var(--transition-fast)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[cat.category] || colorPalette[i % colorPalette.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cat.category}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>{fmt(cat.total)}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <Badge color={cat.percentage > 25 ? 'danger' : cat.percentage > 15 ? 'warning' : 'info'}>{cat.percentage}%</Badge>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>{cat.count}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>{fmt(cat.avgPerTransaction)}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>{fmt(Math.round(cat.total / 30))}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: 'var(--bg-glass)' }}>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Total</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--danger-light)' }}>{fmt(totalExpenses)}</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>100%</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{transactionCount}</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(Math.round(totalExpenses / Math.max(transactionCount, 1)))}</td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(Math.round(totalExpenses / 30))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Monthly Comparison Table */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.clock} size={18} />
          </div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Monthly Spending Comparison</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Month', 'Total Spent', 'vs Previous', 'Top Category', 'Daily Avg'].map(h => (
                  <th key={h} style={{
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyTrend.map((month, i) => {
                const prev = i > 0 ? monthlyTrend[i - 1].total : 0;
                const diff = prev > 0 ? Math.round(((month.total - prev) / prev) * 100) : null;
                const topCat = month.categories ? Object.entries(month.categories).sort((a, b) => b[1] - a[1])[0] : null;
                const daysInMonth = new Date(2026, monthlyTrend.indexOf(month) + 1, 0).getDate();
                return (
                  <tr key={i} style={{ transition: 'background var(--transition-fast)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {month.label}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger-light)' }}>
                      {fmt(month.total)}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                      {diff !== null ? (
                        <Badge color={diff > 0 ? 'danger' : diff < 0 ? 'success' : 'info'}>
                          {diff > 0 ? '+' : ''}{diff}%
                        </Badge>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {topCat ? `${topCat[0]} (${fmt(topCat[1])})` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {fmt(Math.round(month.total / daysInMonth))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
}
