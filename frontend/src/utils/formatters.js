const CURRENCY_MAP = {
  INR: { locale: 'en-IN', code: 'INR' },
  USD: { locale: 'en-US', code: 'USD' },
  EUR: { locale: 'de-DE', code: 'EUR' },
  GBP: { locale: 'en-GB', code: 'GBP' },
  JPY: { locale: 'ja-JP', code: 'JPY' },
  AUD: { locale: 'en-AU', code: 'AUD' },
  CAD: { locale: 'en-CA', code: 'CAD' },
};

function getFormatter(currency) {
  const config = CURRENCY_MAP[currency] || CURRENCY_MAP.INR;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    maximumFractionDigits: 0,
  });
}

const defaultFormatter = getFormatter('INR');

export function fmt(value, currency) {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return '₹0';
  if (currency && CURRENCY_MAP[currency]) {
    return getFormatter(currency).format(num);
  }
  return defaultFormatter.format(num);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
}

export function fmtPercent(value, decimals = 1) {
  return `${Number(value || 0).toFixed(decimals)}%`;
}

export function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthKey() {
  return getMonthKey(new Date());
}

export function getPreviousMonthKey() {
  const now = new Date();
  return getMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

export function formatMonthYear(monthKey) {
  const [year, month] = monthKey.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function fmtRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const calendarDays = Math.floor((today - targetDay) / (1000 * 60 * 60 * 24));

  if (calendarDays === 0) return 'Today';
  if (calendarDays === 1) return 'Yesterday';
  if (calendarDays < 7) return `${calendarDays} days ago`;
  if (calendarDays < 30) return `${Math.floor(calendarDays / 7)}w ago`;
  return fmtDate(dateStr);
}

export function fmtTrend(value) {
  const num = Number(value);
  if (isNaN(num)) return { text: '0%', direction: 'neutral' };
  const prefix = num > 0 ? '+' : '';
  return { text: `${prefix}${num}%`, direction: num > 0 ? 'up' : num < 0 ? 'down' : 'neutral' };
}
