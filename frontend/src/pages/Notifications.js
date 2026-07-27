import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon, { icons } from '../components/Icon';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { notifTypeIcons, getNotifPriorityBg } from '../utils/notifications';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

const priorityBadgeColor = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

const typeLabels = {
  budget_exceeded: 'Budget',
  budget_warning: 'Budget',
  goal_overdue: 'Goal',
  goal_reminder: 'Goal',
  goal_deadline_urgent: 'Goal',
  investment_loss: 'Investment',
  investment_gain: 'Investment',
  investment_reminder: 'Investment',
  unusual_spending: 'Spending',
  low_savings: 'Savings',
};

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    let mounted = true;
    const load = async () => {
      try {
        const res = await notificationAPI.getAll();
        if (mounted) setNotifications(res.data.notifications || []);
      } catch {}
      if (mounted) setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [navigate]);

  const markRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationAPI.delete(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  };

  const filtered = useMemo(() => {
    let list = notifications;
    if (filter === 'unread') list = list.filter(n => !n.read);
    else if (filter !== 'all') list = list.filter(n => n.priority === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.category && n.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [notifications, filter, searchQuery]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => n.priority === 'critical' && !n.read).length;
  const highCount = notifications.filter(n => n.priority === 'high' && !n.read).length;

  const stats = [
    { label: 'Total', value: notifications.length, color: 'var(--accent-light)', icon: icons.bell },
    { label: 'Unread', value: unreadCount, color: 'var(--warning-light)', icon: icons.eye },
    { label: 'Critical', value: criticalCount, color: 'var(--danger-light)', icon: icons.alertCircle },
    { label: 'High', value: highCount, color: 'var(--warning-light)', icon: icons.trendingUp },
  ];

  if (loading) return <Layout title="Notifications"><LoadingSpinner text="Loading notifications..." /></Layout>;

  return (
    <Layout title="Notifications">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {stats.map((s, i) => (
          <Card key={i} style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -6, right: -6, opacity: 0.06 }}>
              <Icon path={s.icon} size={60} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: getNotifPriorityBg(i === 2 ? 'critical' : i === 3 ? 'high' : i === 1 ? 'high' : 'low'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={s.icon} size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '6px 14px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                  background: filter === f.key ? 'var(--accent-glow-strong)' : 'var(--bg-glass)',
                  border: filter === f.key ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border-light)',
                  color: filter === f.key ? 'var(--accent-light)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all var(--transition-fast)',
                }}
              >
                {f.label}
                {f.key === 'unread' && unreadCount > 0 && (
                  <span style={{ marginLeft: '4px', background: 'var(--danger)', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
              minWidth: 200,
            }}>
              <Icon path={icons.search} size={14} />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: '0.82rem', width: '100%',
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <Icon path="M18 6L6 18M6 6l12 12" size={14} />
                </button>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: 600,
                  background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.2)',
                  color: 'var(--accent-light)', cursor: 'pointer', transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={icons.bell}
          title={searchQuery ? 'No matching notifications' : filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
          description={searchQuery ? 'Try a different search term' : 'We\'ll alert you about important financial events'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((notif) => (
            <div
              key={notif._id}
              onClick={() => !notif.read && markRead(notif._id)}
              style={{
                display: 'flex', gap: '14px', padding: '16px 20px', borderRadius: 'var(--radius-lg)',
                background: notif.read ? 'var(--bg-glass)' : 'var(--accent-glow)',
                border: `1px solid ${notif.read ? 'var(--border-light)' : 'rgba(59,130,246,0.2)'}`,
                cursor: notif.read ? 'default' : 'pointer',
                transition: 'all var(--transition-fast)',
                opacity: notif.read ? 0.7 : 1,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Icon */}
              <div style={{
                width: 42, height: 42, borderRadius: 'var(--radius-md)',
                background: getNotifPriorityBg(notif.priority),
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon path={notifTypeIcons[notif.type] || icons.bell} size={18} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{notif.title}</span>
                  {!notif.read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  )}
                  <Badge color={priorityBadgeColor[notif.priority]}>{notif.priority}</Badge>
                  {notif.category && (
                    <Badge color="purple">{notif.category}</Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '6px' }}>
                  {notif.message}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon path={icons.clock} size={10} />
                    {timeAgo(notif.createdAt)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon path={notifTypeIcons[notif.type] || icons.bell} size={10} />
                    {typeLabels[notif.type] || notif.type}
                  </span>
                  {notif.amount != null && notif.amount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <Icon path={icons.wallet} size={10} />
                      ₹{Number(notif.amount).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={(e) => deleteNotif(notif._id, e)}
                style={{
                  width: 30, height: 30, borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, alignSelf: 'flex-start', marginTop: '2px',
                  opacity: 0.5, transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--danger-glow)'; e.currentTarget.style.color = 'var(--danger-light)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="Delete notification"
              >
                <Icon path={icons.trash} size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {notifications.length} notifications
        </div>
      )}
    </Layout>
  );
}
