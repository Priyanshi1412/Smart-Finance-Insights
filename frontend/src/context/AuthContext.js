import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, onSessionExpired, clearSession, isTokenExpired, getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const token = getToken();
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      if (isTokenExpired(token)) {
        clearSession();
      } else {
        try {
          setUser(JSON.parse(userStr));
        } catch {
          clearSession();
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setSessionExpired(true);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    setSessionExpired(false);
    return res.data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await authAPI.register({ name, email, password });
    return res.data;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setSessionExpired(false);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const dismissSessionExpired = useCallback(() => {
    clearSession();
    setUser(null);
    setSessionExpired(false);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      updateUser,
      sessionExpired,
      dismissSessionExpired,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
