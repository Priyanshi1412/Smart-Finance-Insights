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
