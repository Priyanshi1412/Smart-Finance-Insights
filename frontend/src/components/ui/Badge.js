const colorMap = {
  success: { bg: 'var(--success-glow)', text: 'var(--success-light)', border: 'rgba(16,185,129,0.3)' },
  danger: { bg: 'var(--danger-glow)', text: 'var(--danger-light)', border: 'rgba(239,68,68,0.3)' },
  warning: { bg: 'var(--warning-glow)', text: 'var(--warning-light)', border: 'rgba(245,158,11,0.3)' },
  info: { bg: 'var(--accent-glow)', text: 'var(--accent-light)', border: 'rgba(59,130,246,0.3)' },
  purple: { bg: 'var(--purple-glow)', text: 'var(--purple-light)', border: 'rgba(139,92,246,0.3)' },
  teal: { bg: 'var(--teal-glow)', text: 'var(--teal-light)', border: 'rgba(20,184,166,0.3)' },
};

export default function Badge({ children, color = 'info', dot = false, style = {} }) {
  const c = colorMap[color] || colorMap.info;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      ...style,
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: c.text,
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}
