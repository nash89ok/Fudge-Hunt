import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

/**
 * Catches render errors so a failed chunk (e.g. WebAR) does not leave a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            padding: '1.5rem',
            background: '#0f1419',
            color: '#e8eaed',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.125rem', marginTop: 0 }}>Something went wrong</h1>
          <p style={{ opacity: 0.85, wordBreak: 'break-word' }}>{this.state.message}</p>
          <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>Reload the page or open the devtools console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
