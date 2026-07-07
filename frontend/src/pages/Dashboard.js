import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, incomeAPI, expenseAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
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

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
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
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Income',
        data: monthlyData.income,
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
        data: monthlyData.expenses,
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
    </Layout>
  );
}
