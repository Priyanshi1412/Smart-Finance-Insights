export default function LoadingSpinner({ size = 40, text = '' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: '16px',
    }}>
      <div style={{
        width: size,
        height: size,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      {text && (
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', animation: 'pulse 1.5s ease-in-out infinite' }}>
          {text}
        </span>
      )}
    </div>
  );
}
