import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { icons } from '../components/Icon';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <Layout title="Profile" centerContent>
      <Card style={{ textAlign: 'center', padding: '40px 32px' }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 800, color: '#fff',
          margin: '0 auto 20px',
          border: '3px solid var(--accent-glow-strong)',
          boxShadow: '0 4px 24px rgba(59,130,246,0.3)',
        }}>
          {initials}
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {user?.name}
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '28px' }}>
          {user?.email}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon path={theme === 'dark' ? icons.moon : icons.sun} size={18} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={toggleTheme}>
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon path={icons.shield} size={18} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Account Security</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--success-light)', fontWeight: 600 }}>Active</span>
          </div>

          <Button
            fullWidth
            variant="danger"
            onClick={() => { logout(); navigate('/login'); }}
            style={{ marginTop: '8px' }}
          >
            <Icon path={icons.logout} size={16} />
            Sign Out
          </Button>
        </div>
      </Card>
    </Layout>
  );
}
