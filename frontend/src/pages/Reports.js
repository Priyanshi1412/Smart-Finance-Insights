import { useState, useMemo, useCallback, useRef } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { reportAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import JARVISAssistant from '../components/JARVISAssistant';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, RadialLinearScale, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, RadialLinearScale, Filler,
);

const TABS = [
  { id: 'monthly-expenses', label: 'Monthly Expenses', icon: icons.expenses },
  { id: 'budget-utilization', label: 'Budget Utilization', icon: icons.budget },
  { id: 'investment-performance', label: 'Investment Performance', icon: icons.investments },
  { id: 'goal-progress', label: 'Goal Progress', icon: icons.target },
];

const PALETTE = ['#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B', '#14B8A6', '#EC4899', '#6366F1', '#10B981', '#F97316', '#06B6D4'];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    options.push({ value: key, label });
  }
  return options;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { currency, formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState('monthly-expenses');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null);
  const reportRef = useRef(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const needsMonth = activeTab === 'monthly-expenses' || activeTab === 'budget-utilization';

  const fmt = useCallback((v) => formatCurrency(v || 0), [formatCurrency]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setReportData(null);
    setError('');
    try {
      let res;
      switch (activeTab) {
        case 'monthly-expenses':
          res = await reportAPI.getMonthlyExpenses(selectedMonth);
          break;
        case 'budget-utilization':
          res = await reportAPI.getBudgetUtilization(selectedMonth);
          break;
        case 'investment-performance':
          res = await reportAPI.getInvestmentPerformance();
          break;
        case 'goal-progress':
          res = await reportAPI.getGoalProgress();
          break;
        default:
          return;
      }
      setReportData(res.data);
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate report. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedMonth]);

  const handleExportCSV = useCallback(async () => {
    setExporting('csv');
    try {
      const res = await reportAPI.exportCSV(activeTab, needsMonth ? selectedMonth : undefined);
      downloadBlob(new Blob([res.data], { type: 'text/csv' }), `${activeTab}-report.csv`);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setExporting(null);
    }
  }, [activeTab, needsMonth, selectedMonth]);

  const handleExportPDF = useCallback(async () => {
    setExporting('pdf');
    try {
      const res = await reportAPI.exportPDF(activeTab, needsMonth ? selectedMonth : undefined);
      const htmlContent = res.data;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(null);
    }
  }, [activeTab, needsMonth, selectedMonth]);

  return (
    <Layout title="Advanced Financial Reports">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        .report-tab-active { background: var(--accent-glow-strong) !important; color: var(--accent-light) !important; border-color: rgba(59,130,246,0.3) !important; }
        .report-table tr:hover td { background: var(--bg-glass); }
      `}</style>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setReportData(null); }}
              className={activeTab === tab.id ? 'report-tab-active' : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                background: activeTab === tab.id ? undefined : 'var(--bg-glass)',
                border: activeTab === tab.id ? undefined : '1px solid var(--border-light)',
                color: activeTab === tab.id ? undefined : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeTab === tab.id ? 600 : 500,
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon path={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 200 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon path={icons.clock} size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {needsMonth ? 'Select Month' : 'Report Type'}
              </div>
              {needsMonth ? (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {TABS.find(t => t.id === activeTab)?.label}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 24px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              opacity: loading ? 0.7 : 1,
              transition: 'all var(--transition-fast)',
            }}
          >
            <Icon path={loading ? 'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83' : icons.activity} size={16} />
            {loading ? 'Generating...' : 'Generate Report'}
          </button>

          {reportData && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleExportCSV}
                disabled={exporting === 'csv'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <Icon path={icons.barChart} size={14} />
                {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting === 'pdf'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-glow)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: 'var(--danger-light)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <Icon path={icons.trendingDown} size={14} />
                {exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
          )}
        </div>
      </Card>

      {loading && <LoadingSpinner text={`Generating ${TABS.find(t => t.id === activeTab)?.label}...`} />}

      {!loading && error && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--danger-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Icon path="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={24} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger-light)', margin: '0 0 8px' }}>
              Report Generation Failed
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px', maxWidth: 400, marginInline: 'auto' }}>
              {error}
            </p>
            <button
              onClick={generateReport}
              style={{
                padding: '10px 24px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
              }}
            >
              <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={16} />
              Retry
            </button>
          </div>
        </Card>
      )}

      {!loading && !error && !reportData && (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Icon path={icons.reports} size={28} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px', maxWidth: 400, marginInline: 'auto' }}>
              {needsMonth
                ? `Select a month and click "Generate Report" to view your ${activeTab === 'monthly-expenses' ? 'expense' : 'budget utilization'} report.`
                : 'Click "Generate Report" to view your report.'}
            </p>
            <button
              onClick={generateReport}
              style={{
                padding: '10px 24px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              }}
            >
              Generate Report
            </button>
          </div>
        </Card>
      )}

      {!loading && !error && reportData && (
        <div ref={reportRef} style={{ animation: 'fadeIn 0.4s ease-out' }}>
          {activeTab === 'monthly-expenses' && reportData.categoryBreakdown?.length === 0 && (
            <EmptyState
              title="No Expense Data"
              message={`No expenses found for ${selectedMonth}. Start tracking your expenses to see reports.`}
              onRetry={generateReport}
            />
          )}
          {activeTab === 'monthly-expenses' && reportData.categoryBreakdown?.length > 0 && (
            <MonthlyExpenseReport data={reportData} fmt={fmt} />
          )}
          {activeTab === 'budget-utilization' && reportData.categories?.length === 0 && (
            <EmptyState
              title="No Budget Data"
              message={`No budgets found for ${selectedMonth}. Set budgets for your categories to see utilization reports.`}
              onRetry={generateReport}
            />
          )}
          {activeTab === 'budget-utilization' && reportData.categories?.length > 0 && (
            <BudgetUtilizationReport data={reportData} fmt={fmt} />
          )}
          {activeTab === 'investment-performance' && reportData.summary?.totalInvestments === 0 && (
            <EmptyState
              title="No Investment Data"
              message="No investments found. Add your investments to track portfolio performance."
              onRetry={generateReport}
            />
          )}
          {activeTab === 'investment-performance' && reportData.summary?.totalInvestments > 0 && (
            <InvestmentPerformanceReport data={reportData} fmt={fmt} />
          )}
          {activeTab === 'goal-progress' && reportData.summary?.total === 0 && (
            <EmptyState
              title="No Goal Data"
              message="No financial goals found. Create goals to track your savings progress."
              onRetry={generateReport}
            />
          )}
          {activeTab === 'goal-progress' && reportData.summary?.total > 0 && (
            <GoalProgressReport data={reportData} fmt={fmt} />
          )}
        </div>
      )}

      <JARVISAssistant embedded />
    </Layout>
  );
}

function MonthlyExpenseReport({ data, fmt }) {
  const categoryChartData = useMemo(() => ({
    labels: data.categoryBreakdown.map(c => c.category),
    datasets: [{
      data: data.categoryBreakdown.map(c => c.amount),
      backgroundColor: PALETTE.slice(0, data.categoryBreakdown.length),
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  }), [data]);

  const dailyChartData = useMemo(() => ({
    labels: data.dailySummary.map(d => {
      const dt = new Date(d.date);
      return `${dt.getDate()}/${dt.getMonth() + 1}`;
    }),
    datasets: [{
      label: 'Daily Expenses',
      data: data.dailySummary.map(d => d.amount),
      backgroundColor: 'rgba(59,130,246,0.6)',
      borderColor: '#3B82F6',
      borderWidth: 2,
      borderRadius: 4,
      borderSkipped: false,
    }],
  }), [data]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Expenses', value: fmt(data.totalExpenses), icon: icons.trendingDown, color: 'var(--danger-light)', bg: 'var(--danger-glow)' },
          { label: 'Total Income', value: fmt(data.totalIncome), icon: icons.trendingUp, color: 'var(--success-light)', bg: 'var(--success-glow)' },
          { label: 'Savings Rate', value: `${data.savingsRate}%`, icon: icons.piggyBank, color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
          { label: 'Transactions', value: data.transactionCount, icon: icons.activity, color: 'var(--purple-light)', bg: 'var(--purple-glow)' },
        ].map((m, i) => (
          <Card key={i} hoverable>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={m.icon} size={20} />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{m.label}</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: m.color }}>{m.value}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.barChart} size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Month-over-Month Comparison</h2>
        </div>
        {data.comparison.change !== null && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            background: data.comparison.changeType === 'decrease' ? 'var(--success-glow)' : 'var(--danger-glow)',
            color: data.comparison.changeType === 'decrease' ? 'var(--success-light)' : 'var(--danger-light)',
            fontSize: '0.8rem', fontWeight: 600, marginBottom: '16px',
          }}>
            <Icon path={data.comparison.changeType === 'decrease' ? icons.trendingUp : icons.trendingDown} size={14} />
            {Math.abs(data.comparison.change)}% {data.comparison.changeType} vs previous month ({fmt(data.comparison.previousExpenses)})
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Expense Distribution</h2>
          </div>
          <div style={{ height: 300 }}>
            <Doughnut
              data={categoryChartData}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                  legend: { position: 'right', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                  tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } },
                },
              }}
            />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Daily Expense Trend</h2>
          </div>
          <div style={{ height: 300 }}>
            <Bar
              data={dailyChartData}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => fmt(ctx.raw) } },
                },
                scales: {
                  x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 } } },
                  y: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
                },
              }}
            />
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.target} size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Category Breakdown</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Category', 'Amount', 'Percentage', 'Bar'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.categoryBreakdown.map((cat, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                      {cat.category}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>{fmt(cat.amount)}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>{cat.percentage}%</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ width: '100%', maxWidth: 200, height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ width: `${cat.percentage}%`, height: '100%', borderRadius: 3, background: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
          {data.highestCategory && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Highest Spending</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger-light)' }}>{data.highestCategory.category}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmt(data.highestCategory.amount)} ({data.highestCategory.percentage}%)</div>
            </div>
          )}
          {data.lowestCategory && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Lowest Spending</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success-light)' }}>{data.lowestCategory.category}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmt(data.lowestCategory.amount)} ({data.lowestCategory.percentage}%)</div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function BudgetUtilizationReport({ data, fmt }) {
  const budgetChartData = useMemo(() => ({
    labels: data.categories.map(c => c.category),
    datasets: [
      { label: 'Spent', data: data.categories.map(c => c.spent), backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#EF4444', borderWidth: 2, borderRadius: 4 },
      { label: 'Remaining', data: data.categories.map(c => c.remaining), backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10B981', borderWidth: 2, borderRadius: 4 },
    ],
  }), [data]);

  const doughnutData = useMemo(() => ({
    labels: ['Spent', 'Remaining'],
    datasets: [{
      data: [data.totalSpent, data.remaining],
      backgroundColor: ['rgba(239,68,68,0.8)', 'rgba(16,185,129,0.8)'],
      borderColor: '#111827',
      borderWidth: 3,
    }],
  }), [data]);

  const statusColor = (status) => {
    switch (status) {
      case 'Safe': return { color: 'var(--success-light)', bg: 'var(--success-glow)' };
      case 'Warning': return { color: 'var(--warning-light)', bg: 'var(--warning-glow)' };
      case 'Exceeded': return { color: 'var(--danger-light)', bg: 'var(--danger-glow)' };
      default: return { color: 'var(--text-muted)', bg: 'var(--bg-glass)' };
    }
  };

  const overallColor = statusColor(
    data.overallStatus === 'Healthy' ? 'Safe' : data.overallStatus === 'At Risk' ? 'Warning' : 'Exceeded'
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Budget', value: fmt(data.totalBudget), icon: icons.budget, color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
          { label: 'Total Spent', value: fmt(data.totalSpent), icon: icons.trendingDown, color: 'var(--danger-light)', bg: 'var(--danger-glow)' },
          { label: 'Remaining', value: fmt(data.remaining), icon: icons.trendingUp, color: 'var(--success-light)', bg: 'var(--success-glow)' },
          { label: 'Overall Status', value: data.overallStatus, icon: icons.shield, color: overallColor.color, bg: overallColor.bg },
        ].map((m, i) => (
          <Card key={i} hoverable>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={m.icon} size={20} />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{m.label}</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: m.color }}>{m.value}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: overallColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.shield} size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Budget Health</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overall Utilization</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: overallColor.color }}>{data.overallPercentUsed}%</span>
            </div>
            <div style={{ width: '100%', height: 12, borderRadius: 6, background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(data.overallPercentUsed, 100)}%`,
                height: '100%', borderRadius: 6,
                background: data.overallPercentUsed >= 100 ? 'var(--danger)' : data.overallPercentUsed >= 75 ? 'var(--warning)' : 'var(--success)',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { label: 'Safe', count: data.summary.safeCount, color: 'var(--success)' },
              { label: 'Warning', count: data.summary.warningCount, color: 'var(--warning)' },
              { label: 'Exceeded', count: data.summary.exceededCount, color: 'var(--danger)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Budget vs Spent</h2>
          </div>
          <div style={{ height: 300 }}>
            <Bar
              data={budgetChartData}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
                  tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
                },
                scales: {
                  x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 } } },
                  y: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
                },
              }}
            />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Spending Distribution</h2>
          </div>
          <div style={{ height: 300 }}>
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                  legend: { position: 'right', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                  tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } },
                },
              }}
            />
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.target} size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Category Details</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Category', 'Budget', 'Spent', 'Remaining', 'Utilization', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.categories.map((cat, i) => {
                const sc = statusColor(cat.status);
                return (
                  <tr key={i}>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{cat.category}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>{fmt(cat.budgetLimit)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>{fmt(cat.spent)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--success-light)', borderBottom: '1px solid var(--border-light)' }}>{fmt(cat.remaining)}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', minWidth: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(cat.percentUsed, 100)}%`, height: '100%', borderRadius: 4,
                            background: cat.status === 'Exceeded' ? 'var(--danger)' : cat.status === 'Warning' ? 'var(--warning)' : 'var(--success)',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 40 }}>{cat.percentUsed}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        background: sc.bg, color: sc.color,
                        fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {cat.status === 'Safe' && '✓'} {cat.status === 'Warning' && '⚠'} {cat.status === 'Exceeded' && '✕'} {cat.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function InvestmentPerformanceReport({ data, fmt }) {
  const allocationData = useMemo(() => ({
    labels: data.typeAllocation.map(t => t.type),
    datasets: [{
      data: data.typeAllocation.map(t => t.currentValue),
      backgroundColor: PALETTE.slice(0, data.typeAllocation.length),
      borderColor: '#111827',
      borderWidth: 3,
    }],
  }), [data]);

  const growthData = useMemo(() => {
    const sorted = [...data.performance].sort((a, b) => new Date(a.investedDate) - new Date(b.investedDate));
    return {
      labels: sorted.map(p => p.name.length > 12 ? p.name.slice(0, 12) + '...' : p.name),
      datasets: [
        { label: 'Invested', data: sorted.map(p => p.amount), backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3B82F6', borderWidth: 2, borderRadius: 4 },
        { label: 'Current Value', data: sorted.map(p => p.currentValue), backgroundColor: sorted.map(p => p.profitLoss >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'), borderColor: sorted.map(p => p.profitLoss >= 0 ? '#10B981' : '#EF4444'), borderWidth: 2, borderRadius: 4 },
      ],
    };
  }, [data]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Invested', value: fmt(data.summary.totalInvested), icon: icons.trendingUp, color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
          { label: 'Current Value', value: fmt(data.summary.totalCurrentValue), icon: icons.barChart, color: 'var(--success-light)', bg: 'var(--success-glow)' },
          { label: 'Profit / Loss', value: fmt(data.summary.totalProfitLoss), icon: data.summary.totalProfitLoss >= 0 ? icons.trendingUp : icons.trendingDown, color: data.summary.totalProfitLoss >= 0 ? 'var(--success-light)' : 'var(--danger-light)', bg: data.summary.totalProfitLoss >= 0 ? 'var(--success-glow)' : 'var(--danger-glow)' },
          { label: 'Overall ROI', value: `${data.summary.overallROI}%`, icon: icons.activity, color: data.summary.overallROI >= 0 ? 'var(--success-light)' : 'var(--danger-light)', bg: data.summary.overallROI >= 0 ? 'var(--success-glow)' : 'var(--danger-glow)' },
        ].map((m, i) => (
          <Card key={i} hoverable>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={m.icon} size={20} />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{m.label}</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: m.color }}>{m.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.barChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Investment Comparison</h2>
          </div>
          <div style={{ height: 300 }}>
            <Bar
              data={growthData}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
                  tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
                },
                scales: {
                  x: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 }, maxRotation: 45 } },
                  y: { grid: { color: 'rgba(51,65,85,0.3)', drawBorder: false }, ticks: { color: '#64748B', font: { size: 10 }, callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
                },
              }}
            />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Asset Allocation</h2>
          </div>
          <div style={{ height: 300 }}>
            <Doughnut
              data={allocationData}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                  legend: { position: 'right', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                  tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` } },
                },
              }}
            />
          </div>
        </Card>
      </div>

      {(data.bestPerformer || data.worstPerformer) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {data.bestPerformer && (
            <Card hoverable>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.trendingUp} size={18} style={{ color: 'var(--success-light)' }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Best Performer</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{data.bestPerformer.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ROI: <span style={{ color: 'var(--success-light)', fontWeight: 700 }}>+{data.bestPerformer.roi}%</span></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type: {data.bestPerformer.type}</div>
            </Card>
          )}
          {data.worstPerformer && (
            <Card hoverable>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={icons.trendingDown} size={18} style={{ color: 'var(--danger-light)' }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Worst Performer</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{data.worstPerformer.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ROI: <span style={{ color: 'var(--danger-light)', fontWeight: 700 }}>{data.worstPerformer.roi}%</span></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type: {data.worstPerformer.type}</div>
            </Card>
          )}
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.target} size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Investment Details</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Type', 'Category', 'Invested', 'Current Value', 'Profit/Loss', 'ROI', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.performance.map((inv, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>{inv.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>{inv.type}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>{inv.category}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>{fmt(inv.amount)}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>{fmt(inv.currentValue)}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600, color: inv.profitLoss >= 0 ? 'var(--success-light)' : 'var(--danger-light)', borderBottom: '1px solid var(--border-light)' }}>
                    {inv.profitLoss >= 0 ? '+' : ''}{fmt(inv.profitLoss)}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                      background: inv.roi >= 0 ? 'var(--success-glow)' : 'var(--danger-glow)',
                      color: inv.roi >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
                      fontSize: '0.8rem', fontWeight: 600,
                    }}>
                      {inv.roi >= 0 ? '+' : ''}{inv.roi}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>{inv.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function GoalProgressReport({ data, fmt }) {
  const completionData = useMemo(() => ({
    labels: ['Active', 'Achieved', 'Overdue', 'Paused'],
    datasets: [{
      data: [data.summary.active, data.summary.achieved, data.summary.overdue, data.summary.paused],
      backgroundColor: ['#3B82F6', '#10B981', '#EF4444', '#F59E0B'],
      borderColor: '#111827',
      borderWidth: 3,
    }],
  }), [data]);

  const statusColor = (status) => {
    switch (status) {
      case 'active': return { color: 'var(--accent-light)', bg: 'var(--accent-glow)' };
      case 'achieved': return { color: 'var(--success-light)', bg: 'var(--success-glow)' };
      case 'overdue': return { color: 'var(--danger-light)', bg: 'var(--danger-glow)' };
      case 'paused': return { color: 'var(--warning-light)', bg: 'var(--warning-glow)' };
      default: return { color: 'var(--text-muted)', bg: 'var(--bg-glass)' };
    }
  };

  const priorityColor = (p) => {
    switch (p) {
      case 'high': return 'var(--danger-light)';
      case 'medium': return 'var(--warning-light)';
      case 'low': return 'var(--success-light)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Goals', value: data.summary.total, icon: icons.target, color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
          { label: 'Active Goals', value: data.summary.active, icon: icons.activity, color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
          { label: 'Achieved', value: data.summary.achieved, icon: icons.trendingUp, color: 'var(--success-light)', bg: 'var(--success-glow)' },
          { label: 'Overdue', value: data.summary.overdue, icon: icons.trendingDown, color: 'var(--danger-light)', bg: 'var(--danger-glow)' },
        ].map((m, i) => (
          <Card key={i} hoverable>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={m.icon} size={20} />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{m.label}</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: m.color }}>{m.value}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.shield} size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Overall Progress</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Saved</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-light)' }}>{data.summary.overallCompletion}%</span>
            </div>
            <div style={{ width: '100%', height: 14, borderRadius: 7, background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(data.summary.overallCompletion, 100)}%`, height: '100%', borderRadius: 7,
                background: 'linear-gradient(90deg, var(--accent), var(--purple))',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saved: {fmt(data.summary.totalSaved)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: {fmt(data.summary.totalTarget)}</span>
            </div>
          </div>
          <div style={{ height: 80, width: 80, position: 'relative' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-input)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeDasharray={`${data.summary.overallCompletion * 2.51} ${251 - data.summary.overallCompletion * 2.51}`}
                strokeLinecap="round"
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-light)',
            }}>
              {data.summary.overallCompletion}%
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Goal Status Distribution</h2>
          </div>
          <div style={{ height: 280 }}>
            <Doughnut
              data={completionData}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                  legend: { position: 'right', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                  tooltip: { backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8', borderColor: '#334155', borderWidth: 1, cornerRadius: 8 },
                },
              }}
            />
          </div>
        </Card>

        {data.categoryDistribution.length > 0 && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={icons.barChart} size={18} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Category Distribution</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.categoryDistribution.map((cat, i) => {
                const pct = data.summary.totalTarget > 0 ? Math.round((cat.value / data.summary.totalTarget) * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{cat.category}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(cat.value)} ({pct}%)</span>
                    </div>
                    <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.target} size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Goal Details</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.goals.map((goal, i) => {
            const sc = statusColor(goal.status);
            return (
              <div key={i} style={{
                padding: '16px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{goal.goalName}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: sc.bg, color: sc.color,
                        fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize',
                      }}>
                        {goal.status}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: priorityColor(goal.priority), fontWeight: 600, textTransform: 'capitalize' }}>
                        {goal.priority} priority
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{goal.category}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-light)' }}>{goal.completionPercent}%</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>complete</div>
                  </div>
                </div>
                <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{
                    width: `${Math.min(goal.completionPercent, 100)}%`, height: '100%', borderRadius: 4,
                    background: goal.status === 'achieved' ? 'var(--success)' : goal.status === 'overdue' ? 'var(--danger)' : 'linear-gradient(90deg, var(--accent), var(--purple))',
                  }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { label: 'Target', value: fmt(goal.targetAmount) },
                    { label: 'Saved', value: fmt(goal.savedAmount) },
                    { label: 'Remaining', value: fmt(goal.remaining) },
                    { label: 'Monthly', value: fmt(goal.monthlySaving) },
                  ].map((item, j) => (
                    <div key={j} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{item.label}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {goal.estimatedCompletion && goal.status === 'active' && (
                  <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Est. completion: {new Date(goal.estimatedCompletion).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function EmptyState({ title, message, onRetry }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Icon path={icons.reports} size={28} />
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px', maxWidth: 400, marginInline: 'auto' }}>
          {message}
        </p>
        <button
          onClick={onRetry}
          style={{
            padding: '10px 24px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}
        >
          <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={16} />
          Refresh
        </button>
      </div>
    </Card>
  );
}
