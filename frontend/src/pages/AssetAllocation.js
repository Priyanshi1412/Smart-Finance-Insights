import { useState, useEffect, useMemo, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import ProgressRing from '../components/ui/ProgressRing';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { investmentAPI } from '../services/api';
import {
  Chart as ChartJS,
  ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const TYPE_COLORS = {
  'Stocks': '#3B82F6', 'Mutual Funds': '#10B981', 'Fixed Deposit': '#F59E0B',
  'PPF': '#8B5CF6', 'NPS': '#EC4899', 'Crypto': '#F97316', 'Gold': '#EAB308',
  'Real Estate': '#EF4444', 'Bonds': '#06B6D4', 'ETF': '#14B8A6', 'Other': '#6B7280',
};

const CATEGORY_COLORS = {
  'Emergency Fund': '#10B981', 'Travel': '#3B82F6', 'Education': '#8B5CF6',
  'Technology': '#14B8A6', 'Vehicle': '#F59E0B', 'Real Estate': '#EF4444',
  'Wedding': '#EC4899', 'Retirement': '#2563EB', 'Health': '#34D399',
  'Shopping': '#FBBF24', 'Other': '#6B7280',
};

const ALL_TYPES = Object.keys(TYPE_COLORS);
const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS);

const s = {
  subtitle: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' },
  statCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    padding: '20px 24px', backdropFilter: 'blur(12px)', transition: 'all var(--transition-base)',
    animation: 'fadeIn 0.4s ease-out', position: 'relative', overflow: 'hidden',
  },
  statIcon: { width: 44, height: 44, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' },
  statAmount: { fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '4px' },
  statLabel: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' },
  statDesc: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px', marginBottom: '28px' },
  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px',
    padding: '16px 20px', borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
  },
  filterLabel: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' },
  filterSelect: {
    padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
    minWidth: 160,
  },
  perfTable: { width: '100%', borderCollapse: 'collapse' },
  perfTh: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' },
  perfTd: { fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' },
  roiCard: {
    background: 'var(--bg-glass)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)',
    padding: '16px 18px', transition: 'all var(--transition-fast)',
  },
  roiLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' },
  roiValue: { fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' },
  legendDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  legendName: { color: 'var(--text-muted)' },
  legendValue: { color: 'var(--text-secondary)', fontWeight: 600 },
  legendPct: { color: 'var(--text-muted)', fontSize: '0.75rem' },
};

function SummaryCard({ icon, amount, label, desc, color, delay }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        ...s.statCard,
        ...(hover ? { borderColor: color, boxShadow: `0 8px 32px ${color}20`, transform: 'translateY(-3px)' } : {}),
        animationDelay: delay,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ ...s.statIcon, background: `${color}18` }}>
        <Icon path={icon} size={22} />
      </div>
      <div style={{ ...s.statAmount, color }}>{amount}</div>
      <div style={s.statLabel}>{label}</div>
      {desc && <div style={s.statDesc}>{desc}</div>}
    </div>
  );
}

export default function AssetAllocation() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await investmentAPI.getAnalytics();
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = analytics?.summary;
  const profitColor = (summary?.totalReturns || 0) >= 0 ? 'var(--success)' : 'var(--danger)';

  const filteredPerformance = useMemo(() => {
    if (!analytics?.performance) return [];
    return analytics.performance.filter(p => {
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (filterCategory !== 'all' && p.category !== filterCategory) return false;
      return true;
    });
  }, [analytics, filterType, filterCategory]);

  const filteredTypeBreakdown = useMemo(() => {
    if (!analytics?.typeBreakdown) return [];
    if (filterType === 'all') return analytics.typeBreakdown;
    return analytics.typeBreakdown.filter(t => t.type === filterType);
  }, [analytics, filterType]);

  const filteredCategoryBreakdown = useMemo(() => {
    if (!analytics?.categoryBreakdown) return [];
    if (filterCategory === 'all') return analytics.categoryBreakdown;
    return analytics.categoryBreakdown.filter(c => c.category === filterCategory);
  }, [analytics, filterCategory]);

  const filteredTotals = useMemo(() => {
    const invested = filteredPerformance.reduce((s, p) => s + (p.amount || 0), 0);
    const current = filteredPerformance.reduce((s, p) => s + (p.currentValue || 0), 0);
    const returns = current - invested;
    const roi = invested > 0 ? ((returns / invested) * 100) : 0;
    return { invested, current, returns, roi: Math.round(roi * 100) / 100 };
  }, [filteredPerformance]);

  const typeDoughnutData = useMemo(() => {
    const data = filterType === 'all' ? analytics?.typeBreakdown : filteredTypeBreakdown;
    if (!data || data.length === 0) return null;
    const total = data.reduce((s, t) => s + t.currentValue, 0);
    return {
      labels: data.map(t => t.type),
      datasets: [{
        data: data.map(t => t.currentValue),
        backgroundColor: data.map(t => (TYPE_COLORS[t.type] || '#6B7280') + 'CC'),
        borderColor: '#111827', borderWidth: 3, hoverOffset: 8,
      }],
    };
  }, [analytics, filterType, filteredTypeBreakdown]);

  const categoryDoughnutData = useMemo(() => {
    const data = filterCategory === 'all' ? analytics?.categoryBreakdown : filteredCategoryBreakdown;
    if (!data || data.length === 0) return null;
    return {
      labels: data.map(c => c.category),
      datasets: [{
        data: data.map(c => c.currentValue),
        backgroundColor: data.map(c => (CATEGORY_COLORS[c.category] || '#6B7280') + 'CC'),
        borderColor: '#111827', borderWidth: 3, hoverOffset: 8,
      }],
    };
  }, [analytics, filterCategory, filteredCategoryBreakdown]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B', titleColor: '#F1F5F9', bodyColor: '#94A3B8',
        borderColor: '#334155', borderWidth: 1, cornerRadius: 8, padding: 12,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
          },
        },
      },
    },
  };

  const chartTooltipStyle = {
    contentStyle: {
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    },
  };

  if (loading) {
    return (
      <Layout title="Asset Allocation">
        <LoadingSpinner text="Loading asset allocation..." />
      </Layout>
    );
  }

  if (!analytics || !summary || summary.totalCount === 0) {
    return (
      <Layout title="Asset Allocation">
        <EmptyState
          icon={icons.pieChart}
          title="No investment data"
          description="Add investments to see your asset allocation breakdown and diversification analysis"
        />
      </Layout>
    );
  }

  const div = analytics.diversification;
  const divColor = div.score >= 70 ? 'var(--success)' : div.score >= 40 ? 'var(--warning)' : 'var(--danger)';

  const typeTotal = filteredTypeBreakdown.reduce((s, t) => s + t.currentValue, 0);
  const catTotal = filteredCategoryBreakdown.reduce((s, c) => s + c.currentValue, 0);

  return (
    <Layout title="Asset Allocation">
      <div style={{ marginBottom: '24px' }}>
        <h3 style={s.subtitle}>Analyze how your investments are distributed across asset classes and categories</h3>
      </div>

      {/* ===== Filters ===== */}
      <div style={s.filterBar}>
        <div>
          <div style={s.filterLabel}>Filter by Type</div>
          <select style={s.filterSelect} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            {ALL_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={s.filterLabel}>Filter by Category</div>
          <select style={s.filterSelect} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {(filterType !== 'all' || filterCategory !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => { setFilterType('all'); setFilterCategory('all'); }}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
                background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--danger-light)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* ===== Summary Cards ===== */}
      <div style={s.statsGrid}>
        <SummaryCard icon={icons.investments} amount={fmt(filteredTotals.invested)} label="Total Investment" desc={`${filteredPerformance.length} investments`} color="var(--purple)" delay="0s" />
        <SummaryCard icon={icons.trendingUp} amount={fmt(filteredTotals.current)} label="Current Value" desc="Portfolio current worth" color="var(--success)" delay="0.05s" />
        <SummaryCard icon={icons.activity} amount={`${filteredTotals.returns >= 0 ? '+' : ''}${fmt(filteredTotals.returns)}`} label="Profit / Loss" desc={filteredTotals.returns >= 0 ? 'In profit' : 'In loss'} color={profitColor} delay="0.1s" />
        <SummaryCard icon={icons.target} amount={`${filteredTotals.roi >= 0 ? '+' : ''}${filteredTotals.roi}%`} label="Return on Investment" desc="Overall ROI" color={profitColor} delay="0.15s" />
      </div>

      {/* ===== Asset Allocation Charts ===== */}
      <div style={s.twoCol}>
        {/* Type Allocation Doughnut */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Allocation by Type</h2>
          </div>
          {typeDoughnutData ? (
            <>
              <div style={{ height: 220, display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={typeDoughnutData} options={doughnutOptions} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginTop: '16px' }}>
                {filteredTypeBreakdown.map((t, i) => {
                  const pct = typeTotal > 0 ? ((t.currentValue / typeTotal) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} style={s.legendItem}>
                      <span style={{ ...s.legendDot, background: TYPE_COLORS[t.type] || '#6B7280' }} />
                      <span style={s.legendName}>{t.type}</span>
                      <span style={s.legendValue}>{fmt(t.currentValue)}</span>
                      <span style={s.legendPct}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No type data</div>
          )}
        </Card>

        {/* Category Allocation Doughnut */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Allocation by Category</h2>
          </div>
          {categoryDoughnutData ? (
            <>
              <div style={{ height: 220, display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={categoryDoughnutData} options={doughnutOptions} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginTop: '16px' }}>
                {filteredCategoryBreakdown.map((c, i) => {
                  const pct = catTotal > 0 ? ((c.currentValue / catTotal) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} style={s.legendItem}>
                      <span style={{ ...s.legendDot, background: CATEGORY_COLORS[c.category] || '#6B7280' }} />
                      <span style={s.legendName}>{c.category}</span>
                      <span style={s.legendValue}>{fmt(c.currentValue)}</span>
                      <span style={s.legendPct}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No category data</div>
          )}
        </Card>
      </div>

      {/* ===== Diversification Insights ===== */}
      <div style={s.twoCol}>
        {/* Diversification Score */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `${divColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.shield} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Diversification Analysis</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
            <ProgressRing percent={div.score} size={120} strokeWidth={10} color={divColor} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Diversification Score</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: divColor }}>{div.score}/100</div>
              <Badge color={div.score >= 70 ? 'success' : div.score >= 40 ? 'warning' : 'danger'}>{div.label}</Badge>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Asset Classes</div>
              <div style={{ ...s.roiValue, fontSize: '1.1rem' }}>{div.numTypes}</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Categories Used</div>
              <div style={{ ...s.roiValue, fontSize: '1.1rem' }}>{div.numCategories}</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Max Allocation</div>
              <div style={{ ...s.roiValue, fontSize: '1.1rem', color: div.concentrationRatio > 60 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {div.concentrationRatio}%
              </div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Total Investments</div>
              <div style={{ ...s.roiValue, fontSize: '1.1rem' }}>{summary.totalCount}</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {div.score >= 70
                ? 'Your portfolio is well diversified across multiple asset classes and categories, reducing concentration risk.'
                : div.score >= 40
                ? 'Your portfolio is moderately diversified. Consider adding more asset classes to reduce risk.'
                : 'Your portfolio is concentrated in few asset classes. Diversifying across Stocks, Bonds, Gold, and Real Estate is recommended.'}
            </div>
          </div>
        </Card>

        {/* Allocation Summary Table */}
        <Card>
          <h3 style={s.sectionTitle}>Allocation Summary</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.perfTable}>
              <thead>
                <tr>
                  <th style={s.perfTh}>Type</th>
                  <th style={s.perfTh}>Invested</th>
                  <th style={s.perfTh}>Current</th>
                  <th style={s.perfTh}>P/L</th>
                  <th style={s.perfTh}>ROI</th>
                  <th style={s.perfTh}>Alloc %</th>
                </tr>
              </thead>
              <tbody>
                {filteredTypeBreakdown.map((t, i) => {
                  const profit = t.currentValue - t.invested;
                  const roi = t.invested > 0 ? ((profit / t.invested) * 100).toFixed(1) : '0.0';
                  const allocPct = typeTotal > 0 ? ((t.currentValue / typeTotal) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={i} style={{ transition: 'background var(--transition-fast)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...s.perfTd, fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[t.type] || '#6B7280' }} />
                          {t.type}
                        </span>
                      </td>
                      <td style={s.perfTd}>{fmt(t.invested)}</td>
                      <td style={s.perfTd}>{fmt(t.currentValue)}</td>
                      <td style={{ ...s.perfTd, color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {profit >= 0 ? '+' : ''}{fmt(profit)}
                      </td>
                      <td style={{ ...s.perfTd, color: parseFloat(roi) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {parseFloat(roi) >= 0 ? '+' : ''}{roi}%
                      </td>
                      <td style={{ ...s.perfTd, fontWeight: 600 }}>{allocPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ===== Category Breakdown Table ===== */}
      <Card style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.barChart} size={18} />
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Category-wise Breakdown</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.perfTable}>
            <thead>
              <tr>
                <th style={s.perfTh}>Category</th>
                <th style={s.perfTh}># Investments</th>
                <th style={s.perfTh}>Invested</th>
                <th style={s.perfTh}>Current Value</th>
                <th style={s.perfTh}>Profit / Loss</th>
                <th style={s.perfTh}>ROI</th>
                <th style={s.perfTh}>Allocation %</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategoryBreakdown.map((c, i) => {
                const profit = c.currentValue - c.invested;
                const roi = c.invested > 0 ? ((profit / c.invested) * 100).toFixed(1) : '0.0';
                const allocPct = catTotal > 0 ? ((c.currentValue / catTotal) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={i} style={{ transition: 'background var(--transition-fast)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...s.perfTd, fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[c.category] || '#6B7280' }} />
                        {c.category}
                      </span>
                    </td>
                    <td style={s.perfTd}>{c.count}</td>
                    <td style={s.perfTd}>{fmt(c.invested)}</td>
                    <td style={s.perfTd}>{fmt(c.currentValue)}</td>
                    <td style={{ ...s.perfTd, color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {profit >= 0 ? '+' : ''}{fmt(profit)}
                    </td>
                    <td style={{ ...s.perfTd, color: parseFloat(roi) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {parseFloat(roi) >= 0 ? '+' : ''}{roi}%
                    </td>
                    <td style={{ ...s.perfTd, fontWeight: 600 }}>{allocPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== Individual Investment Performance ===== */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={icons.activity} size={18} />
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Investment Performance</h2>
        </div>
        {filteredPerformance.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No investments match the selected filters</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.perfTable}>
              <thead>
                <tr>
                  <th style={s.perfTh}>#</th>
                  <th style={s.perfTh}>Name</th>
                  <th style={s.perfTh}>Type</th>
                  <th style={s.perfTh}>Category</th>
                  <th style={s.perfTh}>Invested</th>
                  <th style={s.perfTh}>Current</th>
                  <th style={s.perfTh}>P/L</th>
                  <th style={s.perfTh}>ROI</th>
                </tr>
              </thead>
              <tbody>
                {filteredPerformance.map((p, i) => (
                  <tr key={p._id || i} style={{ transition: 'background var(--transition-fast)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={s.perfTd}>{i + 1}</td>
                    <td style={{ ...s.perfTd, fontWeight: 600 }}>{p.name}</td>
                    <td style={s.perfTd}>
                      <Badge color="info">{p.type}</Badge>
                    </td>
                    <td style={s.perfTd}>
                      <Badge color="purple">{p.category}</Badge>
                    </td>
                    <td style={s.perfTd}>{fmt(p.amount)}</td>
                    <td style={s.perfTd}>{fmt(p.currentValue)}</td>
                    <td style={{ ...s.perfTd, color: p.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {p.profit >= 0 ? '+' : ''}{fmt(p.profit)}
                    </td>
                    <td style={{ ...s.perfTd, color: p.returnPct >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {p.returnPct >= 0 ? '+' : ''}{p.returnPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Layout>
  );
}
