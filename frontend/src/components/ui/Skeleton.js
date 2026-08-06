const shimmerStyle = {
  background: 'linear-gradient(90deg, var(--bg-glass) 25%, rgba(255,255,255,0.06) 50%, var(--bg-glass) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
  borderRadius: 'var(--radius-md)',
};

export function SkeletonCard({ height = 120 }) {
  return (
    <div style={{
      ...shimmerStyle,
      height,
      width: '100%',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-xl)',
    }} />
  );
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: 'var(--radius-md)' }} />
        <div style={{ ...shimmerStyle, width: 140, height: 16, borderRadius: 8 }} />
      </div>
      <div style={{ ...shimmerStyle, height, width: '100%', borderRadius: 'var(--radius-md)' }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: 'var(--radius-md)' }} />
        <div style={{ ...shimmerStyle, width: 160, height: 16, borderRadius: 8 }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 0',
          borderBottom: i < rows - 1 ? '1px solid var(--border-light)' : 'none',
        }}>
          <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ ...shimmerStyle, width: '60%', height: 12, borderRadius: 6, marginBottom: 6 }} />
            <div style={{ ...shimmerStyle, width: '40%', height: 10, borderRadius: 6 }} />
          </div>
          <div style={{ ...shimmerStyle, width: 70, height: 14, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTransactionList({ items = 5 }) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: 'var(--radius-md)' }} />
          <div style={{ ...shimmerStyle, width: 160, height: 16, borderRadius: 8 }} />
        </div>
      </div>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 'var(--radius-md)',
          marginBottom: i < items - 1 ? 8 : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: 'var(--radius-sm)' }} />
            <div>
              <div style={{ ...shimmerStyle, width: 100, height: 12, borderRadius: 6, marginBottom: 6 }} />
              <div style={{ ...shimmerStyle, width: 60, height: 10, borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...shimmerStyle, width: 60, height: 12, borderRadius: 6, marginBottom: 6 }} />
            <div style={{ ...shimmerStyle, width: 50, height: 10, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
