import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { icons } from '../components/Icon';

const s = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-2xl)',
    padding: '48px 36px',
    backdropFilter: 'blur(16px)',
    boxShadow: 'var(--shadow-xl)',
    textAlign: 'center',
    animation: 'scaleIn 0.5s ease-out',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'var(--success-glow)',
    border: '2px solid var(--success)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    animation: 'scaleIn 0.5s ease-out 0.2s both',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    marginBottom: '24px',
  },
  spinner: {
    width: 24,
    height: 24,
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  text: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
};

export default function Confirmation() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.checkCircle}>
          <Icon path={icons.check} size={36} />
        </div>
        <h1 style={s.title}>Welcome back!</h1>
        <p style={s.subtitle}>You have successfully signed in.</p>
        <div style={s.spinner} />
        <p style={{ ...s.text, marginTop: '16px' }}>Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
