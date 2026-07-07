import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon, { icons } from '../components/Icon';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const s = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-2xl)',
    padding: '40px 36px',
    backdropFilter: 'blur(16px)',
    boxShadow: 'var(--shadow-xl)',
    animation: 'scaleIn 0.4s ease-out',
  },
  logoWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '32px',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(135deg, var(--accent), var(--purple))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },
  link: {
    color: 'var(--accent-light)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  error: {
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--danger-glow)',
    border: '1px solid rgba(239,68,68,0.2)',
    color: 'var(--danger-light)',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    margin: '20px 0',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
  line: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
};

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.logoWrap}>
          <div style={s.logo}>
            <Icon path={icons.wallet} size={28} />
          </div>
          <h1 style={s.title}>Create Account</h1>
          <p style={s.subtitle}>Start your journey to smarter finances</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <Input
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="John Doe"
            required
          />
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Minimum 6 characters"
            required
          />

          {error && (
            <div style={s.error}>
              <Icon path={icons.alertCircle} size={16} />
              {error}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Create Account
          </Button>
        </form>

        <div style={s.divider}>
          <span style={s.line} />
          <span>or</span>
          <span style={s.line} />
        </div>

        <p style={s.footer}>
          Already have an account?{' '}
          <Link to="/login" style={s.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
