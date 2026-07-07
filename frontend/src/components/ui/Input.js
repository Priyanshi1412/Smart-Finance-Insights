import { useState } from 'react';
import Icon, { icons } from '../Icon';

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '0.01em',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    transition: 'all var(--transition-fast)',
    outline: 'none',
  },
  icon: {
    position: 'absolute',
    right: '12px',
    color: 'var(--text-muted)',
    display: 'flex',
    pointerEvents: 'none',
  },
  error: {
    fontSize: '0.8rem',
    color: 'var(--danger-light)',
    marginTop: '2px',
  },
};

export default function Input({
  label,
  error,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  style = {},
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div style={{ ...s.wrap, ...style }}>
      {label && (
        <label style={s.label}>
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}
      <div style={s.inputWrap}>
        <input
          type={isPassword && showPassword ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          style={{
            ...s.input,
            ...(focused ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-glow)' } : {}),
            ...(error ? { borderColor: 'var(--danger)' } : {}),
            ...(isPassword || icon ? { paddingRight: '40px' } : {}),
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword ? (
          <span
            style={{ ...s.icon, cursor: 'pointer', pointerEvents: 'all' }}
            onClick={() => setShowPassword(!showPassword)}
            role="button"
            tabIndex={-1}
          >
            <Icon path={showPassword ? icons.eyeOff : icons.eye} size={16} />
          </span>
        ) : icon ? (
          <span style={s.icon}>{icon}</span>
        ) : null}
      </div>
      {error && <span style={s.error}>{error}</span>}
    </div>
  );
}
