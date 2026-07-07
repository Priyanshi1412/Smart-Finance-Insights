import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { expenseAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const INITIAL = { category: 'Food', amount: '', date: new Date().toISOString().slice(0, 10), description: '' };
const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const categories = ['Food', 'Transport', 'Shopping', 'Bills & Utilities', 'Entertainment', 'Healthcare', 'Education', 'Travel', 'Rent', 'Other'];

export default function Expenses() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/login'); return; }
    fetch();
  }, [navigate]);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await expenseAPI.getAll();
      setItems(res.data || []);
      setTotal((res.data || []).reduce((s, i) => s + Number(i.amount || 0), 0));
    } catch { setError('Failed to load expenses'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const amt = Number(form.amount);
    if (!form.amount || !Number.isInteger(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    try {
      if (editingId) {
        await expenseAPI.update(editingId, { ...form, amount: amt });
        setSuccess('Expense updated');
        setEditingId(null);
      } else {
        await expenseAPI.create({ ...form, amount: amt });
        setSuccess('Expense added');
      }
      setForm(INITIAL);
      fetch();
    } catch (err) { setError(err.response?.data?.error || 'Something went wrong'); }
  };

  const handleEdit = (r) => {
    setEditingId(r._id);
    setForm({ category: r.category, amount: r.amount, date: new Date(r.date).toISOString().slice(0, 10), description: r.description || '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try { await expenseAPI.delete(id); fetch(); }
    catch { setError('Failed to delete'); }
  };

  const filtered = items.filter((i) => {
    const matchSearch = (i.category || '').toLowerCase().includes(search.toLowerCase());
    const matchMonth = monthFilter ? new Date(i.date).toISOString().slice(0, 7) === monthFilter : true;
    return matchSearch && matchMonth;
  });

  return (
    <Layout title="Expenses">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <Card style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Expenses</span>
            <Icon path={icons.trendingDown} size={18} style={{ color: 'var(--danger)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger-light)' }}>
            {loading ? '...' : fmt(total)}
          </div>
        </Card>
        <Card style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Records</span>
            <Icon path={icons.barChart} size={18} style={{ color: 'var(--warning)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning-light)' }}>
            {loading ? '...' : items.length}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={editingId ? icons.edit : icons.plus} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {editingId ? 'Edit Expense' : 'Add Expense'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={categories.map(c => ({ value: c, label: c }))}
              required
            />
            <Input label="Amount" type="number" min="1" step="1" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <Input label="Description (Optional)" placeholder="Add a note" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button type="submit" fullWidth variant="danger">{editingId ? 'Update Expense' : 'Add Expense'}</Button>
            {editingId && <Button variant="secondary" fullWidth onClick={() => { setEditingId(null); setForm(INITIAL); }}>Cancel</Button>}
          </form>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>History</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Search category..." value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: 140 }} />
              <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }} />
            </div>
          </div>

          {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
            <EmptyState icon={icons.expenses} title="No records found" description="Add your first expense entry" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    {['Category', 'Amount', 'Date', 'Description', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item._id} style={{ borderBottom: '1px solid var(--border-light)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-glow)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.category}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--danger-light)' }}>{fmt(item.amount)}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{fmtDate(item.date)}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{item.description || '-'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleEdit(item)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-glow)', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Edit</button>
                          <button onClick={() => handleDelete(item._id)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger-glow)', color: 'var(--danger-light)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
