import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, expenseAPI, incomeAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, RadialLinearScale, Filler,
} from 'chart.js';
import { Bar, Doughnut, PolarArea } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, RadialLinearScale, Filler,
);

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);

const palette = ['#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B', '#14B8A6', '#EC4899', '#6366F1', '#10B981', '#F97316', '#06B6D4'];

export default function Reports() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/login'); return; }
    (async () => {
      try {
        const [sRes, eRes, iRes] = await Promise.all([
          dashboardAPI.getSummary(),
          expenseAPI.getAll(),
          incomeAPI.getAll(),
        ]);
        setSummary(sRes.data);
        setExpenses(eRes.data || []);
        setIncomes(iRes.data || []);
      } catch { }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount || 0); });
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
      savings: months.map(m => incByMonth[m] - expByMonth[m]),
    };
  }, [incomes, expenses]);

  const savingsRate = summary?.totalIncome > 0 ? ((summary.savings / summary.totalIncome) * 100).toFixed(1) : 0;
  const expenseRatio = summary?.totalIncome > 0 ? ((summary.totalExpenses / summary.totalIncome) * 100).toFixed(1) : 0;

  const metrics = [
    { label: 'Income', value: fmt(summary?.totalIncome), icon: icons.trendingUp, color: 'var(--success-light)', bg: 'var(--success-glow)' },
    { label: 'Expenses', value: fmt(summary?.totalExpenses), icon: icons.trendingDown, color: 'var(--danger-light)', bg: 'var(--danger-glow)' },
    { label: 'Savings Rate', value: `${savingsRate}%`, icon: icons.piggyBank, color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
    { label: 'Expense Ratio', value: `${expenseRatio}%`, icon: icons.pieChart, color: 'var(--warning-light)', bg: 'var(--warning-glow)' },
  ];

  const catLabels = Object.keys(expenseByCategory);
  const catValues = Object.values(expenseByCategory);

  const doughnutData = {
    labels: catLabels.length > 0 ? catLabels : ['No Data'],
    datasets: [{
      data: catValues.length > 0 ? catValues : [1],
      backgroundColor: catLabels.length > 0 ? palette.slice(0, catLabels.length) : ['#334155'],
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'right', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } },
    },
  };

  const monthlyBarData = {
    labels: monthlyData.labels,
    datasets: [
      { label: 'Income', data: monthlyData.income, backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10B981', borderWidth: 2, borderRadius: 6, borderSkipped: false },
      { label: 'Expenses', data: monthlyData.expenses, backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#EF4444', borderWidth: 2, borderRadius: 6, borderSkipped: false },
      { label: 'Savings', data: monthlyData.savings, backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3B82F6', borderWidth: 2, borderRadius: 6, borderSkipped: false },
    ],
  };

  const monthlyBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 } } },
      y: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  const polarData = {
    labels: catLabels.length > 0 ? catLabels : ['No Data'],
    datasets: [{
      data: catValues.length > 0 ? catValues : [1],
      backgroundColor: catLabels.length > 0 ? palette.slice(0, catLabels.length).map(c => c + 'CC') : ['#334155CC'],
      borderColor: '#111827',
      borderWidth: 2,
    }],
  };

  const polarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 10, font: { size: 10 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } },
    },
    scales: {
      r: { grid: { color: 'rgba(51,65,85,0.3)' }, ticks: { display: false }, pointLabels: { color: '#94A3B8', font: { size: 10 } } },
    },
  };

  return (
    <Layout title="Reports">
      {loading ? <LoadingSpinner text="Generating reports..." /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            {metrics.map((m, i) => (
              <Card key={i} hoverable>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon path={m.icon} size={20} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: m.color }}>{m.value}</div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.barChart} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Monthly Comparison</h2>
              </div>
              <div style={{ height: 280 }}>
                <Bar data={monthlyBarData} options={monthlyBarOptions} />
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.pieChart} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Expense by Category</h2>
              </div>
              <div style={{ height: 280 }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.activity} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Spending Distribution</h2>
              </div>
              <div style={{ height: 280 }}>
                <PolarArea data={polarData} options={polarOptions} />
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.target} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Key Insights</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { text: 'Net savings', value: fmt(summary?.savings), color: summary?.savings >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
                  { text: 'Budget utilization', value: `${Math.round(summary?.budget?.percentUsed || 0)}%`, color: 'var(--warning-light)' },
                  { text: 'Budget status', value: summary?.budget?.status || 'N/A', color: 'var(--accent-light)' },
                  { text: 'Income sources', value: `${incomes.length} records`, color: 'var(--teal-light)' },
                  { text: 'Expense categories', value: `${catLabels.length} categories`, color: 'var(--purple-light)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.text}</span>
                    <span style={{ fontWeight: 700, color: item.color, fontSize: '0.85rem' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </Layout>
  );
}
