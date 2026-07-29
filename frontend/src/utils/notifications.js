import { icons } from '../components/Icon';

export const notifTypeIcons = {
  budget_exceeded: icons.alertCircle,
  budget_warning: icons.alertCircle,
  goal_overdue: icons.target,
  goal_reminder: icons.target,
  goal_deadline_urgent: icons.target,
  investment_loss: icons.trendingDown,
  investment_gain: icons.trendingUp,
  investment_reminder: icons.clock,
  unusual_spending: icons.activity,
  low_savings: icons.piggyBank,
};

export const notifPriorityColors = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

export function getNotifPriorityBg(priority) {
  switch (priority) {
    case 'critical': return 'var(--danger-glow)';
    case 'high': return 'var(--warning-glow)';
    case 'medium': return 'var(--info-glow)';
    case 'low': return 'rgba(16,185,129,0.15)';
    default: return 'var(--accent-glow)';
  }
}
