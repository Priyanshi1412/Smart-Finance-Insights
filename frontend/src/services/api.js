import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

let sessionExpiredCallback = null;

export function onSessionExpired(cb) {
  sessionExpiredCallback = cb;
}

function isAuthRoute(config) {
  const url = config?.url || '';
  return url.includes('/api/login') || url.includes('/api/register');
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !isAuthRoute(config)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const config = err.config || {};

    if (status === 401 && !isAuthRoute(config)) {
      if (sessionExpiredCallback) {
        sessionExpiredCallback();
      }
    }

    return Promise.reject(err);
  }
);

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getToken() {
  return localStorage.getItem('token');
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiryMs = payload.exp * 1000;
    return Date.now() >= expiryMs;
  } catch {
    return true;
  }
}

export const authAPI = {
  register: (data) => api.post('/api/register', data),
  login: (data) => api.post('/api/login', data),
};

export const dashboardAPI = {
  getSummary: () => api.get('/api/dashboard/summary'),
  getRecentTransactions: () => api.get('/api/dashboard/recent-transactions'),
  getOverview: () => api.get('/api/dashboard/overview'),
};

export const incomeAPI = {
  getAll: () => api.get('/api/income'),
  create: (data) => api.post('/api/income', data),
  update: (id, data) => api.put(`/api/income/${id}`, data),
  delete: (id) => api.delete(`/api/income/${id}`),
};

export const expenseAPI = {
  getAll: () => api.get('/api/expenses'),
  create: (data) => api.post('/api/expenses', data),
  update: (id, data) => api.put(`/api/expenses/${id}`, data),
  delete: (id) => api.delete(`/api/expenses/${id}`),
};

export const budgetAPI = {
  getAll: () => api.get('/api/budget'),
  create: (data) => api.post('/api/budget', data),
  update: (id, data) => api.put(`/api/budget/${id}`, data),
  delete: (id) => api.delete(`/api/budget/${id}`),
};

export const goalAPI = {
  getAll: () => api.get('/api/goals'),
  create: (data) => api.post('/api/goals', data),
  update: (id, data) => api.put(`/api/goals/${id}`, data),
  delete: (id) => api.delete(`/api/goals/${id}`),
  addContribution: (id, data) => api.post(`/api/goals/${id}/contributions`, data),
  getAnalytics: () => api.get('/api/goals/analytics'),
};

export const investmentAPI = {
  getAll: () => api.get('/api/investments'),
  create: (data) => api.post('/api/investments', data),
  update: (id, data) => api.put(`/api/investments/${id}`, data),
  delete: (id) => api.delete(`/api/investments/${id}`),
  getAnalytics: () => api.get('/api/investments/analytics'),
};

export const portfolioAPI = {
  getAnalytics: () => api.get('/api/portfolio/analytics'),
};

export const settingsAPI = {
  clearAllData: () => api.delete('/api/clear-data'),
};

export const userAPI = {
  getAccountInfo: () => api.get('/api/user/account-info'),
  updateProfile: (data) => api.put('/api/user/profile', data),
  removeProfilePicture: () => api.delete('/api/user/profile-picture'),
  changePassword: (data) => api.put('/api/user/password', data),
  updateCurrency: (currency) => api.put('/api/user/currency', { currency }),
};

export const analyticsAPI = {
  getSpendingPatterns: () => api.get('/api/analytics/spending-patterns'),
  getBudgetRecommendations: () => api.get('/api/analytics/budget-recommendations'),
  getFinancialHealth: () => api.get('/api/analytics/financial-health'),
};

export const notificationAPI = {
  getAll: () => api.get('/api/notifications'),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
  generate: () => api.post('/api/notifications/generate'),
};

export const mlAPI = {
  getHealth: () => api.get('/api/ml/health'),
  getFinancialInsights: () => api.get('/api/ml/financial-insights'),
  getPredictions: () => api.get('/api/ml/predictions'),
  analyze: () => api.post('/api/ml/analyze'),
};

export const reportAPI = {
  getMonthlyExpenses: (month) => api.get(`/api/reports/monthly-expenses?month=${month}`),
  getBudgetUtilization: (month) => api.get(`/api/reports/budget-utilization?month=${month}`),
  getInvestmentPerformance: () => api.get('/api/reports/investment-performance'),
  getGoalProgress: () => api.get('/api/reports/goal-progress'),
  exportCSV: (type, month) => {
    let url = `/api/reports/export/csv?type=${type}`;
    if (month) url += `&month=${month}`;
    return api.get(url, { responseType: 'blob' });
  },
  exportPDF: (type, month) => {
    let url = `/api/reports/export/pdf?type=${type}`;
    if (month) url += `&month=${month}`;
    return api.get(url);
  },
  askJARVIS: (message) => api.post('/api/jarvis/chat', { message }),
};

export const exportAPI = {
  expensePDF: () => api.get('/api/export/expenses/pdf', { responseType: 'blob' }),
  expenseCSV: () => api.get('/api/export/expenses/csv', { responseType: 'blob' }),
  expenseExcel: () => api.get('/api/export/expenses/xlsx', { responseType: 'blob' }),
  investmentPDF: () => api.get('/api/export/investments/pdf', { responseType: 'blob' }),
  investmentCSV: () => api.get('/api/export/investments/csv', { responseType: 'blob' }),
  investmentExcel: () => api.get('/api/export/investments/excel', { responseType: 'blob' }),
  financialPDF: () => api.get('/api/export/financial-report/pdf', { responseType: 'blob' }),
  financialCSV: () => api.get('/api/export/financial-report/csv', { responseType: 'blob' }),
  financialExcel: () => api.get('/api/export/financial-report/xlsx', { responseType: 'blob' }),
  goalPDF: () => api.get('/api/export/goals/pdf', { responseType: 'blob' }),
  goalCSV: () => api.get('/api/export/goals/csv', { responseType: 'blob' }),
  goalExcel: () => api.get('/api/export/goals/xlsx', { responseType: 'blob' }),
  comprehensiveCSV: () => api.get('/api/export/comprehensive/csv', { responseType: 'blob' }),
};

export const feedbackAPI = {
  submit: (data) => api.post('/api/feedback', data),
};

export default api;
