import { useState, useEffect, useMemo, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import ProgressRing from '../components/ui/ProgressRing';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { portfolioAPI } from '../services/api';
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

const s = {
  topBar: { marginBottom: '24px' },
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
  roiCard: {
    background: 'var(--bg-glass)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)',
    padding: '16px 18px', transition: 'all var(--transition-fast)',
  },
  roiLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' },
  roiValue: { fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' },
  perfTable: { width: '100%', borderCollapse: 'collapse' },
  perfTh: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' },
  perfTd: { fontSize: '0.85rem', color: 'var(--text-primary)', padding: '10px 12px', borderBottom: '1px solid var(--border-light)' },
  perfRow: { transition: 'background var(--transition-fast)' },
  analyticsRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' },
  analyticsLabel: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '120px', flexShrink: 0 },
  analyticsTrack: { flex: 1, height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' },
  analyticsPct: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '44px', textAlign: 'right' },
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

export default function PortfolioAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await portfolioAPI.getAnalytics();
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch portfolio analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const profitColor = data?.investments?.totalReturns >= 0 ? 'var(--success)' : 'var(--danger)';
  const riskColor = data?.risk?.score >= 70 ? 'var(--success)' : data?.risk?.score >= 40 ? 'var(--warning)' : 'var(--danger)';

  const doughnutData = useMemo(() => {
    if (!data?.typeAllocation) return null;
    return {
      labels: data.typeAllocation.map(t => t.type),
      datasets: [{
        data: data.typeAllocation.map(t => t.value),
        backgroundColor: data.typeAllocation.map(t => (TYPE_COLORS[t.type] || '#6B7280') + 'CC'),
        borderColor: '#111827', borderWidth: 3, hoverOffset: 8,
      }],
    };
  }, [data]);

  const goalDoughnutData = useMemo(() => {
    if (!data?.goals?.progress) return null;
    return {
      labels: data.goals.progress.map(g => g.name),
      datasets: [{
        data: data.goals.progress.map(g => g.saved),
        backgroundColor: data.goals.progress.map(g => (CATEGORY_COLORS[g.category] || '#6B7280') + 'CC'),
        borderColor: '#111827', borderWidth: 3, hoverOffset: 8,
      }],
    };
  }, [data]);

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
      <Layout title="Portfolio Analytics">
        <LoadingSpinner text="Loading portfolio analytics..." />
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout title="Portfolio Analytics">
        <EmptyState icon={icons.barChart} title="No data available" description="Add investments and goals to see your portfolio analytics" />
      </Layout>
    );
  }

  const inv = data.investments;
  const goal = data.goals;
  const risk = data.risk;

  return (
    <Layout title="Portfolio Analytics">
      <div style={s.topBar}>
        <h3 style={s.subtitle}>Comprehensive view of your investment portfolio and financial goals</h3>
      </div>

      {/* ===== Portfolio Summary Dashboard ===== */}
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon path={icons.dashboard} size={20} /> Investment Summary
        </h3>
      </div>
      <div style={s.statsGrid}>
        <SummaryCard icon={icons.investments} amount={fmt(inv.totalInvested)} label="Total Investment" desc={`Across ${inv.count} investments`} color="var(--purple)" delay="0s" />
        <SummaryCard icon={icons.trendingUp} amount={fmt(inv.totalCurrentValue)} label="Current Portfolio Value" desc={`${inv.activeCount} active investments`} color="var(--success)" delay="0.05s" />
        <SummaryCard icon={icons.activity} amount={`${inv.totalReturns >= 0 ? '+' : ''}${fmt(inv.totalReturns)}`} label="Profit / Loss" desc={inv.totalReturns >= 0 ? 'Portfolio is profitable' : 'Portfolio is in loss'} color={profitColor} delay="0.1s" />
        <SummaryCard icon={icons.target} amount={`${inv.overallROI >= 0 ? '+' : ''}${inv.overallROI}%`} label="Overall ROI" desc="Return on Investment" color={profitColor} delay="0.15s" />
      </div>

      {/* ===== Portfolio Growth & Asset Allocation ===== */}
      <div style={s.twoCol}>
        {/* Monthly Portfolio Growth */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.trendingUp} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Portfolio Growth</h2>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyGrowth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...chartTooltipStyle} formatter={(value) => [fmt(value)]} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Area type="monotone" dataKey="invested" stroke="#8B5CF6" fill="#8B5CF620" name="Invested" strokeWidth={2} />
                <Area type="monotone" dataKey="value" stroke="#10B981" fill="#10B98120" name="Current Value" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Asset Allocation Pie */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Asset Allocation</h2>
          </div>
          {doughnutData && (
            <>
              <div style={{ height: 200, display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginTop: '16px' }}>
                {data.typeAllocation.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: TYPE_COLORS[t.type] || '#6B7280', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>{t.type}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ===== Risk Analytics Dashboard ===== */}
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon path={icons.shield} size={20} /> Risk Analytics & Diversification
        </h3>
      </div>
      <div style={s.twoCol}>
        {/* Risk Score */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `${riskColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.shield} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Portfolio Risk Score</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
            <ProgressRing percent={risk.score} size={120} strokeWidth={10} color={riskColor} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Risk Assessment</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: riskColor }}>{risk.score}/100</div>
              <Badge color={risk.score >= 70 ? 'success' : risk.score >= 40 ? 'warning' : 'danger'}>{risk.label}</Badge>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Asset Classes</div>
              <div style={{ ...s.roiValue, fontSize: '1.1rem' }}>{risk.numTypes}</div>
            </div>
            <div style={s.roiCard}>
              <div style={s.roiLabel}>Max Allocation</div>
              <div style={{ ...s.roiValue, fontSize: '1.1rem', color: risk.maxAllocation > 60 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {risk.maxAllocation}%
              </div>
            </div>
          </div>
          <div style={{ marginTop: '16px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {risk.score >= 70
                ? 'Your portfolio risk is low. Investments are well diversified across multiple asset classes, reducing concentration risk.'
                : risk.score >= 40
                ? 'Your portfolio has moderate risk. Consider diversifying into different asset classes to reduce overall risk.'
                : 'Your portfolio has high risk. Concentrated in few asset classes. Diversifying across Stocks, Bonds, Gold, and Real Estate is recommended.'}
            </div>
          </div>
        </Card>

        {/* Investment Distribution by Type */}
        <Card>
          <h3 style={s.sectionTitle}>Diversification Analysis</h3>
          {data.typeAllocation.map((t) => {
            const color = TYPE_COLORS[t.type] || '#6B7280';
            return (
              <div key={t.type} style={s.analyticsRow}>
                <span style={s.analyticsLabel}>{t.type}</span>
                <div style={s.analyticsTrack}>
                  <div style={{ ...s.analyticsFill, width: `${t.pct}%`, background: color }} />
                </div>
                <span style={s.analyticsPct}>{t.pct}%</span>
              </div>
            );
          })}
          <div style={{ marginTop: '20px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Diversification Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Types</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{data.typeAllocation.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg per Type</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(inv.totalCurrentValue / (data.typeAllocation.length || 1))}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Top & Lowest Performers ===== */}
      <div style={s.twoCol}>
        {/* Top Performing Assets */}
        <Card>
          <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon path={icons.trendingUp} size={18} /> Top Performing Assets
          </h3>
          {data.topPerformers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No profitable investments yet</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.perfTable}>
                <thead>
                  <tr>
                    <th style={s.perfTh}>#</th>
                    <th style={s.perfTh}>Name</th>
                    <th style={s.perfTh}>Type</th>
                    <th style={s.perfTh}>Invested</th>
                    <th style={s.perfTh}>Current</th>
                    <th style={s.perfTh}>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPerformers.map((p, i) => (
                    <tr key={i} style={s.perfRow} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={s.perfTd}>{i + 1}</td>
                      <td style={{ ...s.perfTd, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...s.perfTd, fontSize: '0.8rem' }}>{p.type}</td>
                      <td style={s.perfTd}>{fmt(p.amount)}</td>
                      <td style={s.perfTd}>{fmt(p.currentValue)}</td>
                      <td style={{ ...s.perfTd, color: 'var(--success)', fontWeight: 600 }}>+{p.returnPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Lowest Performing Assets */}
        <Card>
          <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon path={icons.trendingDown} size={18} /> Lowest Performing Assets
          </h3>
          {data.lowestPerformers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No investments to analyze</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.perfTable}>
                <thead>
                  <tr>
                    <th style={s.perfTh}>#</th>
                    <th style={s.perfTh}>Name</th>
                    <th style={s.perfTh}>Type</th>
                    <th style={s.perfTh}>Invested</th>
                    <th style={s.perfTh}>Current</th>
                    <th style={s.perfTh}>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowestPerformers.map((p, i) => (
                    <tr key={i} style={s.perfRow} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={s.perfTd}>{i + 1}</td>
                      <td style={{ ...s.perfTd, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...s.perfTd, fontSize: '0.8rem' }}>{p.type}</td>
                      <td style={s.perfTd}>{fmt(p.amount)}</td>
                      <td style={s.perfTd}>{fmt(p.currentValue)}</td>
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
      </div>

      {/* ===== Financial Goal Analytics ===== */}
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon path={icons.target} size={20} /> Financial Goal Analytics
        </h3>
      </div>
      <div style={s.statsGrid}>
        <SummaryCard icon={icons.target} amount={`${goal.totalGoals}`} label="Total Goals" desc={`${goal.goalsAchieved} achieved`} color="var(--accent)" delay="0s" />
        <SummaryCard icon={icons.check} amount={`${goal.goalCompletionPct}%`} label="Goal Completion" desc={`${goal.goalsAchieved} of ${goal.totalGoals} completed`} color="var(--success)" delay="0.05s" />
        <SummaryCard icon={icons.savings} amount={fmt(goal.totalSaved)} label="Total Saved" desc={`of ${fmt(goal.totalTarget)} target`} color="var(--purple)" delay="0.1s" />
        <SummaryCard icon={icons.trendingDown} amount={fmt(goal.remainingSavings)} label="Remaining Required" desc="Left to save across all goals" color="var(--warning)" delay="0.15s" />
      </div>

      {/* Goal Progress + Goal Allocation Chart */}
      <div style={s.twoCol}>
        {/* Goal Progress List */}
        <Card>
          <h3 style={s.sectionTitle}>Goal Progress</h3>
          {goal.progress.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No goals created yet</div>
          ) : (
            goal.progress.map((g, i) => {
              const color = CATEGORY_COLORS[g.category] || 'var(--accent)';
              return (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={s.analyticsRow}>
                    <span style={s.analyticsLabel}>{g.name}</span>
                    <div style={s.analyticsTrack}>
                      <div style={{ ...s.analyticsFill, width: `${g.pct}%`, background: color }} />
                    </div>
                    <span style={s.analyticsPct}>{g.pct}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '134px', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{g.category} &bull; {fmt(g.saved)} / {fmt(g.target)}</span>
                    <span style={{ color: g.pct >= 100 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {g.pct >= 100 ? 'Completed' : `${fmt(g.target - g.saved)} left`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {/* Goal Savings Allocation */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={icons.pieChart} size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Savings Allocation</h2>
          </div>
          {goalDoughnutData && goal.progress.length > 0 ? (
            <>
              <div style={{ height: 200, display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={goalDoughnutData} options={doughnutOptions} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginTop: '16px' }}>
                {goal.progress.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[g.category] || '#6B7280', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>{g.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No goal data to display</div>
          )}
        </Card>
      </div>

    </Layout>
  );
}
