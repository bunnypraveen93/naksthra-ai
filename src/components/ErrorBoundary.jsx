import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Unexpected render error'
    };
  }

  componentDidCatch(error) {
    console.error('Nakshatra UI error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            color: '#ececf1',
            background: 'radial-gradient(circle at 50% 35%, #111842 0%, #06091c 55%, #02030a 100%)',
            gap: '14px'
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Unable to render chat screen</h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '420px' }}>{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: '999px',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              background: 'rgba(56, 189, 248, 0.16)',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            Reload Chat
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
