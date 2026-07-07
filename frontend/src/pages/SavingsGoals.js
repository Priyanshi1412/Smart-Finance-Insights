import { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const CATEGORIES = [
  { value: 'Emergency Fund', label: 'Emergency Fund' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Education', label: 'Education' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Vehicle', label: 'Vehicle' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Wedding', label: 'Wedding' },
  { value: 'Retirement', label: 'Retirement' },
  { value: 'Health', label: 'Health' },
  { value: 'Shopping', label: 'Shopping' },
  { value: 'Other', label: 'Other' },
];

const CATEGORY_ICONS = {
  'Emergency Fund': icons.shield,
  'Travel': icons.send,
  'Education': icons.barChart,
  'Technology': icons.creditCard,
  'Vehicle': icons.wallet,
  'Real Estate': icons.dashboard,
  'Wedding': icons.savings,
  'Retirement': icons.target,
  'Health': icons.activity,
  'Shopping': icons.piggyBank,
  'Other': icons.target,
};

const CATEGORY_COLORS = {
  'Emergency Fund': 'var(--success)',
  'Travel': 'var(--accent)',
  'Education': 'var(--purple)',
  'Technology': 'var(--teal)',
  'Vehicle': 'var(--warning)',
  'Real Estate': 'var(--danger)',
  'Wedding': 'var(--purple-light)',
  'Retirement': 'var(--accent-dark)',
  'Health': 'var(--success-light)',
  'Shopping': 'var(--warning-light)',
  'Other': 'var(--text-muted)',
};

const emptyForm = { goalName: '', category: '', targetAmount: '', savedAmount: '0', monthlySaving: '0', targetDate: '' };

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
  goalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px', marginBottom: '28px' },
  goalCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    padding: '22px', backdropFilter: 'blur(12px)', transition: 'all var(--transition-base)',
    animation: 'fadeIn 0.4s ease-out', position: 'relative', overflow: 'hidden',
  },
  goalHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' },
  goalIconWrap: {
    width: 48, height: 48, borderRadius: 'var(--radius-md)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  goalName: { fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.2 },
  goalCategory: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' },
  progressTrack: { height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: '14px' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' },
  goalStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '14px' },
  goalStatItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  goalStatLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  goalStatValue: { fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' },
  goalActions: { display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' },
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
  analyticsRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' },
  analyticsLabel: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '120px', flexShrink: 0 },
  analyticsTrack: { flex: 1, height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' },
  analyticsPct: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '44px', textAlign: 'right' },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px', marginBottom: '28px' },
  achievementGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
  achievementItem: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
    borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
    transition: 'all var(--transition-fast)',
  },
  achievementIcon: { fontSize: '1.5rem', flexShrink: 0 },
  achievementText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  achievementTitle: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' },
  achievementDesc: { fontSize: '0.72rem', color: 'var(--text-muted)' },
  recItem: {
    display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px',
    borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
    marginBottom: '8px',
  },
  recDot: { width: 8, height: 8, borderRadius: '50%', marginTop: '6px', flexShrink: 0 },
  recText: { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 },
  timelineRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' },
  timelineLabel: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '130px', flexShrink: 0 },
  timelineTrack: { flex: 1, height: 22, borderRadius: 'var(--radius-sm)', background: 'var(--border)', overflow: 'hidden', position: 'relative' },
  timelineFill: { height: '100%', borderRadius: 'var(--radius-sm)', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' },
  timelineText: { fontSize: '0.7rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' },
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

function GoalCard({ goal, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const pct = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0);
  const color = CATEGORY_COLORS[goal.category] || 'var(--accent)';
  const icon = CATEGORY_ICONS[goal.category] || icons.target;
  const targetDate = new Date(goal.targetDate);
  const now = new Date();
  const daysRemaining = Math.max(Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24)), 0);
  const monthsRemaining = goal.monthlySaving > 0 ? Math.ceil(remaining / goal.monthlySaving) : null;
  const expectedMonth = monthsRemaining !== null
    ? new Date(now.getFullYear(), now.getMonth() + monthsRemaining, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'N/A';
  const isCompleted = pct >= 100;
  const isDueSoon = daysRemaining <= 30 && daysRemaining > 0 && !isCompleted;

  return (
    <div
      style={{
        ...s.goalCard,
        ...(hover ? { borderColor: color, boxShadow: `0 8px 32px ${color}15`, transform: 'translateY(-2px)' } : {}),
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {isCompleted && (
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <Badge color="success" dot>Completed</Badge>
        </div>
      )}
      {isDueSoon && !isCompleted && (
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <Badge color="danger" dot>Due Soon</Badge>
        </div>
      )}

      <div style={s.goalHeader}>
        <div style={{ ...s.goalIconWrap, background: `${color}18` }}>
          <Icon path={icon} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.goalName}>{goal.goalName}</div>
          <div style={s.goalCategory}>{goal.category}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
        <ProgressRing percent={pct} size={80} strokeWidth={6} color={color} />
        <div style={{ flex: 1 }}>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: `${pct}%`, background: color }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmt(goal.savedAmount)} saved</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmt(goal.targetAmount)} target</span>
          </div>
        </div>
      </div>

      <div style={s.goalStats}>
        <div style={s.goalStatItem}>
          <span style={s.goalStatLabel}>Remaining</span>
          <span style={{ ...s.goalStatValue, color: isCompleted ? 'var(--success)' : 'var(--text-primary)' }}>{fmt(remaining)}</span>
        </div>
        <div style={s.goalStatItem}>
          <span style={s.goalStatLabel}>Monthly Saving</span>
          <span style={s.goalStatValue}>{fmt(goal.monthlySaving)}</span>
        </div>
        <div style={s.goalStatItem}>
          <span style={s.goalStatLabel}>Target Date</span>
          <span style={s.goalStatValue}>{targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <div style={s.goalStatItem}>
          <span style={s.goalStatLabel}>Days Left</span>
          <span style={{ ...s.goalStatValue, color: isDueSoon ? 'var(--danger)' : daysRemaining === 0 ? 'var(--success)' : 'var(--text-primary)' }}>
            {isCompleted ? 'Done' : `${daysRemaining} days`}
          </span>
        </div>
        <div style={s.goalStatItem}>
          <span style={s.goalStatLabel}>Expected By</span>
          <span style={s.goalStatValue}>{expectedMonth}</span>
        </div>
        <div style={s.goalStatItem}>
          <span style={s.goalStatLabel}>Progress</span>
          <span style={{ ...s.goalStatValue, color }}>{Math.round(pct)}%</span>
        </div>
      </div>

      <div style={s.goalActions}>
        <Button variant="secondary" size="sm" onClick={() => onEdit(goal)}>
          <Icon path={icons.edit} size={14} /> Edit
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(goal._id)}>
          <Icon path={icons.trash} size={14} /> Delete
        </Button>
      </div>
    </div>
  );
}

function GoalModal({ show, onClose, onSave, editGoal }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editGoal) {
      setForm({
        goalName: editGoal.goalName || '',
        category: editGoal.category || '',
        targetAmount: editGoal.targetAmount || '',
        savedAmount: editGoal.savedAmount || 0,
        monthlySaving: editGoal.monthlySaving || 0,
        targetDate: editGoal.targetDate ? new Date(editGoal.targetDate).toISOString().split('T')[0] : '',
      });
    } else {
      setForm(emptyForm);
    }
    setError('');
  }, [editGoal, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.goalName || !form.category || !form.targetAmount || !form.targetDate) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        goalName: form.goalName,
        category: form.category,
        targetAmount: Number(form.targetAmount),
        savedAmount: Number(form.savedAmount || 0),
        monthlySaving: Number(form.monthlySaving || 0),
        targetDate: form.targetDate,
      });
      setForm(emptyForm);
      setError('');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save goal. Make sure the backend server is running.';
      setError(msg);
      console.error('Goal save error:', err);
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
        <div style={s.modalTitle}>{editGoal ? 'Edit Goal' : 'Create New Goal'}</div>
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
            label="Goal Name" placeholder="e.g. New Car" required
            value={form.goalName} onChange={(e) => setForm({ ...form, goalName: e.target.value })}
          />
          <Select
            label="Category" required
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={[{ value: '', label: 'Select category...' }, ...CATEGORIES]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Input
              label="Target Amount" type="number" placeholder="0" required
              value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
            />
            <Input
              label="Already Saved" type="number" placeholder="0"
              value={form.savedAmount} onChange={(e) => setForm({ ...form, savedAmount: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Input
              label="Monthly Saving" type="number" placeholder="0"
              value={form.monthlySaving} onChange={(e) => setForm({ ...form, monthlySaving: e.target.value })}
            />
            <Input
              label="Target Date" type="date" required
              value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
          </div>
          <div style={s.modalActions}>
            <Button variant="ghost" onClick={handleClose} type="button">Cancel</Button>
            <Button type="submit" loading={loading}>{editGoal ? 'Update Goal' : 'Create Goal'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SavingsGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await goalAPI.getAll();
      setGoals(res.data);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleSave = async (data) => {
    if (editGoal) {
      const res = await goalAPI.update(editGoal._id, data);
      setGoals((prev) => prev.map((g) => (g._id === editGoal._id ? res.data : g)));
    } else {
      const res = await goalAPI.create(data);
      setGoals((prev) => [res.data, ...prev]);
    }
    setShowModal(false);
    setEditGoal(null);
  };

  const handleEdit = (goal) => {
    setEditGoal(goal);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    try {
      await goalAPI.delete(id);
      setGoals((prev) => prev.filter((g) => g._id !== id));
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const stats = useMemo(() => {
    const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
    const remaining = Math.max(totalTarget - totalSaved, 0);
    const completed = goals.filter((g) => g.targetAmount > 0 && (g.savedAmount / g.targetAmount) * 100 >= 100).length;
    return { totalTarget, totalSaved, remaining, completed, total: goals.length };
  }, [goals]);

  const priorityGoal = useMemo(() => {
    const now = new Date();
    const active = goals
      .filter((g) => {
        const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
        return pct < 100 && new Date(g.targetDate) > now;
      })
      .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
    return active[0] || null;
  }, [goals]);

  const recommendations = useMemo(() => {
    const recs = [];
    if (goals.length === 0) {
      recs.push({ color: 'var(--accent)', text: 'Create your first savings goal to start tracking your financial progress.' });
      return recs;
    }
    const emergency = goals.find((g) => g.category === 'Emergency Fund');
    if (emergency && emergency.savedAmount < emergency.targetAmount * 0.5) {
      recs.push({ color: 'var(--warning)', text: 'Emergency Fund should be your highest priority. Aim for 3-6 months of expenses.' });
    }
    const highPctGoals = goals.filter((g) => {
      const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
      return pct >= 70 && pct < 100;
    });
    highPctGoals.forEach((g) => {
      const remaining = g.targetAmount - g.savedAmount;
      if (g.monthlySaving > 0) {
        const months = Math.ceil(remaining / g.monthlySaving);
        recs.push({ color: 'var(--success)', text: `${g.goalName} is almost there! Increase monthly savings by ${fmt(Math.ceil(remaining / Math.max(months - 1, 1)) - g.monthlySaving)} to complete it sooner.` });
      }
    });
    const overdue = goals.filter((g) => {
      const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
      return pct < 100 && new Date(g.targetDate) < new Date();
    });
    overdue.forEach((g) => {
      recs.push({ color: 'var(--danger)', text: `${g.goalName} has passed its target date. Consider extending the deadline or increasing contributions.` });
    });
    const consistent = goals.filter((g) => g.monthlySaving > 0 && g.savedAmount > 0).length;
    if (consistent >= 2) {
      recs.push({ color: 'var(--teal)', text: 'You are saving consistently across multiple goals. Keep up the great discipline!' });
    }
    const lowSaving = goals.filter((g) => {
      const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
      return pct < 30 && g.monthlySaving > 0;
    });
    lowSaving.forEach((g) => {
      recs.push({ color: 'var(--purple)', text: `${g.goalName} needs attention. Consider reducing entertainment expenses to reach your goal faster.` });
    });
    if (recs.length === 0) {
      recs.push({ color: 'var(--success)', text: 'You are on track with all your goals. Keep up the excellent work!' });
    }
    return recs.slice(0, 5);
  }, [goals]);

  const achievements = useMemo(() => {
    const list = [];
    const hasAny = goals.length > 0;
    const totalSavedAll = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
    const completedCount = goals.filter((g) => g.targetAmount > 0 && (g.savedAmount / g.targetAmount) * 100 >= 100).length;
    const hasStreak = goals.filter((g) => g.monthlySaving > 0).length >= 2;

    list.push({ icon: '🎯', title: 'First Goal Created', desc: 'Created your first savings goal', unlocked: hasAny });
    list.push({ icon: '💰', title: `Saved ${fmt(50000)}`, desc: `Accumulated ${fmt(50000)} in savings`, unlocked: totalSavedAll >= 50000 });
    list.push({ icon: '🏆', title: 'First Goal Completed', desc: 'Completed your first savings goal', unlocked: completedCount >= 1 });
    list.push({ icon: '⭐', title: '5 Month Streak', desc: 'Saving consistently for 5 months', unlocked: hasStreak });
    list.push({ icon: '👑', title: 'Goal Master', desc: 'Completed 3 or more goals', unlocked: completedCount >= 3 });
    list.push({ icon: '💎', title: `Saved ${fmt(100000)}`, desc: `Accumulated ${fmt(100000)} in total savings`, unlocked: totalSavedAll >= 100000 });
    return list;
  }, [goals]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    return months.slice(0, now.getMonth() + 1).map((m, i) => ({
      name: m,
      savings: goals.reduce((sum, g) => {
        if (i < now.getMonth()) return sum + (g.monthlySaving || 0);
        if (i === now.getMonth()) return sum + (g.savedAmount || 0) % (g.monthlySaving || 1);
        return sum;
      }, 0),
    }));
  }, [goals]);

  const timelineGoals = useMemo(() => {
    return [...goals]
      .sort((a, b) => (a.targetAmount - a.savedAmount) - (b.targetAmount - b.savedAmount))
      .slice(0, 6);
  }, [goals]);

  const openNewGoal = () => {
    setEditGoal(null);
    setShowModal(true);
  };

  if (loading) {
    return (
      <Layout title="Savings Goals">
        <LoadingSpinner text="Loading goals..." />
      </Layout>
    );
  }

  return (
    <Layout title="Savings Goals">
      <div style={s.topBar}>
        <div>
          <h3 style={s.subtitle}>Track your progress towards financial goals</h3>
        </div>
        <Button onClick={openNewGoal} size="sm">
          <Icon path={icons.plus} size={16} /> New Goal
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={s.statsGrid}>
        <SummaryCard icon={icons.target} amount={fmt(stats.totalTarget)} label="Total Goal Amount" desc="Across all goals" color="var(--accent)" delay="0s" />
        <SummaryCard icon={icons.savings} amount={fmt(stats.totalSaved)} label="Total Saved" desc={`${Math.round(stats.totalTarget > 0 ? (stats.totalSaved / stats.totalTarget) * 100 : 0)}% of target`} color="var(--success)" delay="0.05s" />
        <SummaryCard icon={icons.trendingDown} amount={fmt(stats.remaining)} label="Remaining Amount" desc="Left to save" color="var(--warning)" delay="0.1s" />
        <SummaryCard icon={icons.check} amount={`${stats.completed} / ${stats.total}`} label="Goals Completed" desc={stats.completed === stats.total && stats.total > 0 ? 'All goals achieved!' : `${stats.total - stats.completed} in progress`} color="var(--purple)" delay="0.15s" />
      </div>

      {goals.length === 0 ? (
        <Card style={{ marginBottom: '28px' }}>
          <EmptyState
            icon={icons.target}
            title="No savings goals yet"
            description="Create your first goal to start tracking your financial progress"
            action={<Button onClick={openNewGoal} size="sm"><Icon path={icons.plus} size={16} /> Create Goal</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Goal Cards */}
          <div style={{ marginBottom: '8px' }}>
            <h3 style={s.sectionTitle}>Your Goals</h3>
          </div>
          <div style={s.goalsGrid}>
            {goals.map((goal) => (
              <GoalCard key={goal._id} goal={goal} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>

          {/* Two Column Layout: Analytics + Priority */}
          <div style={s.twoCol}>
            {/* Goal Analytics */}
            <Card>
              <h3 style={s.sectionTitle}>Goal Analytics</h3>
              {goals.map((goal) => {
                const pct = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0;
                const color = CATEGORY_COLORS[goal.category] || 'var(--accent)';
                return (
                  <div key={goal._id} style={s.analyticsRow}>
                    <span style={s.analyticsLabel}>{goal.goalName}</span>
                    <div style={s.analyticsTrack}>
                      <div style={{ ...s.analyticsFill, width: `${pct}%`, background: color }} />
                    </div>
                    <span style={s.analyticsPct}>{Math.round(pct)}%</span>
                  </div>
                );
              })}
            </Card>

            {/* Next Priority Goal */}
            <Card>
              <h3 style={s.sectionTitle}>Next Priority Goal</h3>
              {priorityGoal ? (
                (() => {
                  const pct = priorityGoal.targetAmount > 0 ? Math.min((priorityGoal.savedAmount / priorityGoal.targetAmount) * 100, 100) : 0;
                  const remaining = Math.max(priorityGoal.targetAmount - priorityGoal.savedAmount, 0);
                  const now = new Date();
                  const targetDate = new Date(priorityGoal.targetDate);
                  const monthsLeft = Math.max(1, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24 * 30)));
                  const suggestedMonthly = remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;
                  const color = CATEGORY_COLORS[priorityGoal.category] || 'var(--accent)';
                  const icon = CATEGORY_ICONS[priorityGoal.category] || icons.target;
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ ...s.goalIconWrap, background: `${color}18`, width: 40, height: 40 }}>
                          <Icon path={icon} size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{priorityGoal.goalName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{priorityGoal.category}</div>
                        </div>
                      </div>
                      <div style={s.progressTrack}>
                        <div style={{ ...s.progressFill, width: `${pct}%`, background: color }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        <span>{Math.round(pct)}% complete</span>
                        <span>{fmt(priorityGoal.savedAmount)} / {fmt(priorityGoal.targetAmount)}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Remaining</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(remaining)}</div>
                        </div>
                        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggested Monthly</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: color }}>{fmt(suggestedMonthly)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No active goals to prioritize
                </div>
              )}
            </Card>
          </div>

          {/* Two Column: AI Recommendations + Achievements */}
          <div style={s.twoCol}>
            {/* AI Smart Recommendation */}
            <Card>
              <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon path={icons.brain} size={20} /> AI Smart Recommendations
              </h3>
              {recommendations.map((rec, i) => (
                <div key={i} style={s.recItem}>
                  <div style={{ ...s.recDot, background: rec.color }} />
                  <span style={s.recText}>{rec.text}</span>
                </div>
              ))}
            </Card>

            {/* Achievements */}
            <Card>
              <h3 style={s.sectionTitle}>Achievements</h3>
              <div style={s.achievementGrid}>
                {achievements.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      ...s.achievementItem,
                      ...(a.unlocked ? {} : { opacity: 0.4, filter: 'grayscale(1)' }),
                    }}
                  >
                    <span style={s.achievementIcon}>{a.unlocked ? a.icon : '🔒'}</span>
                    <div style={s.achievementText}>
                      <span style={s.achievementTitle}>{a.title}</span>
                      <span style={s.achievementDesc}>{a.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Monthly Savings Chart */}
          <Card style={{ marginBottom: '28px' }}>
            <h3 style={s.sectionTitle}>Monthly Savings Overview</h3>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                    formatter={(value) => [fmt(value), 'Savings']}
                  />
                  <Bar dataKey="savings" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Goal Timeline */}
          <Card>
            <h3 style={s.sectionTitle}>Goal Timeline</h3>
            {timelineGoals.map((goal) => {
              const pct = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0;
              const color = CATEGORY_COLORS[goal.category] || 'var(--accent)';
              return (
                <div key={goal._id} style={s.timelineRow}>
                  <span style={s.timelineLabel}>{goal.goalName}</span>
                  <div style={s.timelineTrack}>
                    <div style={{ ...s.timelineFill, width: `${Math.max(pct, 5)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}>
                      {pct > 15 && <span style={s.timelineText}>{Math.round(pct)}%</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>{fmt(goal.targetAmount - goal.savedAmount)}</span>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <GoalModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditGoal(null); }}
        onSave={handleSave}
        editGoal={editGoal}
      />
    </Layout>
  );
}
