import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { icons } from '../components/Icon';
import ProgressRing from '../components/ui/ProgressRing';
import { incomeAPI, expenseAPI, investmentAPI, goalAPI } from '../services/api';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const fadeInUp = { animation: 'fadeInUp 0.5s ease-out forwards', opacity: 0 };
const stagger = (i) => ({ animationDelay: `${i * 0.08}s` });

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { health } = useFinancialHealth();
  const [counts, setCounts] = useState({ income: 0, expenses: 0, investments: 0, goals: 0 });

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incRes, expRes, invRes, goalRes] = await Promise.allSettled([
          incomeAPI.getAll(),
          expenseAPI.getAll(),
          investmentAPI.getAll(),
          goalAPI.getAll(),
        ]);
        setCounts({
          income: incRes.status === 'fulfilled' ? incRes.value.data.length : 0,
          expenses: expRes.status === 'fulfilled' ? expRes.value.data.length : 0,
          investments: invRes.status === 'fulfilled' ? invRes.value.data.length : 0,
          goals: goalRes.status === 'fulfilled' ? goalRes.value.data.length : 0,
        });
      } catch {}
    };
    fetchData();
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const savingsRate = health ? health.savingsRate : 0;
  const healthScore = health ? health.score : 0;

  const memberSince = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <Layout title="Profile">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(59,130,246,0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .profile-avatar { animation: pulse-ring 2s infinite; }
        .profile-float { animation: float 3s ease-in-out infinite; }
        .stat-card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .stat-card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
        .gradient-text {
          background: linear-gradient(135deg, var(--accent), var(--purple), var(--teal));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-size: 200% 200%; animation: gradient-shift 3s ease infinite;
        }
        .setting-row { transition: all 0.2s ease; }
        .setting-row:hover { background: var(--bg-glass); border-radius: var(--radius-md); }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Profile Header Card */}
        <div style={{ ...fadeInUp, ...stagger(0) }}>
          <Card style={{
            padding: 0, overflow: 'hidden', position: 'relative',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            {/* Banner */}
            <div style={{
              height: 140, position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 40%, #1a1040 70%, #0f172a 100%)',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(139,92,246,0.12) 0%, transparent 50%)',
              }} />
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 120, height: 120,
                borderRadius: '50%', border: '2px solid rgba(59,130,246,0.15)',
              }} />
              <div style={{
                position: 'absolute', bottom: -20, left: 30, width: 80, height: 80,
                borderRadius: '50%', border: '2px solid rgba(139,92,246,0.1)',
              }} />
            </div>

            {/* Avatar + Info */}
            <div style={{ padding: '0 32px 32px', textAlign: 'center', marginTop: -50, position: 'relative' }}>
              <div className="profile-avatar" style={{
                width: 100, height: 100, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', fontWeight: 800, color: '#fff',
                margin: '0 auto 16px', border: '4px solid var(--bg-secondary)',
                boxShadow: '0 8px 32px rgba(59,130,246,0.3)',
                position: 'relative', zIndex: 1,
              }}>
                {initials}
              </div>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {user?.name}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {user?.email}
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px', borderRadius: 999,
                background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--success-light)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                Active Account
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Stats */}
        <div style={{ ...fadeInUp, ...stagger(1), display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {[
            { icon: icons.income, label: 'Income', value: counts.income, color: 'var(--success)', bg: 'var(--success-glow)' },
            { icon: icons.expenses, label: 'Expenses', value: counts.expenses, color: 'var(--danger)', bg: 'var(--danger-glow)' },
            { icon: icons.investments, label: 'Investments', value: counts.investments, color: 'var(--accent)', bg: 'var(--accent-glow)' },
            { icon: icons.savings, label: 'Goals', value: counts.goals, color: 'var(--purple)', bg: 'var(--purple-glow)' },
          ].map((s, i) => (
            <div key={s.label} className="stat-card-hover" style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)', padding: '18px 14px', textAlign: 'center',
              backdropFilter: 'blur(12px)', ...stagger(i + 2),
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <Icon path={s.icon} size={18} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Financial Health */}
        {health && (
          <div style={{ ...fadeInUp, ...stagger(5) }}>
            <Card style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon path={icons.activity} size={18} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Financial Health</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div className="profile-float" style={{ textAlign: 'center' }}>
                  <ProgressRing
                    percent={healthScore}
                    size={110} strokeWidth={10}
                    color={healthScore >= 90 ? 'var(--success)' : healthScore >= 75 ? 'var(--accent)' : healthScore >= 60 ? 'var(--warning)' : 'var(--danger)'}
                  />
                  {health && (
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 700, marginTop: '8px',
                      color: healthScore >= 90 ? 'var(--success)' : healthScore >= 75 ? 'var(--accent)' : healthScore >= 60 ? 'var(--warning)' : 'var(--danger)',
                    }}>
                      {health.status}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Income</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--success)' }}>{fmt(health.totalIncome)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Expenses</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--danger)' }}>{fmt(health.totalExpenses)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Net Savings</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: health.totalSavings >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(health.totalSavings)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Savings Rate</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: savingsRate >= 30 ? 'var(--success)' : savingsRate >= 10 ? 'var(--warning)' : 'var(--danger)' }}>{savingsRate}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Settings Section */}
        <div style={{ ...fadeInUp, ...stagger(6) }}>
          <Card style={{ padding: '24px 28px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Preferences
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Theme Toggle */}
              <div className="setting-row" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-md)',
                    background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon path={theme === 'dark' ? icons.moon : icons.sun} size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>Theme</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {theme === 'dark' ? 'Dark mode active' : 'Light mode active'}
                    </div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={toggleTheme}>
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                </Button>
              </div>

              {/* Security */}
              <div className="setting-row" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-md)',
                    background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon path={icons.shield} size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>Account Security</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>JWT authentication enabled</div>
                  </div>
                </div>
                <div style={{
                  padding: '5px 14px', borderRadius: 999,
                  background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)',
                  fontSize: '0.78rem', fontWeight: 600, color: 'var(--success-light)',
                }}>
                  Secured
                </div>
              </div>

              {/* Member Since */}
              <div className="setting-row" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon path={icons.clock} size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>Member Since</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{memberSince}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sign Out */}
        <div style={{ ...fadeInUp, ...stagger(7) }}>
          <Button
            fullWidth
            variant="danger"
            onClick={() => { logout(); navigate('/login'); }}
            style={{ padding: '14px', fontSize: '0.95rem', fontWeight: 700, borderRadius: 'var(--radius-xl)' }}
          >
            <Icon path={icons.logout} size={18} />
            Sign Out of Account
          </Button>
        </div>
      </div>
    </Layout>
  );
}
