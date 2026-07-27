import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { goalAPI } from '../services/api';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend as ChartLegend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, ChartLegend, ArcElement);

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const CATEGORIES = [
  { value: 'Emergency Fund', label: 'Emergency Fund' },
  { value: 'Home Purchase', label: 'Home Purchase' },
  { value: 'Car Purchase', label: 'Car Purchase' },
  { value: 'Higher Education', label: 'Higher Education' },
  { value: 'Retirement', label: 'Retirement' },
  { value: 'Vacation', label: 'Vacation' },
  { value: 'Debt Repayment', label: 'Debt Repayment' },
  { value: 'Wealth Creation', label: 'Wealth Creation' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Health', label: 'Health' },
  { value: 'Wedding', label: 'Wedding' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Other', label: 'Other' },
];

const CATEGORY_ICONS = {
  'Emergency Fund': icons.shield, 'Home Purchase': icons.dashboard, 'Car Purchase': icons.wallet,
  'Higher Education': icons.barChart, 'Retirement': icons.target, 'Vacation': icons.send,
  'Debt Repayment': icons.trendingDown, 'Wealth Creation': icons.trendingUp,
  'Travel': icons.send, 'Health': icons.activity, 'Wedding': icons.savings,
  'Technology': icons.creditCard, 'Other': icons.target,
};

const CATEGORY_COLORS = {
  'Emergency Fund': '#10B981', 'Home Purchase': '#3B82F6', 'Car Purchase': '#F59E0B',
  'Higher Education': '#8B5CF6', 'Retirement': '#2563EB', 'Vacation': '#14B8A6',
  'Debt Repayment': '#EF4444', 'Wealth Creation': '#10B981',
  'Travel': '#06B6D4', 'Health': '#34D399', 'Wedding': '#EC4899',
  'Technology': '#6366F1', 'Other': '#6B7280',
};

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: 'danger' },
  { value: 'medium', label: 'Medium', color: 'warning' },
  { value: 'low', label: 'Low', color: 'info' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paused', label: 'Paused' },
];

const PREDICTION_COLORS = {
  'On Track': 'success',
  'At Risk': 'warning',
  'Behind Schedule': 'danger',
  'Overdue': 'danger',
  'Achieved': 'success',
};

function computeRecommendedPriority(g) {
  if (g.status === 'achieved') return 'low';
  if (g.status === 'overdue') return 'high';
  const remaining = Math.max((g.targetAmount || 0) - (g.savedAmount || 0), 0);
  if (remaining <= 0) return 'low';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthsLeft = g.targetDate
    ? Math.max(1, Math.ceil(((() => { const td = new Date(g.targetDate); return new Date(td.getFullYear(), td.getMonth(), td.getDate()); })() - today) / (1000 * 60 * 60 * 24 * 30)))
    : 12;
  const neededMonthly = remaining / monthsLeft;
  const currentSaving = g.monthlySaving || 0;
  if (neededMonthly > currentSaving * 2 || (currentSaving === 0 && neededMonthly > 0)) return 'high';
  if (neededMonthly > currentSaving * 1.3) return 'medium';
  return 'low';
}

function computeGoalPrediction(g) {
  if (g.status === 'achieved') return 'Achieved';
  if (g.status === 'paused') return 'At Risk';
  if (g.targetDate) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const td = new Date(g.targetDate);
    const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate());
    if (targetDay < today) return 'Overdue';
  }
  if (g.status === 'overdue') return 'Overdue';
  const remaining = Math.max((g.targetAmount || 0) - (g.savedAmount || 0), 0);
  if (remaining <= 0) return 'On Track';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthsLeft = g.targetDate
    ? Math.max(1, Math.ceil(((() => { const td = new Date(g.targetDate); return new Date(td.getFullYear(), td.getMonth(), td.getDate()); })() - today) / (1000 * 60 * 60 * 24 * 30)))
    : 12;
  const neededMonthly = remaining / monthsLeft;
  const currentSaving = g.monthlySaving || 0;
  if (currentSaving === 0) return 'Behind Schedule';
  if (neededMonthly <= currentSaving) return 'On Track';
  if (neededMonthly <= currentSaving * 1.3) return 'At Risk';
  return 'Behind Schedule';
}

const emptyForm = { goalName: '', category: 'Emergency Fund', targetAmount: '', savedAmount: '0', monthlySaving: '0', targetDate: '', priority: 'medium' };

const s = {
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  subtitle: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' },
  statCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    padding: '18px 20px', backdropFilter: 'blur(12px)', transition: 'all var(--transition-base)',
    animation: 'fadeIn 0.4s ease-out', position: 'relative', overflow: 'hidden',
  },
  statIcon: { width: 40, height: 40, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' },
  statAmount: { fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '4px' },
  statLabel: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' },
  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px',
    padding: '14px 18px', borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
  },
  filterLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' },
  filterSelect: {
    padding: '7px 10px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', minWidth: 130,
  },
  goalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '18px', marginBottom: '28px' },
  goalCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    padding: '22px', backdropFilter: 'blur(12px)', transition: 'all var(--transition-base)',
    animation: 'fadeIn 0.4s ease-out', position: 'relative', overflow: 'hidden',
  },
  goalHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
  goalIconWrap: { width: 44, height: 44, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goalName: { fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.2 },
  goalCategory: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' },
  progressTrack: { height: 7, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: '12px' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' },
  goalStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 14px', marginBottom: '12px' },
  goalStatItem: { display: 'flex', flexDirection: 'column', gap: '1px' },
  goalStatLabel: { fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  goalStatValue: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' },
  goalActions: { display: 'flex', gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' },
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
  modalTitle: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '18px' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px', marginBottom: '28px' },
  recItem: {
    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 13px',
    borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
    marginBottom: '7px',
  },
  recDot: { width: 7, height: 7, borderRadius: '50%', marginTop: '6px', flexShrink: 0 },
  recText: { fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  formGroup: { marginBottom: '14px' },
  formLabel: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' },
  formInput: {
    width: '100%', padding: '9px 13px', borderRadius: 'var(--radius-md)', fontSize: '0.88rem',
    background: 'var(--bg-glass)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none', transition: 'border-color var(--transition-fast)',
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%', padding: '9px 13px', borderRadius: 'var(--radius-md)', fontSize: '0.88rem',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
  },
  timelineRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  timelineLabel: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '120px', flexShrink: 0 },
  timelineTrack: { flex: 1, height: 20, borderRadius: 'var(--radius-sm)', background: 'var(--border)', overflow: 'hidden', position: 'relative' },
  timelineFill: { height: '100%', borderRadius: 'var(--radius-sm)', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '7px' },
  timelineText: { fontSize: '0.68rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' },
  achievementGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' },
  achievementItem: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
    borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
  },
  achievementIcon: { fontSize: '1.4rem', flexShrink: 0 },
  achievementText: { display: 'flex', flexDirection: 'column', gap: '1px' },
  achievementTitle: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' },
  achievementDesc: { fontSize: '0.7rem', color: 'var(--text-muted)' },
  contribRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0',
    borderBottom: '1px solid var(--border-light)',
  },
  contribAmount: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' },
  contribDate: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  contribNote: { fontSize: '0.75rem', color: 'var(--text-secondary)' },
};

function SummaryCard({ icon, amount, label, color, delay }) {
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
        <Icon path={icon} size={20} />
      </div>
      <div style={{ ...s.statAmount, color }}>{amount}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function GoalForm({ form, setForm, onSave, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.goalName || !form.targetAmount || !form.targetDate) {
      setError('Please fill in all required fields.');
      return;
    }
    const numTarget = Number(form.targetAmount);
    const numSaved = Number(form.savedAmount || 0);
    if (numSaved > numTarget) {
      setError('Current Savings cannot exceed Target Amount.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let payload = {
        ...form,
        targetAmount: numTarget,
        savedAmount: numSaved,
        monthlySaving: Number(form.monthlySaving || 0),
      };
      await onSave(payload);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save goal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <style>{`
          .goal-form-select option { background: #1E293B; color: #F1F5F9; padding: 8px 12px; }
          .goal-form-select option:hover { background: #334155; }
          [data-theme="light"] .goal-form-select option { background: #FFFFFF; color: #0F172A; }
          [data-theme="light"] .goal-form-select option:hover { background: #F1F5F9; }
        `}</style>
        <h2 style={s.modalTitle}>{form._id ? 'Edit Financial Goal' : 'Create Financial Goal'}</h2>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger-light)', fontSize: '0.82rem', marginBottom: '14px' }}>
            {error}
          </div>
        )}
        <div style={s.formGroup}>
          <label style={s.formLabel}>Goal Name *</label>
          <input style={s.formInput} value={form.goalName} onChange={(e) => handleChange('goalName', e.target.value)} placeholder="e.g. Emergency Fund" />
        </div>
        <div style={s.formRow}>
          <div>
            <label style={s.formLabel}>Category *</label>
            <select className="goal-form-select" style={s.formSelect} value={form.category} onChange={(e) => handleChange('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={s.formLabel}>Priority</label>
            <select className="goal-form-select" style={s.formSelect} value={form.priority} onChange={(e) => handleChange('priority', e.target.value)}>
              {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div style={s.formRow}>
          <div>
            <label style={s.formLabel}>Target Amount (INR) *</label>
            <input style={s.formInput} type="number" value={form.targetAmount} onChange={(e) => handleChange('targetAmount', e.target.value)} placeholder="500000" />
          </div>
          <div>
            <label style={s.formLabel}>Current Savings (INR)</label>
            <input style={s.formInput} type="number" value={form.savedAmount} onChange={(e) => handleChange('savedAmount', e.target.value)} placeholder="0" />
          </div>
        </div>
        <div style={s.formRow}>
          <div>
            <label style={s.formLabel}>Monthly Saving (INR)</label>
            <input style={s.formInput} type="number" value={form.monthlySaving} onChange={(e) => handleChange('monthlySaving', e.target.value)} placeholder="10000" />
          </div>
          <div>
            <label style={s.formLabel}>Target Date *</label>
            <input style={s.formInput} type="date" value={form.targetDate} onChange={(e) => handleChange('targetDate', e.target.value)} />
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '14px' }}>
          Note: Goal status is automatically managed. Saving ≥ Target marks it as Completed. Past-due goals are marked Overdue.
        </div>
        <div style={s.modalActions}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>{form._id ? 'Update Goal' : 'Create Goal'}</Button>
        </div>
      </div>
    </div>
  );
}

function ContributionModal({ show, onClose, onAdd, goal }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setAmount(''); setNote(''); setError(''); }, [show]);

  if (!show || !goal) return null;

  const handleAdd = async () => {
    const num = Number(amount);
    if (!num || num <= 0) { setError('Please enter a valid amount.'); return; }
    setLoading(true);
    setError('');
    try {
      await onAdd(goal._id, { amount: num, note });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add contribution.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.modalTitle}>Add Contribution</h2>
        <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{goal.goalName}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{fmt(goal.savedAmount)} saved of {fmt(goal.targetAmount)}</div>
        </div>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger-light)', fontSize: '0.82rem', marginBottom: '14px' }}>
            {error}
          </div>
        )}
        <div style={s.formGroup}>
          <label style={s.formLabel}>Amount (INR) *</label>
          <input style={s.formInput} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" autoFocus />
        </div>
        <div style={s.formGroup}>
          <label style={s.formLabel}>Note (optional)</label>
          <input style={s.formInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Monthly contribution" />
        </div>
        <div style={s.modalActions}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} loading={loading}>Add Contribution</Button>
        </div>
      </div>
    </div>
  );
}

function GoalDetailModal({ show, onClose, goal, onAddContribution }) {
  const [showContrib, setShowContrib] = useState(false);
  if (!show || !goal) return null;

  const pct = goal.targetAmount > 0 ? Math.min(Math.round((goal.savedAmount / goal.targetAmount) * 100), 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0);
  const color = CATEGORY_COLORS[goal.category] || '#3B82F6';
  const daysLeft = goal.targetDate ? (() => { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const td = new Date(goal.targetDate); const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate()); return Math.max(0, Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24))); })() : null;
  const monthsLeft = goal.targetDate ? (() => { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const td = new Date(goal.targetDate); const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate()); return Math.max(0, Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24 * 30))); })() : null;
  const requiredMonthly = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
  const contributions = goal.contributions || [];
  const prediction = computeGoalPrediction(goal);
  const recommendedPriority = computeRecommendedPriority(goal);
  const recommendedOpt = PRIORITY_OPTIONS.find(p => p.value === recommendedPriority);
  const currentPriorityOpt = PRIORITY_OPTIONS.find(p => p.value === goal.priority);
  const showRecommendation = (goal.status === 'active' || goal.status === 'overdue') && goal.priority !== recommendedPriority;

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h2 style={{ ...s.modalTitle, marginBottom: 0 }}>{goal.goalName}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ ...s.goalIconWrap, background: `${color}18`, width: 48, height: 48 }}>
            <Icon path={CATEGORY_ICONS[goal.category] || icons.target} size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{goal.category}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
              <Badge color={currentPriorityOpt?.color || 'info'}>
                {currentPriorityOpt?.label || 'Medium'}
              </Badge>
              <Badge color={PREDICTION_COLORS[prediction] || 'info'}>
                {prediction}
              </Badge>
              {showRecommendation && (
                <Badge color={recommendedOpt?.color || 'info'}>
                  Suggest: {recommendedOpt?.label || 'Medium'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <ProgressRing percent={pct} size={72} strokeWidth={5} color={pct >= 100 ? 'var(--success)' : color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>{pct}% complete</div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : color }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Target', value: fmt(goal.targetAmount), color: 'var(--text-primary)' },
            { label: 'Saved', value: fmt(goal.savedAmount), color: 'var(--success)' },
            { label: 'Remaining', value: fmt(remaining), color: remaining > 0 ? 'var(--warning)' : 'var(--success)' },
            { label: 'Monthly Saving', value: fmt(goal.monthlySaving), color: 'var(--text-primary)' },
            { label: 'Required/Month', value: fmt(requiredMonthly), color: requiredMonthly > (goal.monthlySaving || 0) ? 'var(--danger)' : 'var(--success)' },
            { label: 'Days Left', value: daysLeft !== null ? `${daysLeft} days` : '—', color: daysLeft !== null && daysLeft < 30 ? 'var(--danger)' : 'var(--text-primary)' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>{item.label}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Achievement Prediction</div>
            <Badge color={PREDICTION_COLORS[prediction] || 'info'}>{prediction}</Badge>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Recommended Priority</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Badge color={recommendedOpt?.color || 'info'}>{recommendedOpt?.label || 'Medium'}</Badge>
              {showRecommendation && (
                <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 600 }}>
                  (Currently {currentPriorityOpt?.label || 'Medium'})
                </span>
              )}
            </div>
          </div>
        </div>

        {goal.targetDate && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Target: {new Date(goal.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            {monthsLeft !== null && monthsLeft > 0 && ` (${monthsLeft} months left)`}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Contribution History</h3>
          <Button variant="primary" size="sm" onClick={() => setShowContrib(true)}>
            <Icon path={icons.plus} size={14} /> Add
          </Button>
        </div>

        {contributions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No contributions yet</div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: '8px' }}>
            {[...contributions].reverse().map((c, i) => (
              <div key={i} style={s.contribRow}>
                <div>
                  <div style={s.contribAmount}>+{fmt(c.amount)}</div>
                  <div style={s.contribDate}>{new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                {c.note && <div style={s.contribNote}>{c.note}</div>}
              </div>
            ))}
          </div>
        )}

        {showContrib && (
          <ContributionModal
            show={showContrib}
            onClose={() => setShowContrib(false)}
            onAdd={onAddContribution}
            goal={goal}
          />
        )}
      </div>
    </div>
  );
}

export default function FinancialGoalPlanning() {
  const { refreshHealth } = useFinancialHealth();
  const [goals, setGoals] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [detailGoal, setDetailGoal] = useState(null);

  const fetchGoals = useCallback(async () => {
    try {
      console.log('[FRONTEND] Fetching goal analytics...');
      const analyticsRes = await goalAPI.getAnalytics();
      const data = analyticsRes.data;
      console.log('[FRONTEND] Analytics received:', {
        totalGoals: data.goals?.length,
        active: data.summary?.active,
        achieved: data.summary?.achieved,
        overdue: data.summary?.overdue,
        upcomingDeadlines: data.upcomingDeadlines?.length,
        timelineGoals: data.timelineGoals?.length,
      });
      setGoals(data.goals || []);
      setAnalytics(data);
    } catch (err) {
      console.error('[FRONTEND] Analytics fetch failed, falling back to getAll:', err);
      try {
        const res = await goalAPI.getAll();
        console.log('[FRONTEND] Goals fallback received:', res.data?.length, 'goals');
        setGoals(res.data || []);
        setAnalytics(null);
      } catch (err2) {
        console.error('[FRONTEND] Goals fetch also failed:', err2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  useEffect(() => {
    if (detailGoal) {
      const updated = goals.find(g => g._id === detailGoal._id);
      if (updated) setDetailGoal(updated);
    }
  }, [goals, detailGoal]);

  const openCreate = () => { setForm(emptyForm); setEditGoal(null); setShowForm(true); };
  const openEdit = (g) => {
    setForm({
      goalName: g.goalName || '',
      category: g.category || 'Emergency Fund',
      targetAmount: String(g.targetAmount || ''),
      savedAmount: String(g.savedAmount || 0),
      monthlySaving: String(g.monthlySaving || 0),
      targetDate: g.targetDate ? new Date(g.targetDate).toISOString().split('T')[0] : '',
      priority: g.priority || 'medium',
    });
    setEditGoal(g);
    setShowForm(true);
  };

  const handleSave = async (data) => {
    console.log('[FRONTEND] Saving goal:', data, 'editGoal:', editGoal ? editGoal._id : 'new');
    try {
      if (editGoal) {
        const res = await goalAPI.update(editGoal._id, data);
        console.log('[FRONTEND] Goal updated:', res.data?.goalName, 'status:', res.data?.status, 'priority:', res.data?.priority);
      } else {
        const res = await goalAPI.create(data);
        console.log('[FRONTEND] Goal created:', res.data?.goalName, 'status:', res.data?.status);
      }
      setShowForm(false);
      setEditGoal(null);
      await fetchGoals();
      refreshHealth();
      console.log('[FRONTEND] Data refreshed after save');
    } catch (err) {
      console.error('[FRONTEND] Save failed:', err);
      throw err;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    try {
      console.log('[FRONTEND] Deleting goal:', id);
      await goalAPI.delete(id);
      console.log('[FRONTEND] Goal deleted, refreshing data...');
      await fetchGoals();
      refreshHealth();
      console.log('[FRONTEND] Data refreshed after delete');
    } catch (err) {
      console.error('[FRONTEND] Delete failed:', err);
    }
  };

  const handleAddContribution = async (goalId, data) => {
    console.log('[FRONTEND] Adding contribution to goal:', goalId, data);
    try {
      const res = await goalAPI.addContribution(goalId, data);
      console.log('[FRONTEND] Contribution added, goal saved:', res.data?.savedAmount, 'status:', res.data?.status);
      await fetchGoals();
      refreshHealth();
      console.log('[FRONTEND] Data refreshed after contribution');
    } catch (err) {
      console.error('[FRONTEND] Contribution failed:', err.response?.status, err.response?.data || err.message);
      throw err;
    }
  };

  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      if (filterPriority !== 'all' && g.priority !== filterPriority) return false;
      if (filterStatus !== 'all' && g.status !== filterStatus) return false;
      if (filterCategory !== 'all' && g.category !== filterCategory) return false;
      return true;
    });
  }, [goals, filterPriority, filterStatus, filterCategory]);

  const isGoalCompleted = useCallback((g) => {
    return g.status === 'achieved';
  }, []);

  const isGoalOverdue = useCallback((g) => {
    return g.status === 'overdue';
  }, []);

  const isGoalActive = useCallback((g) => {
    return g.status === 'active';
  }, []);

  const stats = useMemo(() => {
    if (analytics && analytics.summary) {
      console.log('[FRONTEND] Using server-side stats:', analytics.summary);
      return analytics.summary;
    }
    console.log('[FRONTEND] Computing client-side stats from', goals.length, 'goals');
    const total = goals.length;
    const active = goals.filter(g => isGoalActive(g)).length;
    const achieved = goals.filter(g => isGoalCompleted(g)).length;
    const overdue = goals.filter(g => isGoalOverdue(g)).length;
    const paused = goals.filter(g => g.status === 'paused').length;
    const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
    const remaining = Math.max(totalTarget - totalSaved, 0);
    const completionPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
      const upcomingDeadlines = goals.filter(g => {
        if (!isGoalActive(g) && !isGoalOverdue(g)) return false;
        if (!g.targetDate) return false;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const td = new Date(g.targetDate);
        const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate());
        const daysLeft = Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24));
        return daysLeft >= -30 && daysLeft <= 30;
      }).length;
    return { total, active, achieved, overdue, paused, totalTarget, totalSaved, remaining, completionPct, upcomingDeadlines };
  }, [goals, analytics, isGoalActive, isGoalCompleted, isGoalOverdue]);

  const categoryDistribution = useMemo(() => {
    if (analytics && analytics.categoryDistribution) {
      return analytics.categoryDistribution;
    }
    const map = {};
    goals.forEach(g => {
      if (!map[g.category]) map[g.category] = 0;
      map[g.category] += g.targetAmount || 0;
    });
    return Object.entries(map).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
  }, [goals, analytics]);

  const doughnutData = useMemo(() => {
    if (categoryDistribution.length === 0) return null;
    return {
      labels: categoryDistribution.map(d => d.category),
      datasets: [{
        data: categoryDistribution.map(d => d.value),
        backgroundColor: categoryDistribution.map(d => (CATEGORY_COLORS[d.category] || '#6B7280') + 'CC'),
        borderColor: '#111827', borderWidth: 3, hoverOffset: 6,
      }],
    };
  }, [categoryDistribution]);

  const monthlyChartData = useMemo(() => {
    if (analytics && analytics.monthlyData) {
      return {
        labels: analytics.monthlyData.map(d => d.label),
        datasets: [
          {
            label: 'Actual Contributions',
            data: analytics.monthlyData.map(d => d.actual),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: '#10B981',
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Planned Savings',
            data: analytics.monthlyData.map(d => d.planned),
            backgroundColor: 'rgba(59, 130, 246, 0.35)',
            borderColor: '#3B82F6',
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
            borderDash: [4, 4],
          },
        ],
      };
    }
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    const actualData = [];
    const plannedData = [];
    for (let offset = 11; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      labels.push(`${months[m]}${y !== now.getFullYear() ? ' ' + y : ''}`);
      let monthActual = 0;
      let monthPlanned = 0;
      goals.forEach(g => {
        const contribs = (g.contributions || []).filter(c => {
          const cd = new Date(c.date);
          return cd.getMonth() === m && cd.getFullYear() === y;
        });
        monthActual += contribs.reduce((s, c) => s + c.amount, 0);
        if (g.status === 'active' || g.status === 'overdue') {
          const goalCreated = new Date(g.createdAt || 0);
          if (y > goalCreated.getFullYear() || (y === goalCreated.getFullYear() && m >= goalCreated.getMonth())) {
            monthPlanned += g.monthlySaving || 0;
          }
        }
      });
      actualData.push(monthActual);
      plannedData.push(monthPlanned);
    }
    return {
      labels,
      datasets: [
        {
          label: 'Actual Contributions',
          data: actualData,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: '#10B981',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Planned Savings',
          data: plannedData,
          backgroundColor: 'rgba(59, 130, 246, 0.35)',
          borderColor: '#3B82F6',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
          borderDash: [4, 4],
        },
      ],
    };
  }, [goals, analytics]);

  const monthlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } },
      tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 }, maxRotation: 45 } },
      y: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 11 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
    },
  };

  const timelineGoals = useMemo(() => {
    if (analytics && analytics.timelineGoals && analytics.timelineGoals.length > 0) {
      return analytics.timelineGoals;
    }
    return [...goals]
      .filter(g => (isGoalActive(g) || isGoalOverdue(g)) && g.targetDate)
      .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
      .slice(0, 6);
  }, [goals, analytics, isGoalActive, isGoalOverdue]);

  const upcomingDeadlines = useMemo(() => {
    if (analytics && analytics.upcomingDeadlines && analytics.upcomingDeadlines.length > 0) {
      return analytics.upcomingDeadlines;
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return goals
      .filter(g => {
        if (!isGoalActive(g) && !isGoalOverdue(g)) return false;
        if (!g.targetDate) return false;
        const td = new Date(g.targetDate);
        const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate());
        const daysLeft = Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24));
        return daysLeft >= -30 && daysLeft <= 30;
      })
      .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
  }, [goals, analytics, isGoalActive, isGoalOverdue]);

  const recommendations = useMemo(() => {
    if (analytics && analytics.recommendations && analytics.recommendations.length > 0) {
      return analytics.recommendations;
    }
    const recs = [];
    const attentionGoals = goals.filter(g => isGoalActive(g) || isGoalOverdue(g));
    if (goals.length === 0) {
      recs.push({ priority: 'good', text: 'Create your first financial goal to start planning your future.' });
      return recs;
    }
    const overdueGoals = goals.filter(g => isGoalOverdue(g));
    overdueGoals.forEach(g => {
      const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
      recs.push({ priority: 'critical', text: `"${g.goalName}" is overdue! ${fmt(remaining)} still needed. Consider extending the deadline or increasing contributions.` });
    });
    attentionGoals.forEach(g => {
      if (isGoalOverdue(g)) return;
      const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
      const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
      const monthsLeft = g.targetDate ? (() => { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const td = new Date(g.targetDate); const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate()); return Math.max(1, Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24 * 30))); })() : 12;
      const neededMonthly = remaining / monthsLeft;
      if (pct < 30 && g.priority === 'high') {
        recs.push({ priority: 'critical', text: `"${g.goalName}" is high-priority with only ${Math.round(pct)}% progress. Save at least ${fmt(neededMonthly)}/month to stay on track.` });
      } else if (g.monthlySaving > 0 && neededMonthly > g.monthlySaving * 1.5) {
        recs.push({ priority: 'moderate', text: `"${g.goalName}" needs ${fmt(neededMonthly)}/month but you save ${fmt(g.monthlySaving)}/month. Increase by ${fmt(neededMonthly - g.monthlySaving)} or extend the deadline.` });
      } else if (pct >= 100) {
        recs.push({ priority: 'good', text: `"${g.goalName}" is complete! Redirect ${fmt(g.monthlySaving)}/month to other active goals.` });
      }
    });
    const emergency = attentionGoals.find(g => g.category === 'Emergency Fund');
    if (emergency && emergency.savedAmount < emergency.targetAmount * 0.5) {
      recs.push({ priority: 'critical', text: 'Emergency Fund should be your highest priority. Aim for 3-6 months of expenses.' });
    }
    if (attentionGoals.length > 3) {
      recs.push({ priority: 'moderate', text: `You have ${attentionGoals.length} goals needing attention. Focus on 2-3 high-priority goals to avoid spreading savings too thin.` });
    }
    return recs.slice(0, 5);
  }, [goals, analytics, isGoalActive, isGoalOverdue]);

  const achievements = useMemo(() => {
    if (analytics && analytics.achievements && analytics.achievements.length > 0) {
      return analytics.achievements;
    }
    const list = [];
    const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
    const completedCount = goals.filter(g => isGoalCompleted(g)).length;
    const totalContribs = goals.reduce((s, g) => s + (g.contributions || []).length, 0);
    list.push({ icon: '🎯', title: 'First Goal', desc: 'Created your first goal', unlocked: goals.length > 0 });
    list.push({ icon: '💰', title: `Saved ${fmt(50000)}`, desc: `Accumulated ${fmt(50000)}`, unlocked: totalSaved >= 50000 });
    list.push({ icon: '🏆', title: 'First Achievement', desc: 'Completed first goal', unlocked: completedCount >= 1 });
    list.push({ icon: '📊', title: '10 Contributions', desc: 'Made 10 contributions', unlocked: totalContribs >= 10 });
    list.push({ icon: '👑', title: 'Goal Master', desc: 'Completed 3+ goals', unlocked: completedCount >= 3 });
    list.push({ icon: '💎', title: `Saved ${fmt(100000)}`, desc: `Accumulated ${fmt(100000)}`, unlocked: totalSaved >= 100000 });
    return list;
  }, [goals, analytics, isGoalCompleted]);

  if (loading) return <Layout title="Financial Goal Planning"><LoadingSpinner text="Loading financial goals..." /></Layout>;

  return (
    <Layout title="Financial Goal Planning">
      <div style={s.topBar}>
        <h3 style={s.subtitle}>Plan, track, and achieve your financial goals</h3>
        <Button variant="primary" onClick={openCreate}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Icon path={icons.plus} size={16} /> New Goal</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={s.statsGrid}>
        <SummaryCard icon={icons.target} amount={stats.total} label="Total Goals" color="var(--accent)" delay="0s" />
        <SummaryCard icon={icons.activity} amount={stats.active} label="Active Goals" color="var(--success)" delay="0.04s" />
        <SummaryCard icon={icons.check} amount={stats.achieved} label="Completed" color="var(--purple)" delay="0.08s" />
        <SummaryCard icon={icons.alertCircle} amount={stats.overdue} label="Overdue" color="var(--danger)" delay="0.1s" />
        <SummaryCard icon={icons.trendingUp} amount={fmt(stats.totalTarget)} label="Total Target" color="var(--accent)" delay="0.12s" />
        <SummaryCard icon={icons.savings} amount={fmt(stats.totalSaved)} label="Total Saved" color="var(--success)" delay="0.16s" />
        <SummaryCard icon={icons.pieChart} amount={`${stats.completionPct}%`} label="Overall Progress" color="var(--warning)" delay="0.2s" />
      </div>

      {/* Financial Summary + Distribution */}
      <div style={s.twoCol}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={16} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Financial Summary</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            {[
              { label: 'Total Target', value: fmt(stats.totalTarget), color: 'var(--text-primary)' },
              { label: 'Total Saved', value: fmt(stats.totalSaved), color: 'var(--success)' },
              { label: 'Remaining', value: fmt(stats.remaining), color: 'var(--warning)' },
              { label: 'Upcoming Deadlines', value: stats.upcomingDeadlines, color: stats.upcomingDeadlines > 0 ? 'var(--danger)' : 'var(--text-primary)' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '12px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>{item.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 7, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${stats.completionPct}%`, background: 'var(--accent)', transition: 'width 0.8s ease' }} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={16} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Goal Distribution</h2>
          </div>
          {doughnutData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } } } }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1 }}>
                {categoryDistribution.slice(0, 5).map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORY_COLORS[d.category] || '#6B7280', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)', flex: 1 }}>{d.category}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No goals to display</div>
          )}
        </Card>
      </div>

      {/* Filters */}
      <div style={s.filterBar}>
        <style>{`
          .goal-filter-select option { background: #1E293B; color: #F1F5F9; padding: 8px 12px; }
          .goal-filter-select option:hover { background: #334155; }
          [data-theme="light"] .goal-filter-select option { background: #FFFFFF; color: #0F172A; }
          [data-theme="light"] .goal-filter-select option:hover { background: #F1F5F9; }
        `}</style>
        <div>
          <div style={s.filterLabel}>Priority</div>
          <select className="goal-filter-select" style={s.filterSelect} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="all">All Priorities</option>
            {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <div style={s.filterLabel}>Status</div>
          <select className="goal-filter-select" style={s.filterSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
          </select>
        </div>
        <div>
          <div style={s.filterLabel}>Category</div>
          <select className="goal-filter-select" style={s.filterSelect} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        {(filterPriority !== 'all' || filterStatus !== 'all' || filterCategory !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={() => { setFilterPriority('all'); setFilterStatus('all'); setFilterCategory('all'); }}
              style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger-light)', cursor: 'pointer', fontWeight: 600 }}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Goal Cards */}
      {filteredGoals.length === 0 ? (
        <EmptyState icon={icons.target} title="No financial goals found" description="Create your first financial goal to start planning your future" action={<Button variant="primary" onClick={openCreate}>Create Goal</Button>} />
      ) : (
        <div style={s.goalsGrid}>
          {filteredGoals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100) : 0;
            const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
            const color = CATEGORY_COLORS[g.category] || '#3B82F6';
            const daysLeft = g.targetDate ? (() => { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const td = new Date(g.targetDate); const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate()); return Math.max(0, Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24))); })() : null;
            const monthsLeft = g.targetDate ? (() => { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const td = new Date(g.targetDate); const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate()); return Math.max(0, Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24 * 30))); })() : null;
            const requiredMonthly = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
            const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === g.priority) || PRIORITY_OPTIONS[1];
            const isAchieved = isGoalCompleted(g);
            const isOverdue = isGoalOverdue(g);
            const isBehind = !isAchieved && !isOverdue && isGoalActive(g) && g.monthlySaving > 0 && requiredMonthly > g.monthlySaving * 1.3;
            const prediction = computeGoalPrediction(g);
            const recommendedPriority = computeRecommendedPriority(g);
            const recommendedOpt = PRIORITY_OPTIONS.find(p => p.value === recommendedPriority);
            const showRecommendation = isGoalActive(g) && g.priority !== recommendedPriority;

            return (
              <div key={`${g._id}-${g.priority}-${g.updatedAt}`} style={{ ...s.goalCard, cursor: 'pointer' }} onClick={() => setDetailGoal(g)}>
                <div style={s.goalHeader}>
                  <div style={{ ...s.goalIconWrap, background: `${color}18` }}>
                    <Icon path={CATEGORY_ICONS[g.category] || icons.target} size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.goalName}>{g.goalName}</div>
                    <div style={s.goalCategory}>{g.category}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge color={priorityOpt.color}>{priorityOpt.label}</Badge>
                    <Badge color={PREDICTION_COLORS[prediction] || 'info'}>{prediction}</Badge>
                    {isBehind && !isAchieved && <Badge color="warning">Behind</Badge>}
                    {showRecommendation && (
                      <Badge color={recommendedOpt?.color || 'info'} title={`Recommended: ${recommendedOpt?.label}`}>
                        {recommendedOpt?.label} rec.
                      </Badge>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{pct}% complete</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{fmt(g.savedAmount)} / {fmt(g.targetAmount)}</span>
                </div>
                <div style={s.progressTrack}>
                  <div style={{ ...s.progressFill, width: `${pct}%`, background: isAchieved ? 'var(--success)' : isOverdue ? 'var(--danger)' : color }} />
                </div>

                <div style={s.goalStats}>
                  <div style={s.goalStatItem}>
                    <span style={s.goalStatLabel}>Remaining</span>
                    <span style={{ ...s.goalStatValue, color: isAchieved ? 'var(--success)' : 'var(--text-primary)' }}>{fmt(remaining)}</span>
                  </div>
                  <div style={s.goalStatItem}>
                    <span style={s.goalStatLabel}>Monthly Saving</span>
                    <span style={s.goalStatValue}>{fmt(g.monthlySaving)}</span>
                  </div>
                  <div style={s.goalStatItem}>
                    <span style={s.goalStatLabel}>Required/Month</span>
                    <span style={{ ...s.goalStatValue, color: isBehind ? 'var(--danger)' : 'var(--text-primary)' }}>{fmt(requiredMonthly)}</span>
                  </div>
                  <div style={s.goalStatItem}>
                    <span style={s.goalStatLabel}>Days Left</span>
                    <span style={{ ...s.goalStatValue, color: isOverdue ? 'var(--danger)' : daysLeft !== null && daysLeft < 30 ? 'var(--warning)' : 'var(--text-primary)' }}>
                      {isAchieved ? 'Done' : isOverdue ? 'Overdue' : daysLeft !== null ? `${daysLeft} days` : '—'}
                    </span>
                  </div>
                  <div style={s.goalStatItem}>
                    <span style={s.goalStatLabel}>Target Date</span>
                    <span style={s.goalStatValue}>{g.targetDate ? new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</span>
                  </div>
                  <div style={s.goalStatItem}>
                    <span style={s.goalStatLabel}>Contributions</span>
                    <span style={s.goalStatValue}>{(g.contributions || []).length}</span>
                  </div>
                </div>

                <div style={s.goalActions} onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Icon path={icons.edit} size={13} /> Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setDetailGoal(g); }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Icon path={icons.eye} size={13} /> View</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(g._id)}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger-light)' }}><Icon path={icons.trash} size={13} /></span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Analytics + Timeline */}
      {goals.length > 0 && (
        <div style={s.twoCol}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.barChart} size={16} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Goal Analytics</h2>
            </div>
            {goals.map((g) => {
              const pct = g.targetAmount > 0 ? Math.min((g.savedAmount / g.targetAmount) * 100, 100) : 0;
              const color = CATEGORY_COLORS[g.category] || '#3B82F6';
              return (
                <div key={g._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '110px', flexShrink: 0 }}>{g.goalName}</span>
                  <div style={{ flex: 1, height: 9, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: color, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '40px', textAlign: 'right' }}>{Math.round(pct)}%</span>
                </div>
              );
            })}
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.clock} size={16} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Goal Timeline</h2>
            </div>
            {timelineGoals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active goals</div>
            ) : timelineGoals.map((g) => {
              const pct = g.targetAmount > 0 ? Math.min((g.savedAmount / g.targetAmount) * 100, 100) : 0;
              const color = CATEGORY_COLORS[g.category] || '#3B82F6';
              const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
              const daysLeft = g.targetDate ? (() => { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const td = new Date(g.targetDate); const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate()); return Math.max(0, Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24))); })() : null;
              const isDueSoon = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
              return (
                <div key={g._id} style={{ ...s.timelineRow, flexDirection: 'column', alignItems: 'stretch', gap: '6px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{g.goalName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isDueSoon && <Badge color="danger" dot>Due Soon</Badge>}
                      <Badge color={PREDICTION_COLORS[computeGoalPrediction(g)] || 'info'}>{computeGoalPrediction(g)}</Badge>
                      {g.priority === 'high' && <Badge color="danger">High</Badge>}
                      {g.priority === 'medium' && <Badge color="warning">Medium</Badge>}
                      {g.priority === 'low' && <Badge color="info">Low</Badge>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={s.timelineTrack}>
                      <div style={{ ...s.timelineFill, width: `${Math.max(pct, 5)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}>
                        {pct > 15 && <span style={s.timelineText}>{Math.round(pct)}%</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Target: {g.targetDate ? new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</span>
                    <span style={{ color: daysLeft !== null && daysLeft < 30 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {daysLeft !== null ? `${daysLeft} days left` : '—'}
                    </span>
                    <span style={{ fontWeight: 600 }}>{fmt(g.savedAmount)} / {fmt(g.targetAmount)}</span>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Upcoming Deadlines */}
      {goals.length > 0 && (
        <Card style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.bell} size={16} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Upcoming Deadlines</h2>
            {upcomingDeadlines.length > 0 && (
              <Badge color="danger">{upcomingDeadlines.length} goal{upcomingDeadlines.length !== 1 ? 's' : ''}</Badge>
            )}
          </div>
          {upcomingDeadlines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.6 }}>📅</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No upcoming deadlines</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>All your active goals have target dates beyond the next 30 days.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Goal Name', 'Target Date', 'Days Remaining', 'Remaining Amount', 'Priority'].map(h => (
                      <th key={h} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcomingDeadlines.map((g) => {
                    const daysLeft = (() => { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const td = new Date(g.targetDate); const targetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate()); return Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24)); })();
                    const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
                    const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === g.priority) || PRIORITY_OPTIONS[1];
                    const isUrgent = daysLeft <= 7;
                    return (
                      <tr key={g._id} style={{ transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[g.category] || '#3B82F6', flexShrink: 0 }} />
                            {g.goalName}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                          {new Date(g.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                          <span style={{
                            fontSize: '0.85rem', fontWeight: 700,
                            color: isUrgent ? 'var(--danger)' : daysLeft <= 14 ? 'var(--warning)' : 'var(--text-primary)',
                          }}>
                            {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                          {fmt(remaining)}
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                          <Badge color={priorityOpt.color}>{priorityOpt.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Contributions Chart + Recommendations */}
      {goals.length > 0 && (
        <div style={s.twoCol}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.barChart} size={16} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Monthly Contributions</h2>
            </div>
            <div style={{ height: 260 }}>
              <Bar data={monthlyChartData} options={monthlyChartOptions} />
            </div>
          </Card>

          {recommendations.length > 0 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.brain} size={16} />
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Smart Recommendations</h2>
              </div>
              {recommendations.map((rec, i) => (
                <div key={i} style={s.recItem}>
                  <div style={{ ...s.recDot, background: rec.priority === 'critical' ? 'var(--danger)' : rec.priority === 'moderate' ? 'var(--warning)' : 'var(--success)' }} />
                  <div style={s.recText}>{rec.text}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Achievements */}
      {goals.length > 0 && (
        <Card style={{ marginBottom: '28px' }}>
          <h3 style={s.sectionTitle}>Achievements</h3>
          <div style={s.achievementGrid}>
            {achievements.map((a, i) => (
              <div key={i} style={{ ...s.achievementItem, ...(a.unlocked ? {} : { opacity: 0.4, filter: 'grayscale(1)' }) }}>
                <span style={s.achievementIcon}>{a.unlocked ? a.icon : '🔒'}</span>
                <div style={s.achievementText}>
                  <span style={s.achievementTitle}>{a.title}</span>
                  <span style={s.achievementDesc}>{a.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Form Modal */}
      {showForm && <GoalForm form={form} setForm={setForm} onSave={handleSave} onClose={() => { setShowForm(false); setEditGoal(null); }} />}

      {/* Detail Modal */}
      <GoalDetailModal show={!!detailGoal} onClose={() => setDetailGoal(null)} goal={detailGoal} onAddContribution={handleAddContribution} />
    </Layout>
  );
}
