import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { icons } from '../components/Icon';
import { incomeAPI, expenseAPI, budgetAPI, goalAPI, investmentAPI, settingsAPI, userAPI, exportAPI } from '../services/api';
import { useState, useEffect } from 'react';
import ToastContainer, { showToast } from '../components/ui/Toast';

const fadeInUp = { animation: 'fadeInUp 0.5s ease-out forwards', opacity: 0 };
const stagger = (i) => ({ animationDelay: `${i * 0.08}s` });

const currencyOptions = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
];

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        animation: 'modalFadeIn 0.2s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 0,
        maxWidth: '420px', width: '92%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'modalSlideIn 0.25s ease-out',
      }}>
        {children}
      </div>
    </div>
  );
}

function toCSV(rows, headers) {
  if (!rows.length) return '';
  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(headers.map(h => {
      let val = row[h] ?? '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(','));
  });
  return lines.join('\n');
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exportingKey, setExportingKey] = useState(null);

  const REPORT_TYPES = ['expenses', 'investments', 'financial-report', 'goals'];
  const [formats, setFormats] = useState(() => {
    try {
      const saved = localStorage.getItem('sfi-export-formats');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('sfi-export-formats', JSON.stringify(formats));
  }, [formats]);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  const [curOpen, setCurOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [curLoading, setCurLoading] = useState(false);
  const [curMsg, setCurMsg] = useState({ type: '', text: '' });

  useEffect(() => { setSelectedCurrency(currency); }, [currency]);

  const resetPw = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPw(false);
    setPwMsg({ type: '', text: '' });
  };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMsg({ type: 'error', text: 'All fields are required' }); return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'New password must be at least 6 characters' }); return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match' }); return;
    }
    setPwLoading(true);
    try {
      await userAPI.changePassword({ currentPassword, newPassword });
      setPwMsg({ type: 'success', text: 'Password updated successfully' });
      resetPw();
      setTimeout(() => { setPwOpen(false); setPwMsg({ type: '', text: '' }); }, 1200);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleCurSave = async () => {
    setCurLoading(true);
    setCurMsg({ type: '', text: '' });
    try {
      await userAPI.updateCurrency(selectedCurrency);
      setCurrency(selectedCurrency);
      if (user) updateUser({ currency: selectedCurrency });
      setCurMsg({ type: 'success', text: 'Currency updated' });
      setTimeout(() => { setCurOpen(false); setCurMsg({ type: '', text: '' }); }, 1000);
    } catch (err) {
      setCurMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update' });
    } finally {
      setCurLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const [incRes, expRes, budRes, goalRes, invRes] = await Promise.all([
        incomeAPI.getAll(),
        expenseAPI.getAll(),
        budgetAPI.getAll(),
        goalAPI.getAll(),
        investmentAPI.getAll(),
      ]);

      const incomes = incRes.data || [];
      const expenses = expRes.data || [];
      const budgets = budRes.data || [];
      const goals = goalRes.data || [];
      const investments = invRes.data || [];

      const incomeCSV = toCSV(incomes.map(i => ({
        date: new Date(i.date).toLocaleDateString('en-IN'),
        source: i.source,
        amount: i.amount,
        description: i.description || '',
      })), ['date', 'source', 'amount', 'description']);

      const expenseCSV = toCSV(expenses.map(e => ({
        date: new Date(e.date).toLocaleDateString('en-IN'),
        category: e.category,
        amount: e.amount,
        description: e.description || '',
      })), ['date', 'category', 'amount', 'description']);

      const budgetCSV = toCSV(budgets.map(b => ({
        month: b.month,
        category: b.category,
        limit: b.limit,
      })), ['month', 'category', 'limit']);

      const goalCSV = toCSV(goals.map(g => ({
        goalName: g.goalName,
        category: g.category,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        monthlySaving: g.monthlySaving,
        targetDate: new Date(g.targetDate).toLocaleDateString('en-IN'),
        priority: g.priority,
        status: g.status,
      })), ['goalName', 'category', 'targetAmount', 'savedAmount', 'monthlySaving', 'targetDate', 'priority', 'status']);

      const investCSV = toCSV(investments.map(i => ({
        name: i.name,
        type: i.type,
        category: i.category,
        amount: i.amount,
        currentValue: i.currentValue,
        investedDate: new Date(i.investedDate).toLocaleDateString('en-IN'),
        expectedReturns: i.expectedReturns,
        status: i.status,
        notes: i.notes || '',
      })), ['name', 'type', 'category', 'amount', 'currentValue', 'investedDate', 'expectedReturns', 'status', 'notes']);

      const combined = [
        '=== INCOME ===',
        'date,source,amount,description',
        incomeCSV || '(no data)',
        '',
        '=== EXPENSES ===',
        'date,category,amount,description',
        expenseCSV || '(no data)',
        '',
        '=== BUDGETS ===',
        'month,category,limit',
        budgetCSV || '(no data)',
        '',
        '=== GOALS ===',
        'goalName,category,targetAmount,savedAmount,monthlySaving,targetDate,priority,status',
        goalCSV || '(no data)',
        '',
        '=== INVESTMENTS ===',
        'name,type,category,amount,currentValue,investedDate,expectedReturns,status,notes',
        investCSV || '(no data)',
      ].join('\n');

      downloadCSV(`smart-finance-export-${new Date().toISOString().split('T')[0]}.csv`, combined);
      showToast('All data exported as CSV');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Failed to export data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const setFormat = (reportType, format) => {
    setFormats(prev => ({ ...prev, [reportType]: format }));
  };

  const handleUniversalExport = async (reportType) => {
    const format = formats[reportType];
    if (!format) return;

    const key = `${reportType}-${format}`;
    setExportingKey(key);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ext = format === 'xlsx' ? 'xlsx' : format;

    const fileNames = {
      expenses: `expense-report-${monthStr}.${ext}`,
      investments: `investment-report-${dateStr}.${ext}`,
      'financial-report': `financial-summary-${dateStr}.${ext}`,
      goals: `goal-progress-${dateStr}.${ext}`,
    };

    try {
      const apiMap = {
        comprehensive: { csv: exportAPI.comprehensiveCSV },
        expenses: { pdf: exportAPI.expensePDF, csv: exportAPI.expenseCSV, xlsx: exportAPI.expenseExcel },
        investments: { pdf: exportAPI.investmentPDF, csv: exportAPI.investmentCSV, xlsx: exportAPI.investmentExcel },
        'financial-report': { pdf: exportAPI.financialPDF, csv: exportAPI.financialCSV, xlsx: exportAPI.financialExcel },
        goals: { pdf: exportAPI.goalPDF, csv: exportAPI.goalCSV, xlsx: exportAPI.goalExcel },
      };

      const fn = apiMap[reportType]?.[format];
      if (!fn) throw new Error('Unsupported format');

      const res = await fn();
      downloadBlob(res.data, fileNames[reportType]);
      showToast(`Downloaded ${fileNames[reportType]}`);
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setExportingKey(null);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await settingsAPI.clearAllData();
      showToast(`All data cleared (${res.data.deletedCount} records)`);
      window.location.reload();
    } catch (err) {
      console.error('Clear data failed:', err);
      showToast('Failed to clear data', 'error');
    } finally {
      setClearing(false);
    }
  };

  const currentLabel = currencyOptions.find(o => o.code === currency);

  const modalInput = {
    width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <>
    <Layout title="Settings">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes modalFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes modalSlideIn { from { opacity:0; transform:translateY(12px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        .setting-row {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: var(--radius-md);
          cursor: default;
        }
        .setting-row:hover {
          background: var(--bg-glass);
          transform: translateX(4px);
        }
        .setting-row:hover .setting-icon {
          transform: scale(1.1);
        }
        .setting-icon {
          transition: transform 0.25s ease;
        }
        .export-btn {
          position: relative; overflow: hidden;
          transition: all 0.3s ease;
        }
        .export-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59,130,246,0.25);
        }
        .export-btn:disabled {
          opacity: 0.7; cursor: not-allowed;
        }
        .danger-btn {
          transition: all 0.3s ease;
        }
        .danger-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(239,68,68,0.25);
        }
        .danger-btn:disabled {
          opacity: 0.7; cursor: not-allowed;
        }
        .section-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .section-card:hover {
          box-shadow: var(--shadow-lg);
        }
        .gradient-text {
          background: linear-gradient(135deg, var(--accent), var(--purple), var(--teal));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-size: 200% 200%; animation: gradient-shift 3s ease infinite;
        }
        .pw-field:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        .pw-field::placeholder { color: var(--text-muted); opacity: 0.6; }
        .pw-toggle {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: var(--text-muted);
          padding: 4px; display: flex; border-radius: var(--radius-sm);
        }
        .pw-toggle:hover { color: var(--text-primary); }
        .cur-opt {
          padding: 10px 8px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
          background: var(--bg-secondary); text-align: center; cursor: pointer;
          transition: all 0.2s;
        }
        .cur-opt:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
        .cur-opt.active { border-color: var(--accent); background: rgba(59,130,246,0.06);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .export-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .export-grid { grid-template-columns: 1fr 1fr; }
        }
        .export-panel {
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background: var(--bg-secondary);
          padding: 20px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .export-panel:hover {
          border-color: rgba(59,130,246,0.3);
          box-shadow: 0 4px 24px rgba(59,130,246,0.06);
        }
        .export-panel-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .export-panel-icon {
          width: 40px;
          height: 40px;
          min-width: 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-glow);
        }
        .export-panel-title {
          font-weight: 700;
          color: 'var(--text-primary)';
          font-size: 0.9rem;
          line-height: 1.3;
        }
        .export-panel-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
          line-height: 1.35;
        }
        .format-selector {
          display: flex;
          gap: 0;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--bg-glass);
        }
        .format-option {
          flex: 1;
          padding: 7px 0;
          border: none;
          background: transparent;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .format-option:not(:last-child) {
          border-right: 1px solid var(--border);
        }
        .format-option:hover {
          color: var(--text-secondary);
          background: var(--bg-glass);
        }
        .format-option.active {
          color: var(--accent);
          background: rgba(59,130,246,0.08);
          font-weight: 700;
        }
        .format-option.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 15%;
          right: 15%;
          height: 2px;
          background: var(--accent);
          border-radius: 2px 2px 0 0;
        }
        .export-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--accent);
          background: rgba(59,130,246,0.06);
          color: var(--accent);
          font-weight: 600;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .export-action-btn:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 4px 16px rgba(59,130,246,0.25);
          transform: translateY(-1px);
        }
        .export-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .format-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ═══ Header ═══ */}
        <div style={{ ...fadeInUp, ...stagger(0) }}>
          <Card style={{ padding: '28px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.03,
              background: 'radial-gradient(circle at 30% 50%, var(--accent) 0%, transparent 50%), radial-gradient(circle at 70% 50%, var(--purple) 0%, transparent 50%)',
            }} />
            <div style={{
              width: 56, height: 56, borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', boxShadow: '0 8px 32px rgba(59,130,246,0.25)',
            }}>
              <Icon path={icons.settings} size={26} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Settings
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Manage your account preferences and data
            </p>
          </Card>
        </div>

        {/* ═══ Appearance ═══ */}
        <div style={{ ...fadeInUp, ...stagger(1) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.moon} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Appearance
              </h3>
            </div>
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: theme === 'dark' ? 'rgba(139,92,246,0.12)' : 'rgba(245,158,11,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={theme === 'dark' ? icons.moon : icons.sun} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Theme Mode</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Currently using <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{theme}</span> mode
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={toggleTheme}>
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            </div>
          </Card>
        </div>

        {/* ═══ Account ═══ */}
        <div style={{ ...fadeInUp, ...stagger(2) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.profile} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Account
              </h3>
            </div>

            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.profile} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Full Name</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {user?.name || 'Not set'}
                  </div>
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 999,
                background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
              }}>
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 14px' }} />

            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.send} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Email Address</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {user?.email || 'Not set'}
                  </div>
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 999,
                background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--success-light)',
              }}>
                Verified
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 14px' }} />

            {/* Change Password row */}
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.shield} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Change Password</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Update your account password securely
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { resetPw(); setPwOpen(true); }}>
                Change
              </Button>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 14px' }} />

            {/* Currency Preferences row */}
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.creditCard} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Currency Preferences</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Current: <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{currentLabel?.symbol} {currency}</span> — {currentLabel?.label}
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setSelectedCurrency(currency); setCurMsg({ type: '', text: '' }); setCurOpen(true); }}>
                Change
              </Button>
            </div>
          </Card>
        </div>

        {/* ═══ Data & Export Center ═══ */}
        <div style={{ ...fadeInUp, ...stagger(3) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.reports} size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Data & Export Center
                </h3>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: 0 }}>
                  Export your financial data in multiple formats
                </p>
              </div>
            </div>

            <div className="export-grid">
              {/* Complete Financial Data */}
              <div className="export-panel">
                <div className="export-panel-header">
                  <div className="export-panel-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <Icon path={icons.reports} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="export-panel-title">Complete Financial Data</div>
                    <div className="export-panel-desc">All income, expenses, budgets, goals & investments</div>
                  </div>
                </div>
                <div className="format-selector">
                  <button
                    className={`format-option active`}
                    style={{ cursor: 'default' }}
                  >
                    <span className="format-dot" style={{ background: '#10b981' }} />
                    CSV
                  </button>
                </div>
                <button
                  className="export-action-btn"
                  onClick={() => handleUniversalExport('comprehensive')}
                  disabled={exportingKey === 'comprehensive-csv'}
                >
                  {exportingKey === 'comprehensive-csv' ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export CSV
                    </>
                  )}
                </button>
              </div>

              {/* Expense Report */}
              <div className="export-panel">
                <div className="export-panel-header">
                  <div className="export-panel-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
                    <Icon path={icons.expenses} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="export-panel-title">Expense Report</div>
                    <div className="export-panel-desc">Monthly expenses with category breakdown</div>
                  </div>
                </div>
                <div className="format-selector">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`format-option ${formats.expenses === f ? 'active' : ''}`}
                      onClick={() => setFormat('expenses', f)}
                    >
                      <span className="format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-action-btn"
                  onClick={() => handleUniversalExport('expenses')}
                  disabled={!formats.expenses || exportingKey === 'expenses-pdf' || exportingKey === 'expenses-csv' || exportingKey === 'expenses-xlsx'}
                >
                  {exportingKey === `expenses-${formats.expenses}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats.expenses ? formats.expenses.toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>

              {/* Investment Report */}
              <div className="export-panel">
                <div className="export-panel-header">
                  <div className="export-panel-icon" style={{ background: 'rgba(20,184,166,0.12)' }}>
                    <Icon path={icons.investments} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="export-panel-title">Investment Report</div>
                    <div className="export-panel-desc">Portfolio performance & ROI analysis</div>
                  </div>
                </div>
                <div className="format-selector">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`format-option ${formats.investments === f ? 'active' : ''}`}
                      onClick={() => setFormat('investments', f)}
                    >
                      <span className="format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-action-btn"
                  onClick={() => handleUniversalExport('investments')}
                  disabled={!formats.investments}
                >
                  {exportingKey === `investments-${formats.investments}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats.investments ? formats.investments.toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>

              {/* Financial Summary */}
              <div className="export-panel">
                <div className="export-panel-header">
                  <div className="export-panel-icon" style={{ background: 'rgba(139,92,246,0.12)' }}>
                    <Icon path={icons.dashboard} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="export-panel-title">Financial Summary</div>
                    <div className="export-panel-desc">Complete financial statement overview</div>
                  </div>
                </div>
                <div className="format-selector">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`format-option ${formats['financial-report'] === f ? 'active' : ''}`}
                      onClick={() => setFormat('financial-report', f)}
                    >
                      <span className="format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-action-btn"
                  onClick={() => handleUniversalExport('financial-report')}
                  disabled={!formats['financial-report']}
                >
                  {exportingKey === `financial-report-${formats['financial-report']}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats['financial-report'] ? formats['financial-report'].toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>

              {/* Goal Progress */}
              <div className="export-panel">
                <div className="export-panel-header">
                  <div className="export-panel-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
                    <Icon path={icons.target} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="export-panel-title">Goal Progress</div>
                    <div className="export-panel-desc">Savings goals tracking & completion status</div>
                  </div>
                </div>
                <div className="format-selector">
                  {['pdf', 'csv', 'xlsx'].map(f => (
                    <button
                      key={f}
                      className={`format-option ${formats.goals === f ? 'active' : ''}`}
                      onClick={() => setFormat('goals', f)}
                    >
                      <span className="format-dot" style={{
                        background: f === 'pdf' ? '#ef4444' : f === 'csv' ? '#10b981' : '#14b8a6',
                      }} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  className="export-action-btn"
                  onClick={() => handleUniversalExport('goals')}
                  disabled={!formats.goals}
                >
                  {exportingKey === `goals-${formats.goals}` ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export {formats.goals ? formats.goals.toUpperCase() : ''}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '16px 0 12px' }} />

            {/* Clear */}
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.trash} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--danger-light)', fontSize: '0.95rem' }}>Clear All Data</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Permanently delete all your income, expenses, goals & investments
                  </div>
                </div>
              </div>
              <button
                className="danger-btn"
                onClick={handleClearData}
                disabled={clearing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 18px', borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--danger), #b91c1c)',
                  border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.82rem',
                  cursor: clearing ? 'not-allowed' : 'pointer',
                }}
              >
                {clearing ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Clearing...
                  </>
                ) : (
                  <>
                    <Icon path={icons.trash} size={14} />
                    Clear Data
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>

        {/* ═══ Security ═══ */}
        <div style={{ ...fadeInUp, ...stagger(4) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.shield} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Security
              </h3>
            </div>
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.shield} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Authentication</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    JWT token-based secure authentication
                  </div>
                </div>
              </div>
              <div style={{
                padding: '5px 14px', borderRadius: 999,
                background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)',
                fontSize: '0.78rem', fontWeight: 600, color: 'var(--success-light)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                Active
              </div>
            </div>
          </Card>
        </div>

        {/* ═══ Danger Zone ═══ */}
        <div style={{ ...fadeInUp, ...stagger(5) }}>
          <Card style={{
            padding: '24px 28px', border: '1px solid rgba(239,68,68,0.2)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.03) 0%, rgba(127,29,29,0.02) 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.alertCircle} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Danger Zone
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Signing out will end your current session. You can sign back in anytime.
            </p>
            <button
              className="danger-btn"
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '14px 24px', borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, var(--danger), #b91c1c)',
                border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              <Icon path={icons.logout} size={18} />
              Sign Out of Account
            </button>
          </Card>
        </div>

      </div>

      {/* ═══ Password Modal ═══ */}
      <Modal open={pwOpen} onClose={() => { if (!pwLoading) { resetPw(); setPwOpen(false); } }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'rgba(20,184,166,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.shield} size={17} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Change Password
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Update your account password
              </p>
            </div>
          </div>

          <form onSubmit={handlePwSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="pw-field" type={showPw ? 'text' : 'password'}
                    value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password" style={modalInput} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                    <Icon path={showPw ? icons.eyeOff : icons.eye} size={15} />
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="pw-field" type={showPw ? 'text' : 'password'}
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters" style={modalInput} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="pw-field" type={showPw ? 'text' : 'password'}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password" style={modalInput} />
                </div>
              </div>
            </div>

            {pwMsg.text && (
              <div style={{
                marginTop: '14px', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem', fontWeight: 500,
                background: pwMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
                color: pwMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
              }}>
                {pwMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { resetPw(); setPwOpen(false); }}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                  fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                }}>
                Cancel
              </button>
              <button type="submit" disabled={pwLoading}
                style={{
                  padding: '8px 20px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                  fontWeight: 600, cursor: pwLoading ? 'not-allowed' : 'pointer', border: 'none',
                  background: 'var(--accent)', color: '#fff', opacity: pwLoading ? 0.6 : 1,
                }}>
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ═══ Currency Modal ═══ */}
      <Modal open={curOpen} onClose={() => { if (!curLoading) setCurOpen(false); }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-glow)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.creditCard} size={17} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Change Currency
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Choose how monetary values are displayed
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
            {currencyOptions.map((opt) => (
              <div
                key={opt.code}
                className={`cur-opt ${selectedCurrency === opt.code ? 'active' : ''}`}
                onClick={() => setSelectedCurrency(opt.code)}
              >
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedCurrency === opt.code ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1.2 }}>
                  {opt.symbol}
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px' }}>
                  {opt.code}
                </div>
              </div>
            ))}
          </div>

          {curMsg.text && (
            <div style={{
              marginTop: '14px', padding: '9px 12px', borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem', fontWeight: 500,
              background: curMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${curMsg.type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
              color: curMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            }}>
              {curMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button onClick={() => setCurOpen(false)} disabled={curLoading}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
              }}>
              Cancel
            </button>
            <button onClick={handleCurSave} disabled={curLoading || selectedCurrency === currency}
              style={{
                padding: '8px 20px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
                fontWeight: 600, cursor: curLoading || selectedCurrency === currency ? 'not-allowed' : 'pointer',
                border: 'none', background: 'var(--accent)', color: '#fff',
                opacity: curLoading || selectedCurrency === currency ? 0.6 : 1,
              }}>
              {curLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

    </Layout>
    <ToastContainer />
  </>
  );
}
