import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import Icon, { icons } from '../components/Icon';

const features = [
  { icon: icons.trendingUp, title: 'Income Tracking', desc: 'Track all income sources with detailed categorization and monthly trends.' },
  { icon: icons.expenses, title: 'Expense Management', desc: 'Monitor spending patterns across categories with smart filters.' },
  { icon: icons.budget, title: 'Budget Planning', desc: 'Set category budgets with visual progress bars and auto-recommendations.' },
  { icon: icons.target, title: 'Goal Planning', desc: 'Set financial goals, track contributions, and monitor progress.' },
  { icon: icons.investments, title: 'Investment Portfolio', desc: 'Manage stocks, mutual funds, FDs, crypto and track profit/loss.' },
  { icon: icons.barChart, title: 'Portfolio Analytics', desc: 'Comprehensive analytics with risk scoring and performance tables.' },
  { icon: icons.pieChart, title: 'Asset Allocation', desc: 'Interactive breakdown by type and category with diversification analysis.' },
  { icon: icons.brain, title: 'AI Insights', desc: 'Rule-based financial recommendations powered by your spending data.' },
];

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    overflowX: 'hidden',
  },
  nav: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '16px 40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(11, 17, 32, 0.7)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border)',
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
  },
  navLogoIcon: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    background: 'linear-gradient(135deg, var(--accent), var(--purple))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3)',
  },
  navTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  navButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  hero: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '120px 24px 80px',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px',
    borderRadius: '999px',
    background: 'var(--accent-glow)',
    border: '1px solid rgba(59,130,246,0.2)',
    color: 'var(--accent-light)',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '24px',
    animation: 'slideUp 0.5s ease-out',
  },
  heroTitle: {
    fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: '20px',
    animation: 'slideUp 0.6s ease-out',
  },
  heroGradient: {
    background: 'linear-gradient(135deg, var(--accent-light), var(--purple-light))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroTagline: {
    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
    color: 'var(--text-secondary)',
    maxWidth: '640px',
    lineHeight: 1.6,
    marginBottom: '12px',
    animation: 'slideUp 0.7s ease-out',
  },
  heroDesc: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    maxWidth: '560px',
    lineHeight: 1.7,
    marginBottom: '40px',
    animation: 'slideUp 0.8s ease-out',
  },
  ctaGroup: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    animation: 'slideUp 0.9s ease-out',
  },
  btnPrimary: {
    padding: '14px 36px',
    borderRadius: 'var(--radius-md)',
    background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
    color: '#fff',
    border: 'none',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  btnSecondary: {
    padding: '14px 36px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-glass)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  featuresSection: {
    padding: '80px 24px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  sectionLabel: {
    textAlign: 'center',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--accent-light)',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: '12px',
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '48px',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  featureCard: {
    padding: '28px 24px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(12px)',
    transition: 'all var(--transition-base)',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  featureTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  featureDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid var(--border)',
    padding: '40px 24px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  footerSub: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    opacity: 0.7,
  },
};

const iconColors = [
  { bg: 'var(--accent-glow)', color: 'var(--accent-light)' },
  { bg: 'var(--danger-glow)', color: 'var(--danger-light)' },
  { bg: 'var(--warning-glow)', color: 'var(--warning-light)' },
  { bg: 'var(--success-glow)', color: 'var(--success-light)' },
  { bg: 'var(--purple-glow)', color: 'var(--purple-light)' },
  { bg: 'var(--teal-glow)', color: 'var(--teal-light)' },
  { bg: 'var(--accent-glow)', color: 'var(--accent-light)' },
  { bg: 'var(--purple-glow)', color: 'var(--purple-light)' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return null;
  if (isAuthenticated) return null;

  return (
    <div style={s.page}>
      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.navLogo}>
          <div style={s.navLogoIcon}>
            <Icon path={icons.wallet} size={18} />
          </div>
          <span style={s.navTitle}>Smart Finance Insights</span>
        </div>
        <div style={s.navButtons}>
          <button
            onClick={() => navigate('/login')}
            style={{ ...s.btnSecondary, padding: '10px 24px', fontSize: '0.9rem' }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent-light)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-primary)'; }}
          >
            Login
          </button>
          <button
            onClick={() => navigate('/register')}
            style={{ ...s.btnPrimary, padding: '10px 24px', fontSize: '0.9rem' }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 24px rgba(59,130,246,0.4)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 16px rgba(59,130,246,0.3)'; }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={s.hero}>
        <div style={s.heroGlow} />
        <div style={s.badge}>
          <Icon path={icons.brain} size={14} />
          AI-Powered Finance
        </div>
        <h1 style={s.heroTitle}>
          <span style={s.heroGradient}>Smart Finance</span>
          <br />
          Insights
        </h1>
        <p style={s.heroTagline}>
          AI-Powered Personal Finance & Investment Management System
        </p>
        <p style={s.heroDesc}>
          Manage income, expenses, budgets, savings goals, investments, portfolio analytics,
          reports, and AI-powered financial insights — all from one powerful platform.
        </p>
        <div style={s.ctaGroup}>
          <button
            onClick={() => navigate('/login')}
            style={s.btnPrimary}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(59,130,246,0.4)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 16px rgba(59,130,246,0.3)'; }}
          >
            <Icon path={icons.profile} size={18} />
            Login
          </button>
          <button
            onClick={() => navigate('/register')}
            style={s.btnSecondary}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--accent-glow)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg-glass)'; }}
          >
            <Icon path={icons.check} size={18} />
            Create Account
          </button>
        </div>
      </section>

      {/* Features */}
      <section style={s.featuresSection}>
        <div style={s.sectionLabel}>Everything You Need</div>
        <h2 style={s.sectionTitle}>One Platform for All Your Finances</h2>
        <div style={s.featuresGrid}>
          {features.map((f, i) => (
            <div
              key={i}
              style={s.featureCard}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ ...s.featureIcon, background: iconColors[i].bg }}>
                <Icon path={f.icon} size={20} color={iconColors[i].color} />
              </div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: '60px 24px 80px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Ready to Take Control of Your Finances?
        </h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '480px', margin: '0 auto 32px' }}>
          Join and start building a smarter financial future today.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/register')}
            style={s.btnPrimary}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(59,130,246,0.4)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 16px rgba(59,130,246,0.3)'; }}
          >
            Get Started Free
            <Icon path={icons.trendingUp} size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <p style={s.footerText}>&copy; 2026 Smart Finance Insights. All Rights Reserved.</p>
        <p style={s.footerSub}>Built as an AI-Powered Personal Finance Management System</p>
      </footer>
    </div>
  );
}
