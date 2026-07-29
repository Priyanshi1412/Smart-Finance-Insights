function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && isFinite(num) && num >= 0 && num < 1e12;
}

function dateOnly(d) {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function fmtAmount(v) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
}

module.exports = { sanitizeString, validateEmail, validateAmount, dateOnly, fmtAmount };
