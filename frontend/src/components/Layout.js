import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFinancialHealth } from '../context/FinancialHealthContext';
import Icon, { icons } from './Icon';
import ProgressRing from './ui/ProgressRing';
import { notificationAPI } from '../services/api';

const menu = [
  { label: 'Dashboard', path: '/dashboard', icon: icons.dashboard },
  { label: 'Income', path: '/income', icon: icons.income },
  { label: 'Expenses', path: '/expenses', icon: icons.expenses },
  { label: 'Budget', path: '/budget', icon: icons.budget },
  { label: 'Reports', path: '/reports', icon: icons.reports },
  { label: 'Spending Analysis', path: '/spending-pattern-analysis', icon: icons.activity },
  { label: 'Goal Planning', path: '/financial-goal-planning', icon: icons.target },
  { label: 'Investments', path: '/investments', icon: icons.investments },
  { label: 'Portfolio Analytics', path: '/portfolio-analytics', icon: icons.barChart },
  { label: 'Asset Allocation', path: '/asset-allocation', icon: icons.pieChart },
  { label: 'AI Insights', path: '/ai-insights', icon: icons.brain },
];

const bottomMenu = [
  { label: 'Notifications', path: '/notifications', icon: icons.bell },
  { label: 'Profile', path: '/profile', icon: icons.profile },
  { label: 'Settings', path: '/settings', icon: icons.settings },
];

export default function Layout({ children, title, centerContent = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { health } = useFinancialHealth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [layoutNotifCount, setLayoutNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchNotifCount = async () => {
      try {
        const res = await notificationAPI.getAll();
        setLayoutNotifCount(res.data.unreadCount || 0);
      } catch {}
    };
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 900) setCollapsed(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const NavItem = ({ item }) => {
    const active = location.pathname === item.path;
    return (
      <button
        onClick={() => navigate(item.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: active ? 'var(--accent-glow-strong)' : 'transparent',
          border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
          color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          fontSize: '0.9rem',
          fontWeight: active ? 600 : 500,
          width: '100%',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'var(--accent-glow)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: 20, justifyContent: 'center' }}>
          <Icon path={item.icon} size={18} />
        </span>
        {!collapsed && <span>{item.label}</span>}
      </button>
    );
  };

  const sidebarWidth = collapsed ? 72 : 260;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 998, backdropFilter: 'blur(4px)',
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: collapsed ? '20px 12px' : '24px 16px',
        position: window.innerWidth < 900 ? 'fixed' : 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 999,
        transition: 'all var(--transition-base)',
        overflowY: 'auto',
        ...(window.innerWidth < 900 ? {
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          left: 0,
        } : {}),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', padding: '0 4px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon path={icons.wallet} size={18} style={{ color: '#fff' }} />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Smart Finance
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Insights
              </div>
            </div>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {menu.map((item) => <NavItem key={item.path} item={item} />)}
        </nav>

        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {bottomMenu.map((item) => <NavItem key={item.path} item={item} />)}
        </div>

        <div style={{
          marginTop: '16px',
          padding: '16px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-light)',
          textAlign: 'center',
        }}>
          {!collapsed && health && (
            <>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Financial Health
              </div>
              <ProgressRing
                percent={health.score}
                size={80}
                strokeWidth={6}
                color={health.status === 'Excellent' ? 'var(--success)' : health.status === 'Good' ? 'var(--accent)' : health.status === 'Fair' ? 'var(--warning)' : 'var(--danger)'}
              />
              <div style={{
                fontSize: '0.75rem', fontWeight: 600, marginTop: '4px',
                color: health.status === 'Excellent' ? 'var(--success-light)' : health.status === 'Good' ? 'var(--accent-light)' : health.status === 'Fair' ? 'var(--warning-light)' : 'var(--danger-light)',
              }}>
                {health.status}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--danger-light)', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 600, width: '100%',
            marginTop: '12px', transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger-glow)'; }}
        >
          <Icon path={icons.logout} size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </aside>

      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', minHeight: '100vh' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '28px', flexWrap: 'wrap', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => window.innerWidth < 900 ? setMobileOpen(true) : setCollapsed(!collapsed)}
              style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon path={collapsed || mobileOpen ? icons.chevronRight : 'M3 3h18v18H3z M9 3v18 M15 3v18'} size={18} />
            </button>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {title}
              </div>
              {user && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Welcome back, <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{user.name?.split(' ')[0]}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '8px 16px', borderRadius: '999px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              fontSize: '0.8rem', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Icon path={icons.clock} size={14} />
              {dateStr}
            </div>
            <button
              onClick={toggleTheme}
              style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Icon path={theme === 'dark' ? icons.sun : icons.moon} size={18} />
            </button>
            <button
              onClick={() => navigate('/notifications')}
              style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)',
                position: 'relative',
              }}
              title="Notifications"
            >
              <Icon path={icons.bell} size={18} />
              {layoutNotifCount > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                  border: '2px solid var(--bg-secondary)',
                }}>
                  {layoutNotifCount > 9 ? '9+' : layoutNotifCount}
                </div>
              )}
            </button>
            <button
              onClick={() => navigate(user ? '/profile' : '/login')}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, color: '#fff',
                border: '2px solid var(--accent-glow-strong)',
                cursor: 'pointer',
              }}
            >
              {initials}
            </button>
          </div>
        </div>
        <div style={{
          maxWidth: centerContent ? 520 : '100%',
          margin: centerContent ? '0 auto' : undefined,
          animation: 'slideUp 0.4s ease-out',
        }}>
          {children}
        </div>
      </main>
    </div>
  );
}
