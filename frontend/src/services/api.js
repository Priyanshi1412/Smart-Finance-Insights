import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data) => api.post('/api/register', data),
  login: (data) => api.post('/api/login', data),
};

export const dashboardAPI = {
  getSummary: () => api.get('/api/dashboard/summary'),
  getRecentTransactions: () => api.get('/api/dashboard/recent-transactions'),
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

export default api;
