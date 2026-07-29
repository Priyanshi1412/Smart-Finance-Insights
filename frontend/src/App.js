import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/ui/LoadingSpinner';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Income = lazy(() => import('./pages/Income'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Budget = lazy(() => import('./pages/Budget'));
const Reports = lazy(() => import('./pages/Reports'));
const Investments = lazy(() => import('./pages/Investments'));
const PortfolioAnalytics = lazy(() => import('./pages/PortfolioAnalytics'));
const AssetAllocation = lazy(() => import('./pages/AssetAllocation'));
const FinancialGoalPlanning = lazy(() => import('./pages/FinancialGoalPlanning'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const Settings = lazy(() => import('./pages/Settings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const SpendingPatternAnalysis = lazy(() => import('./pages/SpendingPatternAnalysis'));
const IntelligenceDashboard = lazy(() => import('./pages/IntelligenceDashboard'));

const PageLoader = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <LoadingSpinner text="Loading..." />
  </div>
);

function SessionExpiredModal() {
  const { dismissSessionExpired } = useAuth();
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '32px',
        maxWidth: '400px', width: '90%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--warning-glow)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '1.5rem',
        }}>
          ⏰
        </div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Session Expired
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Your session has expired. Please log in again to continue.
        </p>
        <button
          onClick={dismissSessionExpired}
          style={{
            padding: '10px 28px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.9rem', transition: 'opacity 0.2s',
          }}
        >
          Log In Again
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return PageLoader;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return PageLoader;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  const { sessionExpired } = useAuth();

  return (
    <ErrorBoundary>
      <Suspense fallback={PageLoader}>
        {sessionExpired && <SessionExpiredModal />}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/confirmation" element={<ProtectedRoute><Confirmation /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/income" element={<ProtectedRoute><Income /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/investments" element={<ProtectedRoute><Investments /></ProtectedRoute>} />
          <Route path="/portfolio-analytics" element={<ProtectedRoute><PortfolioAnalytics /></ProtectedRoute>} />
          <Route path="/asset-allocation" element={<ProtectedRoute><AssetAllocation /></ProtectedRoute>} />
          <Route path="/financial-goal-planning" element={<ProtectedRoute><FinancialGoalPlanning /></ProtectedRoute>} />
          <Route path="/ai-insights" element={<ProtectedRoute><AIInsights /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/spending-pattern-analysis" element={<ProtectedRoute><SpendingPatternAnalysis /></ProtectedRoute>} />
          <Route path="/intelligence" element={<ProtectedRoute><IntelligenceDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
