import Icon from '../Icon';

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      {icon && (
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--accent-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <Icon path={icon} size={28} />
        </div>
      )}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 320, marginBottom: action ? 20 : 0 }}>
        {description}
      </p>
      {action}
    </div>
  );
}
