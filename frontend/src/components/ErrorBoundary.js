import { Component } from 'react';
import Icon, { icons } from './Icon';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '48px 24px', textAlign: 'center', minHeight: '40vh',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)',
            background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Icon path={icons.alertCircle} size={28} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', maxWidth: 400 }}>
            An unexpected error occurred. Please try again or refresh the page.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-md)',
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
