const variants = {
  primary: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'linear-gradient(135deg, var(--danger), #DC2626)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
  },
  success: {
    background: 'linear-gradient(135deg, var(--success), #059669)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
};

const sizes = {
  sm: { padding: '8px 14px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' },
  md: { padding: '10px 20px', fontSize: '0.9rem', borderRadius: 'var(--radius-md)' },
  lg: { padding: '14px 28px', fontSize: '1rem', borderRadius: 'var(--radius-lg)' },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  style = {},
  type = 'button',
  ...props
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all var(--transition-fast)',
    width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  return (
    <button
      type={type}
      style={{ ...base, ...variants[variant], ...sizes[size], ...style }}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.filter = 'brightness(1.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.filter = 'brightness(1)';
      }}
      {...props}
    >
      {loading && (
        <span style={{
          width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite',
        }} />
      )}
      {children}
    </button>
  );
}
