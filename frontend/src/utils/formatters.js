const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function fmt(value) {
  return currencyFormatter.format(value || 0);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
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
