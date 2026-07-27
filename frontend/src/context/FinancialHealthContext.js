import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { dashboardAPI, analyticsAPI } from '../services/api';
import { calculateFinancialHealth } from '../utils/financialHealth';

const FinancialHealthContext = createContext(null);

export function FinancialHealthProvider({ children }) {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshHealth = useCallback(async () => {
    if (!user) {
      setHealth(null);
      setLoading(false);
      return;
    }
    try {
      const fhRes = await analyticsAPI.getFinancialHealth();
      const fhData = fhRes.data;
      setHealth({
        score: fhData.score,
        status: fhData.status,
        savingsRate: fhData.indicators.savingsRate,
        totalIncome: fhData.summary.totalIncome,
        totalExpenses: fhData.summary.totalExpenses,
        totalSavings: fhData.summary.savings,
        lastUpdated: fhData.lastUpdated,
      });
    } catch {
      try {
        const res = await dashboardAPI.getSummary();
        const { totalIncome, totalExpenses } = res.data;
        setHealth(calculateFinancialHealth(totalIncome, totalExpenses));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    if (!user) return;
    window.addEventListener('focus', refreshHealth);
    return () => window.removeEventListener('focus', refreshHealth);
  }, [user, refreshHealth]);

  return (
    <FinancialHealthContext.Provider value={{ health, loading, refreshHealth }}>
      {children}
    </FinancialHealthContext.Provider>
  );
}

export function useFinancialHealth() {
  const ctx = useContext(FinancialHealthContext);
  if (!ctx) throw new Error('useFinancialHealth must be used within FinancialHealthProvider');
  return ctx;
}
