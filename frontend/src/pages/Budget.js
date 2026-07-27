import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetAPI, expenseAPI } from '../services/api';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);
const categories = ['Food', 'Transport', 'Shopping', 'Bills & Utilities', 'Entertainment', 'Healthcare', 'Education', 'Travel', 'Rent', 'Other'];

export default function Budget() {
  const navigate = useNavigate();
  const { refreshHealth } = useFinancialHealth();
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ category: 'Food', limit: '', month: new Date().toISOString().slice(0, 7) });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/login'); return; }
    load();
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, eRes] = await Promise.all([budgetAPI.getAll(), expenseAPI.getAll()]);
      setBudgets(bRes.data || []);
      setExpenses(eRes.data || []);
    } catch { setError('Failed to load budget data'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.limit || Number(form.limit) <= 0) { setError('Enter a valid limit'); return; }
    try {
      await budgetAPI.create({ ...form, limit: Number(form.limit) });
      setSuccess('Budget set');
      setForm({ ...form, limit: '' });
      load();
      refreshHealth();
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
  };

  const getSpent = (cat, month) => {
    return expenses
      .filter(e => e.category === cat && new Date(e.date).toISOString().slice(0, 7) === month)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
  };

  const chartData = useMemo(() => {
    const filteredBudgets = budgets.filter(b => b.month === form.month);
    if (filteredBudgets.length === 0) return null;
    return {
      labels: filteredBudgets.map(b => b.category),
      datasets: [
        {
          label: 'Budget',
          data: filteredBudgets.map(b => b.limit),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3B82F6',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Spent',
          data: filteredBudgets.map(b => getSpent(b.category, b.month)),
          backgroundColor: filteredBudgets.map(b => {
            const spent = getSpent(b.category, b.month);
            const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
            return pct >= 100 ? 'rgba(239,68,68,0.7)' : pct >= 80 ? 'rgba(245,158,11,0.7)' : 'rgba(16,185,129,0.7)';
          }),
          borderColor: filteredBudgets.map(b => {
            const spent = getSpent(b.category, b.month);
            const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
            return pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981';
          }),
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [budgets, expenses, form.month]);

  const chartOptions = {
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

  return (
    <Layout title="Budget">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <Card style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Active Budgets</span>
            <Icon path={icons.target} size={18} style={{ color: 'var(--warning)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning-light)' }}>{budgets.length}</div>
        </Card>
        <Card style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Budget</span>
            <Icon path={icons.wallet} size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-light)' }}>
            {fmt(budgets.filter(b => b.month === form.month).reduce((s, b) => s + b.limit, 0))}
          </div>
        </Card>
        <Card style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Spent</span>
            <Icon path={icons.trendingDown} size={18} style={{ color: 'var(--danger)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger-light)' }}>
            {fmt(budgets.filter(b => b.month === form.month).reduce((s, b) => s + getSpent(b.category, b.month), 0))}
          </div>
        </Card>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '18px', background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger-light)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon path={icons.alertCircle} size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '18px', background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--success-light)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon path={icons.check} size={16} /> {success}
        </div>
      )}

      {chartData && (
        <Card style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Budget vs Actual - {form.month}</h2>
          </div>
          <div style={{ height: 280 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.plus} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Set Budget</h2>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={categories.map(c => ({ value: c, label: c }))} required />
            <Input label="Monthly Limit" type="number" min="1" step="1" placeholder="0" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} required />
            <Input label="Month" type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} required />
            <Button type="submit" fullWidth variant="success">Set Budget</Button>
          </form>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Budget Overview</h2>
          {loading ? <LoadingSpinner /> : budgets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Icon path={icons.target} size={40} />
              <p style={{ marginTop: '12px' }}>No budgets set yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {budgets.map((b) => {
                const spent = getSpent(b.category, b.month);
                const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
                const color = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';
                const textColor = pct >= 100 ? 'var(--danger-light)' : pct >= 80 ? 'var(--warning-light)' : 'var(--success-light)';
                return (
                  <div key={b._id} style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.category}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{b.month}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: textColor }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Spent: {fmt(spent)}</span>
                      <span>Limit: {fmt(b.limit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
