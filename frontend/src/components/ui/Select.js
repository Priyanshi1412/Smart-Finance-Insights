import { useState } from 'react';
import Icon, { icons } from '../Icon';

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  selectWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  select: {
    width: '100%',
    padding: '12px 40px 12px 16px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    transition: 'all var(--transition-fast)',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
  },
  chevron: {
    position: 'absolute',
    right: '12px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
    display: 'flex',
  },
};

export default function Select({
  label,
  value,
  onChange,
  options = [],
  required = false,
  style = {},
  ...props
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ ...s.wrap, ...style }}>
      {label && (
        <label style={s.label}>
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}
      <div style={s.selectWrap}>
        <select
          value={value}
          onChange={onChange}
          required={required}
          style={{
            ...s.select,
            ...(focused ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-glow)' } : {}),
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span style={s.chevron}>
          <Icon path={icons.chevronDown} size={16} />
        </span>
      </div>
    </div>
  );
}
