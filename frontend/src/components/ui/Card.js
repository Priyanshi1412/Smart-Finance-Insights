const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
    backdropFilter: 'blur(12px)',
    transition: 'all var(--transition-base)',
    animation: 'fadeIn 0.4s ease-out',
  },
  hoverable: {
    cursor: 'pointer',
  },
};

export default function Card({ children, className = '', hoverable = false, style = {}, ...props }) {
  return (
    <div
      className={className}
      style={{
        ...styles.card,
        ...(hoverable ? styles.hoverable : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}
