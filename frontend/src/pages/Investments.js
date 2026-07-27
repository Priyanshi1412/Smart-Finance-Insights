import { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import ProgressRing from '../components/ui/ProgressRing';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { investmentAPI } from '../services/api';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import {
  Chart as ChartJS,
  ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const INVESTMENT_TYPES = [
  { value: 'Stocks', label: 'Stocks' },
  { value: 'Mutual Funds', label: 'Mutual Funds' },
  { value: 'Fixed Deposit', label: 'Fixed Deposit' },
  { value: 'PPF', label: 'PPF' },
  { value: 'NPS', label: 'NPS' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'Gold', label: 'Gold' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Bonds', label: 'Bonds' },
  { value: 'ETF', label: 'ETF' },
  { value: 'Other', label: 'Other' },
];

const CATEGORIES = [
  { value: 'Equity', label: 'Equity' },
  { value: 'Debt', label: 'Debt' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Commodity', label: 'Commodity' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Digital', label: 'Digital' },
  { value: 'Government', label: 'Government' },
  { value: 'Corporate', label: 'Corporate' },
  { value: 'Other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'paused', label: 'Paused' },
];

const TYPE_COLORS = {
  'Stocks': '#3B82F6',
  'Mutual Funds': '#10B981',
  'Fixed Deposit': '#F59E0B',
  'PPF': '#8B5CF6',
  'NPS': '#EC4899',
  'Crypto': '#F97316',
  'Gold': '#EAB308',
  'Real Estate': '#EF4444',
  'Bonds': '#06B6D4',
  'ETF': '#14B8A6',
  'Other': '#6B7280',
};

const CATEGORY_COLORS = {
  'Equity': '#3B82F6',
  'Debt': '#10B981',
  'Hybrid': '#8B5CF6',
  'Commodity': '#EAB308',
  'Real Estate': '#EF4444',
  'Digital': '#F97316',
  'Government': '#06B6D4',
  'Corporate': '#EC4899',
  'Other': '#6B7280',
};

const emptyForm = {
  name: '', type: '', category: '', amount: '', currentValue: '',
  investedDate: new Date().toISOString().split('T')[0],
  expectedReturns: '', status: 'active', notes: ''
};

const s = {
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  subtitle: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' },
  statCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    padding: '20px 24px', backdropFilter: 'blur(12px)', transition: 'all var(--transition-base)',
    animation: 'fadeIn 0.4s ease-out', position: 'relative', overflow: 'hidden',
  },
  statIcon: {
    width: 44, height: 44, borderRadius: 'var(--radius-md)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
  },
  statAmount: { fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '4px' },
  statLabel: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' },
  statDesc: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' },
  investmentsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px', marginBottom: '28px' },
  investmentCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    padding: '22px', backdropFilter: 'blur(12px)', transition: 'all var(--transition-base)',
    animation: 'fadeIn 0.4s ease-out', position: 'relative', overflow: 'hidden',
  },
  investmentHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' },
  investmentIconWrap: {
    width: 48, height: 48, borderRadius: 'var(--radius-md)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  investmentName: { fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.2 },
  investmentType: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' },
  investmentStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '14px' },
  investmentStatItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  investmentStatLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  investmentStatValue: { fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' },
  investmentActions: { display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' },
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px', animation: 'fadeIn 0.2s ease-out',
  },
  modal: {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    padding: '28px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
    animation: 'scaleIn 0.25s ease-out', boxShadow: 'var(--shadow-xl)',
  },
  modalTitle: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px', marginBottom: '28px' },
  threeCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' },
  analyticsRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' },
  analyticsLabel: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '120px', flexShrink: 0 },
  analyticsTrack: { flex: 1, height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' },
  analyticsPct: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '44px', textAlign: 'right' },
  perfTable: { width: '100%', borderCollapse: 'collapse' },
  perfTh: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' },
  perfTd: { fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' },
  perfRow: { transition: 'background var(--transition-fast)' },
  roiCard: {
    background: 'var(--bg-glass)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)',
    padding: '16px 18px', transition: 'all var(--transition-fast)',
  },
  roiLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' },
  roiValue: { fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' },
  roiFormula: { fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' },
};

function SummaryCard({ icon, amount, label, desc, color, delay }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        ...s.statCard,
        ...(hover ? { borderColor: color, boxShadow: `0 8px 32px ${color}20`, transform: 'translateY(-3px)' } : {}),
        animationDelay: delay,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ ...s.statIcon, background: `${color}18` }}>
        <Icon path={icon} size={22} />
      </div>
      <div style={{ ...s.statAmount, color }}>{amount}</div>
      <div style={s.statLabel}>{label}</div>
      {desc && <div style={s.statDesc}>{desc}</div>}
    </div>
  );
}

function InvestmentCard({ investment, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const color = TYPE_COLORS[investment.type] || '#6B7280';
  const currentVal = investment.currentValue != null ? investment.currentValue : (investment.amount || 0);
  const profit = currentVal - (investment.amount || 0);
  const returnPct = investment.amount > 0 ? ((profit / investment.amount) * 100) : 0;
  const isProfit = profit >= 0;

  return (
    <div
      style={{
        ...s.investmentCard,
        ...(hover ? { borderColor: color, boxShadow: `0 8px 32px ${color}15`, transform: 'translateY(-2px)' } : {}),
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {investment.status !== 'active' && (
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <Badge color={investment.status === 'closed' ? 'danger' : 'warning'} dot>
            {investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}
          </Badge>
        </div>
      )}

      <div style={s.investmentHeader}>
        <div style={{ ...s.investmentIconWrap, background: `${color}18` }}>
          <Icon path={icons.investments} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.investmentName}>{investment.name}</div>
          <div style={s.investmentType}>{investment.type} &bull; {investment.category}</div>
        </div>
      </div>

      <div style={{ fontSize: '1.3rem', fontWeight: 800, color, marginBottom: '4px' }}>
        {fmt(currentVal)}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
        Invested: {fmt(investment.amount)}
      </div>

      <div style={s.investmentStats}>
        <div style={s.investmentStatItem}>
          <span style={s.investmentStatLabel}>Profit/Loss</span>
          <span style={{ ...s.investmentStatValue, color: isProfit ? 'var(--success)' : 'var(--danger)' }}>
            {isProfit ? '+' : ''}{fmt(profit)}
          </span>
        </div>
        <div style={s.investmentStatItem}>
          <span style={s.investmentStatLabel}>Return %</span>
          <span style={{ ...s.investmentStatValue, color: isProfit ? 'var(--success)' : 'var(--danger)' }}>
            {isProfit ? '+' : ''}{returnPct.toFixed(2)}%
          </span>
        </div>
        <div style={s.investmentStatItem}>
          <span style={s.investmentStatLabel}>Invested On</span>
          <span style={s.investmentStatValue}>{fmtDate(investment.investedDate)}</span>
        </div>
        <div style={s.investmentStatItem}>
          <span style={s.investmentStatLabel}>Status</span>
          <Badge color={investment.status === 'active' ? 'success' : investment.status === 'closed' ? 'danger' : 'warning'}>
            {investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}
          </Badge>
        </div>
        {investment.notes && (
          <div style={{ ...s.investmentStatItem, gridColumn: 'span 2' }}>
            <span style={s.investmentStatLabel}>Notes</span>
            <span style={{ ...s.investmentStatValue, fontSize: '0.82rem' }}>{investment.notes}</span>
          </div>
        )}
      </div>

      <div style={s.investmentActions}>
        <Button variant="secondary" size="sm" onClick={() => onEdit(investment)}>
          <Icon path={icons.edit} size={14} /> Edit
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(investment._id)}>
          <Icon path={icons.trash} size={14} /> Delete
        </Button>
      </div>
    </div>
  );
}

function InvestmentModal({ show, onClose, onSave, editInvestment }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editInvestment) {
      setForm({
        name: editInvestment.name || '',
        type: editInvestment.type || '',
        category: editInvestment.category || '',
        amount: editInvestment.amount || '',
        currentValue: editInvestment.currentValue ?? '',
        investedDate: editInvestment.investedDate ? new Date(editInvestment.investedDate).toISOString().split('T')[0] : '',
        expectedReturns: editInvestment.expectedReturns || '',
        status: editInvestment.status || 'active',
        notes: editInvestment.notes || '',
      });
    } else {
      setForm(emptyForm);
    }
    setError('');
  }, [editInvestment, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.type || !form.category || !form.amount) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const amount = Number(form.amount);
      const currentValue = form.currentValue !== '' ? Number(form.currentValue) : amount;
      await onSave({
        name: form.name,
        type: form.type,
        category: form.category,
        amount,
        currentValue,
        investedDate: form.investedDate,
        expectedReturns: Number(form.expectedReturns || 0),
        status: form.status,
        notes: form.notes,
      });
      setForm(emptyForm);
      setError('');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save investment.';
      setError(msg);
      console.error('Investment save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    setError('');
    onClose();
  };

  if (!show) return null;

  return (
    <div style={s.modalOverlay} onClick={handleClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalTitle}>{editInvestment ? 'Edit Investment' : 'Add New Investment'}</div>
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--danger-light)', fontSize: '0.85rem', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Investment Name" placeholder="e.g. Infosys Stock" required
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Select
              label="Type" required
              value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[{ value: '', label: 'Select type...' }, ...INVESTMENT_TYPES]}
            />
            <Select
              label="Category" required
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[{ value: '', label: 'Select category...' }, ...CATEGORIES]}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Input
              label="Amount Invested" type="number" placeholder="0" required
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <Input
              label="Current Value" type="number" placeholder="0"
              value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Input
              label="Invested Date" type="date"
              value={form.investedDate} onChange={(e) => setForm({ ...form, investedDate: e.target.value })}
            />
            <Select
              label="Status"
              value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={STATUS_OPTIONS}
            />
          </div>
          <Input
            label="Expected Returns (%)" type="number" placeholder="0"
            value={form.expectedReturns} onChange={(e) => setForm({ ...form, expectedReturns: e.target.value })}
          />
          <Input
            label="Notes (Optional)" placeholder="Add any notes about this investment"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div style={s.modalActions}>
            <Button variant="ghost" onClick={handleClose} type="button">Cancel</Button>
            <Button type="submit" loading={loading}>{editInvestment ? 'Update Investment' : 'Add Investment'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Investments() {
  const { refreshHealth } = useFinancialHealth();
  const [investments, setInvestments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editInvestment, setEditInvestment] = useState(null);

  const fetchInvestments = useCallback(async () => {
    try {
      const invRes = await investmentAPI.getAll();
      setInvestments(invRes.data);
    } catch (err) {
      console.error('Failed to fetch investments:', err);
    } finally {
      setLoading(false);
    }
    try {
      const analyticsRes = await investmentAPI.getAnalytics();
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, []);

  useEffect(() => { fetchInvestments(); }, [fetchInvestments]);

  const handleSave = async (data) => {
    if (editInvestment) {
      const res = await investmentAPI.update(editInvestment._id, data);
      setInvestments((prev) => prev.map((inv) => (inv._id === editInvestment._id ? res.data : inv)));
    } else {
      const res = await investmentAPI.create(data);
      setInvestments((prev) => [res.data, ...prev]);
    }
    setShowModal(false);
    setEditInvestment(null);
    refreshHealth();
    try {
      const analyticsRes = await investmentAPI.getAnalytics();
      setAnalytics(analyticsRes.data);
    } catch {}
  };

  const handleEdit = (investment) => {
    setEditInvestment(investment);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this investment?')) return;
    try {
      await investmentAPI.delete(id);
      setInvestments((prev) => prev.filter((inv) => inv._id !== id));
      refreshHealth();
      try {
        const analyticsRes = await investmentAPI.getAnalytics();
        setAnalytics(analyticsRes.data);
      } catch {}
    } catch (err) {
      console.error('Failed to delete investment:', err);
    }
  };

  const stats = useMemo(() => {
    if (analytics) return analytics.summary;
    const totalInvested = investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalCurrentValue = investments.reduce((sum, inv) => sum + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
    const totalReturns = totalCurrentValue - totalInvested;
    const returnPct = totalInvested > 0 ? ((totalReturns / totalInvested) * 100) : 0;
    return {
      totalInvested, totalCurrentValue, totalReturns,
      returnPct: Math.round(returnPct * 100) / 100,
      activeCount: investments.filter(i => i.status === 'active').length,
      totalCount: investments.length,
    };
  }, [analytics, investments]);

  const typeBreakdown = useMemo(() => {
    if (analytics) return analytics.typeBreakdown;
    const breakdown = {};
    investments.forEach((inv) => {
      if (!breakdown[inv.type]) breakdown[inv.type] = { type: inv.type, invested: 0, currentValue: 0, count: 0 };
      breakdown[inv.type].invested += inv.amount || 0;
      breakdown[inv.type].currentValue += inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
      breakdown[inv.type].count += 1;
    });
    return Object.values(breakdown).sort((a, b) => b.currentValue - a.currentValue);
  }, [analytics, investments]);

  const categoryBreakdown = useMemo(() => {
    if (analytics) return analytics.categoryBreakdown;
    const breakdown = {};
    investments.forEach((inv) => {
      if (!breakdown[inv.category]) breakdown[inv.category] = { category: inv.category, invested: 0, currentValue: 0, count: 0 };
      breakdown[inv.category].invested += inv.amount || 0;
      breakdown[inv.category].currentValue += inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
      breakdown[inv.category].count += 1;
    });
    return Object.values(breakdown).sort((a, b) => b.currentValue - a.currentValue);
  }, [analytics, investments]);

  const performance = useMemo(() => {
    if (analytics) return analytics.performance;
    return investments.map(inv => {
      const curr = inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
      const profit = curr - (inv.amount || 0);
      const retPct = inv.amount > 0 ? ((profit / inv.amount) * 100) : 0;
      return {
        _id: inv._id, name: inv.name, type: inv.type, category: inv.category,
        amount: inv.amount, currentValue: curr, profit, returnPct: Math.round(retPct * 100) / 100,
        status: inv.status, investedDate: inv.investedDate,
      };
    }).sort((a, b) => b.returnPct - a.returnPct);
  }, [analytics, investments]);

  const diversification = useMemo(() => {
    if (analytics?.diversification) return analytics.diversification;
    const numTypes = typeBreakdown.length;
    const numCategories = categoryBreakdown.length;
    const maxTypeAlloc = stats.totalCurrentValue > 0
      ? Math.max(...typeBreakdown.map(t => (t.currentValue / stats.totalCurrentValue) * 100))
      : 0;
    const concentrationRatio = Math.round(maxTypeAlloc * 100) / 100;
    const score = numTypes === 0 ? 0 : Math.min(100, Math.round(
      (Math.min(numTypes, 6) / 6) * 60 + (numCategories >= 3 ? 20 : numCategories * 6.67) + (concentrationRatio < 40 ? 20 : concentrationRatio < 60 ? 10 : 0)
    ));
    return {
      score,
      label: score >= 70 ? 'Well Diversified' : score >= 40 ? 'Moderately Diversified' : 'Concentrated',
      numTypes, numCategories, concentrationRatio,
    };
  }, [analytics, typeBreakdown, categoryBreakdown, stats]);

  const chartData = useMemo(() => {
    return performance.slice(0, 8).map(p => ({
      name: p.name.length > 14 ? p.name.slice(0, 12) + '...' : p.name,
      invested: p.amount,
      currentValue: p.currentValue,
    }));
  }, [performance]);

  const doughnutData = useMemo(() => ({
    labels: typeBreakdown.map((t) => t.type),
    datasets: [{
      data: typeBreakdown.map((t) => t.currentValue),
      backgroundColor: typeBreakdown.map((t) => (TYPE_COLORS[t.type] || '#6B7280') + 'CC'),
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 8,
    }],
  }), [typeBreakdown]);

  const categoryDoughnutData = useMemo(() => ({
    labels: categoryBreakdown.map((c) => c.category),
    datasets: [{
      data: categoryBreakdown.map((c) => c.currentValue),
      backgroundColor: categoryBreakdown.map((c) => (CATEGORY_COLORS[c.category] || '#6B7280') + 'CC'),
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 8,
    }],
  }), [categoryBreakdown]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
          },
        },
      },
    },
  };

  const barTooltipStyle = {
    contentStyle: {
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    },
  };

  const openNewInvestment = () => {
    setEditInvestment(null);
    setShowModal(true);
  };

  const profitColor = stats.totalReturns >= 0 ? 'var(--success)' : 'var(--danger)';
  const divColor = diversification.score >= 70 ? 'var(--success)' : diversification.score >= 40 ? 'var(--warning)' : 'var(--danger)';

  if (loading) {
    return (
      <Layout title="Investments">
        <LoadingSpinner text="Loading investments..." />
      </Layout>
    );
  }

  return (
    <Layout title="Investments">
      <div style={s.topBar}>
        <div>
          <h3 style={s.subtitle}>Track and manage your investment portfolio</h3>
        </div>
        <Button onClick={openNewInvestment} size="sm">
          <Icon path={icons.plus} size={16} /> Add Investment
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={s.statsGrid}>
        <SummaryCard icon={icons.investments} amount={fmt(stats.totalInvested)} label="Total Invested" desc={`Across ${stats.totalCount} investments`} color="var(--purple)" delay="0s" />
        <SummaryCard icon={icons.trendingUp} amount={fmt(stats.totalCurrentValue)} label="Current Value" desc={`${stats.totalReturns >= 0 ? '+' : ''}${fmt(stats.totalReturns)} overall returns`} color="var(--success)" delay="0.05s" />
        <SummaryCard icon={icons.activity} amount={`${stats.activeCount}`} label="Active Investments" desc={`${stats.totalCount - stats.activeCount} closed/paused`} color="var(--accent)" delay="0.1s" />
        <SummaryCard icon={icons.target} amount={`${stats.returnPct >= 0 ? '+' : ''}${stats.returnPct}%`} label="Overall Return" desc={stats.returnPct >= 0 ? 'Portfolio is growing' : 'Portfolio is declining'} color={profitColor} delay="0.15s" />
      </div>

      {investments.length === 0 ? (
        <Card style={{ marginBottom: '28px' }}>
          <EmptyState
            icon={icons.investments}
            title="No investments yet"
            description="Add your first investment to start tracking your portfolio"
            action={<Button onClick={openNewInvestment} size="sm"><Icon path={icons.plus} size={16} /> Add Investment</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Investment Cards */}
          <div style={{ marginBottom: '8px' }}>
            <h3 style={s.sectionTitle}>Your Investments</h3>
          </div>
          <div style={s.investmentsGrid}>
            {investments.map((investment) => (
              <InvestmentCard key={investment._id} investment={investment} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>

          {/* ===== MODULE 2: Asset Allocation & Return Calculation ===== */}

          {/* ROI Summary - All Calculations */}
          <div style={{ marginBottom: '8px' }}>
            <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon path={icons.barChart} size={20} /> Return on Investment (ROI) Summary
            </h3>
          </div>
          <div style={s.threeCol}>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Total Investment</div>
              <div style={s.roiValue}>{fmt(stats.totalInvested)}</div>
              <div style={s.roiFormula}>Sum of all invested amounts</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Current Portfolio Value</div>
              <div style={{ ...s.roiValue, color: 'var(--success)' }}>{fmt(stats.totalCurrentValue)}</div>
              <div style={s.roiFormula}>Sum of all current values</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Profit / Loss</div>
              <div style={{ ...s.roiValue, color: profitColor }}>{stats.totalReturns >= 0 ? '+' : ''}{fmt(stats.totalReturns)}</div>
              <div style={s.roiFormula}>Current Value - Total Invested</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Return Percentage (ROI)</div>
              <div style={{ ...s.roiValue, color: profitColor }}>{stats.returnPct >= 0 ? '+' : ''}{stats.returnPct}%</div>
              <div style={s.roiFormula}>(Profit / Total Invested) x 100</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Total Asset Classes</div>
              <div style={s.roiValue}>{typeBreakdown.length}</div>
              <div style={s.roiFormula}>Different investment types</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Best Performer</div>
              <div style={{ ...s.roiValue, color: 'var(--success)', fontSize: '1rem' }}>
                {analytics?.bestPerformer?.name || performance[0]?.name || 'N/A'}
              </div>
              <div style={s.roiFormula}>
                {analytics?.bestPerformer != null
                  ? `${fmt(analytics.bestPerformer.amount)} invested`
                  : performance[0] ? `${fmt(performance[0].amount)} invested` : ''}
              </div>
            </div>
          </div>

          {/* Portfolio Performance Chart */}
          <Card style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.barChart} size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Invested vs Current Value</h2>
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...barTooltipStyle} formatter={(value) => [fmt(value)]} />
                  <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} />
                  <Bar dataKey="invested" fill="#8B5CF6" name="Invested" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="currentValue" fill="#10B981" name="Current Value" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Asset Allocation by Type + Asset Allocation by Category */}
          <div style={s.twoCol}>
            {/* Asset Allocation by Type */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.pieChart} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Allocation by Type</h2>
              </div>
              <div style={{ height: 220, display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginTop: '16px' }}>
                {typeBreakdown.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: TYPE_COLORS[t.type] || '#6B7280', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>{t.type}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{((t.currentValue / (stats.totalCurrentValue || 1)) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Asset Allocation by Category */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.pieChart} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Allocation by Category</h2>
              </div>
              <div style={{ height: 220, display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={categoryDoughnutData} options={doughnutOptions} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginTop: '16px' }}>
                {categoryBreakdown.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[c.category] || '#6B7280', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>{c.category}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{((c.currentValue / (stats.totalCurrentValue || 1)) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Portfolio Diversification + Type Performance Breakdown */}
          <div style={s.twoCol}>
            {/* Portfolio Diversification Analysis */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.shield} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Portfolio Diversification</h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                <ProgressRing percent={diversification.score} size={100} strokeWidth={8} color={divColor} />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Diversification Score</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: divColor }}>{diversification.score}/100</div>
                  <Badge color={diversification.score >= 70 ? 'success' : diversification.score >= 40 ? 'warning' : 'danger'}>
                    {diversification.label}
                  </Badge>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={s.roiCard}>
                  <div style={s.roiLabel}>Asset Classes</div>
                  <div style={{ ...s.roiValue, fontSize: '1.1rem' }}>{diversification.numTypes}</div>
                </div>
                <div style={s.roiCard}>
                  <div style={s.roiLabel}>Categories Used</div>
                  <div style={{ ...s.roiValue, fontSize: '1.1rem' }}>{diversification.numCategories}</div>
                </div>
                <div style={s.roiCard}>
                  <div style={s.roiLabel}>Max Allocation</div>
                  <div style={{ ...s.roiValue, fontSize: '1.1rem', color: diversification.concentrationRatio > 60 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {diversification.concentrationRatio}%
                  </div>
                </div>
                <div style={s.roiCard}>
                  <div style={s.roiLabel}>Total Investments</div>
                  <div style={{ ...s.roiValue, fontSize: '1.1rem' }}>{stats.totalCount}</div>
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {diversification.score >= 70
                    ? 'Your portfolio is well diversified across multiple asset classes. This reduces risk and provides balanced growth potential.'
                    : diversification.score >= 40
                    ? 'Your portfolio has moderate diversification. Consider adding investments in different asset classes to reduce concentration risk.'
                    : 'Your portfolio is concentrated in few asset classes. Diversifying across Stocks, Bonds, Gold, and Real Estate can reduce risk significantly.'}
                </div>
              </div>
            </Card>

            {/* Type Performance Breakdown */}
            <Card>
              <h3 style={s.sectionTitle}>Type Performance Breakdown</h3>
              {typeBreakdown.map((t) => {
                const pct = stats.totalCurrentValue > 0 ? (t.currentValue / stats.totalCurrentValue) * 100 : 0;
                const typeProfit = t.currentValue - t.invested;
                const typeReturnPct = t.invested > 0 ? ((typeProfit / t.invested) * 100) : 0;
                const color = TYPE_COLORS[t.type] || '#6B7280';
                return (
                  <div key={t.type} style={{ marginBottom: '16px' }}>
                    <div style={s.analyticsRow}>
                      <span style={s.analyticsLabel}>{t.type}</span>
                      <div style={s.analyticsTrack}>
                        <div style={{ ...s.analyticsFill, width: `${pct}%`, background: color }} />
                      </div>
                      <span style={s.analyticsPct}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '134px', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t.count} investment{t.count !== 1 ? 's' : ''} &bull; {fmt(t.currentValue)}</span>
                      <span style={{ color: typeProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {typeProfit >= 0 ? '+' : ''}{typeReturnPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: '20px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Portfolio Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Types</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{typeBreakdown.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg per Type</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(stats.totalCurrentValue / (typeBreakdown.length || 1))}</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Category Breakdown + Performance Table */}
          <div style={s.twoCol}>
            {/* Category Breakdown */}
            <Card>
              <h3 style={s.sectionTitle}>Category Breakdown</h3>
              {categoryBreakdown.map((c) => {
                const pct = stats.totalCurrentValue > 0 ? (c.currentValue / stats.totalCurrentValue) * 100 : 0;
                const catProfit = c.currentValue - c.invested;
                const catReturnPct = c.invested > 0 ? ((catProfit / c.invested) * 100) : 0;
                const color = CATEGORY_COLORS[c.category] || '#6B7280';
                return (
                  <div key={c.category} style={{ marginBottom: '16px' }}>
                    <div style={s.analyticsRow}>
                      <span style={s.analyticsLabel}>{c.category}</span>
                      <div style={s.analyticsTrack}>
                        <div style={{ ...s.analyticsFill, width: `${pct}%`, background: color }} />
                      </div>
                      <span style={s.analyticsPct}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '134px', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{c.count} investment{c.count !== 1 ? 's' : ''} &bull; {fmt(c.currentValue)}</span>
                      <span style={{ color: catProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {catProfit >= 0 ? '+' : ''}{catReturnPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: '20px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Category Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Categories</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{categoryBreakdown.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg per Category</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(stats.totalCurrentValue / (categoryBreakdown.length || 1))}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Investment Performance Ranking */}
            <Card>
              <h3 style={s.sectionTitle}>Investment Performance</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.perfTable}>
                  <thead>
                    <tr>
                      <th style={s.perfTh}>#</th>
                      <th style={s.perfTh}>Name</th>
                      <th style={s.perfTh}>Invested</th>
                      <th style={s.perfTh}>Current</th>
                      <th style={s.perfTh}>Profit/Loss</th>
                      <th style={s.perfTh}>ROI %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.slice(0, 10).map((p, i) => (
                      <tr key={p._id} style={s.perfRow} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={s.perfTd}>{i + 1}</td>
                        <td style={{ ...s.perfTd, fontWeight: 600 }}>{p.name}</td>
                        <td style={s.perfTd}>{fmt(p.amount)}</td>
                        <td style={s.perfTd}>{fmt(p.currentValue)}</td>
                        <td style={{ ...s.perfTd, color: p.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {p.profit >= 0 ? '+' : ''}{fmt(p.profit)}
                        </td>
                        <td style={{ ...s.perfTd, color: p.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {p.profit >= 0 ? '+' : ''}{p.returnPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      <InvestmentModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditInvestment(null); }}
        onSave={handleSave}
        editInvestment={editInvestment}
      />
    </Layout>
  );
}
