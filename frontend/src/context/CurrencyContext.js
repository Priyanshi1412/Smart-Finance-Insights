import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext(null);

const CURRENCY_CONFIG = {
  INR: { symbol: '₹', locale: 'en-IN', code: 'INR' },
  USD: { symbol: '$', locale: 'en-US', code: 'USD' },
  EUR: { symbol: '€', locale: 'de-DE', code: 'EUR' },
  GBP: { symbol: '£', locale: 'en-GB', code: 'GBP' },
  JPY: { symbol: '¥', locale: 'ja-JP', code: 'JPY' },
  AUD: { symbol: 'A$', locale: 'en-AU', code: 'AUD' },
  CAD: { symbol: 'C$', locale: 'en-CA', code: 'CAD' },
};

function getFormatters(currency) {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  const maximumFractionDigits = currency === 'JPY' ? 0 : 0;
  const formatter = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    maximumFractionDigits,
  });
  return { formatter, symbol: config.symbol };
}

export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [currency, setCurrency] = useState(() => {
    return user?.currency || localStorage.getItem('currency') || 'INR';
  });

  useEffect(() => {
    if (user?.currency) {
      setCurrency(user.currency);
      localStorage.setItem('currency', user.currency);
    }
  }, [user?.currency]);

  const formatCurrency = useCallback((value) => {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      const { symbol } = getFormatters(currency);
      return `${symbol}0`;
    }
    const { formatter } = getFormatters(currency);
    return formatter.format(num);
  }, [currency]);

  const getCurrencySymbol = useCallback(() => {
    const { symbol } = getFormatters(currency);
    return symbol;
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency, getCurrencySymbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

export { CURRENCY_CONFIG };
