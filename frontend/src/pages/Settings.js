import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { icons } from '../components/Icon';
import { incomeAPI, expenseAPI, budgetAPI, goalAPI, investmentAPI, settingsAPI } from '../services/api';
import { useState } from 'react';

const fadeInUp = { animation: 'fadeInUp 0.5s ease-out forwards', opacity: 0 };
const stagger = (i) => ({ animationDelay: `${i * 0.08}s` });

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

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

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
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await settingsAPI.clearAllData();
      alert(`All your data has been cleared. (${res.data.deletedCount} records deleted)`);
      window.location.reload();
    } catch (err) {
      console.error('Clear data failed:', err);
      alert('Failed to clear data. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  return (
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
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Header */}
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

        {/* Appearance */}
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

        {/* Account */}
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
          </Card>
        </div>

        {/* Data & Privacy */}
        <div style={{ ...fadeInUp, ...stagger(3) }}>
          <Card className="section-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.shield} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Data & Privacy
              </h3>
            </div>

            {/* Export */}
            <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="setting-icon" style={{
                  width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.reports} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Export Data</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Download all your financial data as CSV
                  </div>
                </div>
              </div>
              <button
                className="export-btn"
                onClick={handleExport}
                disabled={exporting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 18px', borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                  border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.82rem',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                }}
              >
                {exporting ? (
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

            <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 14px' }} />

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

        {/* Security */}
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

        {/* Danger Zone */}
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
    </Layout>
  );
}
