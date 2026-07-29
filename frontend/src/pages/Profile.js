import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { icons } from '../components/Icon';
import ProgressRing from '../components/ui/ProgressRing';
import { incomeAPI, expenseAPI, investmentAPI, goalAPI, userAPI } from '../services/api';

const fadeInUp = { animation: 'fadeInUp 0.5s ease-out forwards', opacity: 0 };
const stagger = (i) => ({ animationDelay: `${i * 0.08}s` });

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { formatCurrency } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const { health } = useFinancialHealth();
  const [counts, setCounts] = useState({ income: 0, expenses: 0, investments: 0, goals: 0 });
  const [accountInfo, setAccountInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(user?.profilePicture || '');
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    const fetchAccountInfo = async () => {
      try {
        const res = await userAPI.getAccountInfo();
        setAccountInfo(res.data);
      } catch {}
    };
    fetchAccountInfo();
  }, []);

  useEffect(() => {
    setPreviewUrl(user?.profilePicture || '');
  }, [user?.profilePicture]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadMsg({ type: 'error', text: 'Please select a JPG, PNG, or WEBP image.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadMsg({ type: 'error', text: 'Image must be less than 2MB.' });
      return;
    }

    setUploadMsg({ type: '', text: '' });
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSave = async () => {
    if (!previewUrl) return;
    setUploading(true);
    setUploadMsg({ type: '', text: '' });
    try {
      const res = await userAPI.updateProfile({ profilePicture: previewUrl });
      updateUser({ profilePicture: res.data.profilePicture });
      setUploadMsg({ type: 'success', text: 'Profile picture updated!' });
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.response?.data?.error || 'Failed to upload image' });
      setPreviewUrl(user?.profilePicture || '');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploading(true);
    setUploadMsg({ type: '', text: '' });
    try {
      await userAPI.removeProfilePicture();
      setPreviewUrl('');
      updateUser({ profilePicture: '' });
      setUploadMsg({ type: 'success', text: 'Profile picture removed.' });
    } catch (err) {
      setUploadMsg({ type: 'error', text: 'Failed to remove picture' });
    } finally {
      setUploading(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const savingsRate = health ? health.savingsRate : 0;
  const healthScore = health ? health.score : 0;

  const memberSince = accountInfo?.createdAt
    ? new Date(accountInfo.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '—';

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
        .avatar-overlay {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s; cursor: pointer;
        }
        .avatar-container:hover .avatar-overlay { opacity: 1; }
      `}</style>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

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
              <div className="avatar-container" style={{
                width: 100, height: 100, borderRadius: '50%',
                margin: '0 auto 16px', border: '4px solid var(--bg-secondary)',
                boxShadow: '0 8px 32px rgba(59,130,246,0.3)',
                position: 'relative', zIndex: 1, overflow: 'hidden',
              }}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  <div className="profile-avatar" style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', fontWeight: 800, color: '#fff',
                  }}>
                    {initials}
                  </div>
                )}
                <div className="avatar-overlay" onClick={() => fileInputRef.current?.click()}>
                  <Icon path={icons.camera} size={24} />
                </div>
              </div>

              {/* Photo Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: 600,
                    background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.2)',
                    color: 'var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Icon path={icons.upload} size={13} /> Upload Photo
                </button>
                {previewUrl && (
                  <>
                    <button
                      onClick={handleUploadSave}
                      disabled={uploading}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: 600,
                        background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)',
                        color: 'var(--success-light)', cursor: uploading ? 'not-allowed' : 'pointer',
                        opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      {uploading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleRemovePhoto}
                      disabled={uploading}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: 600,
                        background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--danger-light)', cursor: uploading ? 'not-allowed' : 'pointer',
                        opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      Remove
                    </button>
                  </>
                )}
                {!previewUrl && user?.profilePicture && (
                  <button
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: 600,
                      background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)',
                      color: 'var(--danger-light)', cursor: uploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Reset to Default
                  </button>
                )}
              </div>

              {uploadMsg.text && (
                <div style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '12px',
                  background: uploadMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${uploadMsg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  color: uploadMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                }}>
                  {uploadMsg.text}
                </div>
              )}

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
                    color={healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? 'var(--accent)' : healthScore >= 40 ? 'var(--warning)' : 'var(--danger)'}
                  />
                  {health && (
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 700, marginTop: '8px',
                      color: healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? 'var(--accent)' : healthScore >= 40 ? 'var(--warning)' : 'var(--danger)',
                    }}>
                      {health.status}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Income</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(health.totalIncome)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Expenses</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(health.totalExpenses)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Net Savings</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: health.totalSavings >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(health.totalSavings)}</div>
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

        {/* Account Information */}
        <div style={{ ...fadeInUp, ...stagger(6) }}>
          <Card style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.clock} size={18} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Account Information
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { label: 'Account Created', value: memberSince },
                { label: 'Last Login', value: accountInfo?.lastLoginAt ? new Date(accountInfo.lastLoginAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                { label: 'Password Last Changed', value: accountInfo?.passwordChangedAt ? new Date(accountInfo.passwordChangedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Never' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                  </div>
                  {i < 2 && <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 12px' }} />}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Preferences */}
        <div style={{ ...fadeInUp, ...stagger(7) }}>
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
        <div style={{ ...fadeInUp, ...stagger(8) }}>
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
