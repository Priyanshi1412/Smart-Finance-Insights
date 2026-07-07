import { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { investmentAPI } from '../services/api';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

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

const emptyForm = {
  name: '', type: '', category: '', amount: '',
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
    padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
    animation: 'scaleIn 0.25s ease-out', boxShadow: 'var(--shadow-xl)',
  },
  modalTitle: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px', marginBottom: '28px' },
  analyticsRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' },
  analyticsLabel: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '120px', flexShrink: 0 },
  analyticsTrack: { flex: 1, height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' },
  analyticsPct: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '44px', textAlign: 'right' },
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
  const returns = investment.expectedReturns || 0;
  const isPositive = returns >= 0;

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
          <div style={s.investmentType}>{investment.type} • {investment.category}</div>
        </div>
      </div>

      <div style={{ fontSize: '1.3rem', fontWeight: 800, color, marginBottom: '14px' }}>
        {fmt(investment.amount)}
      </div>

      <div style={s.investmentStats}>
        <div style={s.investmentStatItem}>
          <span style={s.investmentStatLabel}>Expected Returns</span>
          <span style={{ ...s.investmentStatValue, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
            {isPositive ? '+' : ''}{returns}%
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
          <div style={s.investmentStatItem}>
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
      await onSave({
        name: form.name,
        type: form.type,
        category: form.category,
        amount: Number(form.amount),
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
              label="Expected Returns (%)" type="number" placeholder="0"
              value={form.expectedReturns} onChange={(e) => setForm({ ...form, expectedReturns: e.target.value })}
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
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editInvestment, setEditInvestment] = useState(null);

  const fetchInvestments = useCallback(async () => {
    try {
      const res = await investmentAPI.getAll();
      setInvestments(res.data);
    } catch (err) {
      console.error('Failed to fetch investments:', err);
    } finally {
      setLoading(false);
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
    } catch (err) {
      console.error('Failed to delete investment:', err);
    }
  };

  const stats = useMemo(() => {
    const active = investments.filter((inv) => inv.status === 'active');
    const totalInvested = investments.reduce((s, inv) => s + (inv.amount || 0), 0);
    const totalReturns = investments.reduce((s, inv) => {
      const returns = inv.expectedReturns || 0;
      return s + (inv.amount * returns / 100);
    }, 0);
    const currentValue = totalInvested + totalReturns;
    const bestPerformer = [...investments].sort((a, b) => (b.expectedReturns || 0) - (a.expectedReturns || 0))[0];
    return {
      totalInvested,
      currentValue,
      totalReturns,
      activeCount: active.length,
      totalCount: investments.length,
      bestPerformer,
    };
  }, [investments]);

  const typeBreakdown = useMemo(() => {
    const breakdown = {};
    investments.forEach((inv) => {
      if (!breakdown[inv.type]) {
        breakdown[inv.type] = { type: inv.type, total: 0, count: 0 };
      }
      breakdown[inv.type].total += inv.amount || 0;
      breakdown[inv.type].count += 1;
    });
    return Object.values(breakdown).sort((a, b) => b.total - a.total);
  }, [investments]);

  const doughnutData = useMemo(() => ({
    labels: typeBreakdown.map((t) => t.type),
    datasets: [{
      data: typeBreakdown.map((t) => t.total),
      backgroundColor: typeBreakdown.map((t) => (TYPE_COLORS[t.type] || '#6B7280') + 'CC'),
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 8,
    }],
  }), [typeBreakdown]);

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
            const pct = stats.totalInvested > 0 ? ((ctx.raw / stats.totalInvested) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
          },
        },
      },
    },
  };

  const openNewInvestment = () => {
    setEditInvestment(null);
    setShowModal(true);
  };

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
        <SummaryCard icon={icons.trendingUp} amount={fmt(stats.currentValue)} label="Current Value" desc={`${stats.totalReturns >= 0 ? '+' : ''}${fmt(stats.totalReturns)} returns`} color="var(--success)" delay="0.05s" />
        <SummaryCard icon={icons.activity} amount={`${stats.activeCount}`} label="Active Investments" desc={`${stats.totalCount - stats.activeCount} closed/paused`} color="var(--accent)" delay="0.1s" />
        <SummaryCard icon={icons.target} amount={stats.bestPerformer ? `${stats.bestPerformer.expectedReturns || 0}%` : 'N/A'} label="Best Performer" desc={stats.bestPerformer?.name || 'No investments yet'} color="var(--warning)" delay="0.15s" />
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

          {/* Two Column Layout: Chart + Type Breakdown */}
          <div style={s.twoCol}>
            {/* Portfolio Allocation Chart */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.pieChart} size={18} />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Portfolio Allocation</h2>
              </div>
              <div style={{ height: 220, display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
                {typeBreakdown.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: TYPE_COLORS[t.type] || '#6B7280', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>{t.type}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{((t.total / stats.totalInvested) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Type Breakdown */}
            <Card>
              <h3 style={s.sectionTitle}>Type Breakdown</h3>
              {typeBreakdown.map((t) => {
                const pct = stats.totalInvested > 0 ? (t.total / stats.totalInvested) * 100 : 0;
                const color = TYPE_COLORS[t.type] || '#6B7280';
                return (
                  <div key={t.type} style={s.analyticsRow}>
                    <span style={s.analyticsLabel}>{t.type}</span>
                    <div style={s.analyticsTrack}>
                      <div style={{ ...s.analyticsFill, width: `${pct}%`, background: color }} />
                    </div>
                    <span style={s.analyticsPct}>{Math.round(pct)}%</span>
                  </div>
                );
              })}
              <div style={{ marginTop: '20px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Investment Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Types</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{typeBreakdown.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg per Type</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(stats.totalInvested / (typeBreakdown.length || 1))}</div>
                  </div>
                </div>
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
