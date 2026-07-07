import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { icons } from '../components/Icon';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const settings = [
    {
      section: 'Appearance',
      items: [
        { label: 'Theme', description: `Currently using ${theme} mode`, action: <Button variant="secondary" size="sm" onClick={toggleTheme}>Toggle</Button> },
      ],
    },
    {
      section: 'Account',
      items: [
        { label: 'Name', description: user?.name || 'Not set' },
        { label: 'Email', description: user?.email || 'Not set' },
      ],
    },
    {
      section: 'Data & Privacy',
      items: [
        { label: 'Export Data', description: 'Download your financial data', action: <Button variant="secondary" size="sm">Export</Button> },
        { label: 'Clear All Data', description: 'Permanently delete all your data', action: <Button variant="danger" size="sm">Clear</Button> },
      ],
    },
  ];

  return (
    <Layout title="Settings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: 640, margin: '0 auto' }}>
        {settings.map((section) => (
          <Card key={section.section}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              {section.section}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {section.items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: i < section.items.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.description}</div>
                  </div>
                  {item.action}
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Card>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            Danger Zone
          </h3>
          <Button variant="danger" fullWidth onClick={() => { logout(); navigate('/login'); }}>
            <Icon path={icons.logout} size={16} />
            Sign Out of Account
          </Button>
        </Card>
      </div>
    </Layout>
  );
}
