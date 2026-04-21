import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen relative overflow-hidden px-4 py-10 flex items-center justify-center"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(255,106,193,0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(106,92,255,0.08) 0%, transparent 50%), var(--bg-primary)',
        }}
        data-testid="error-boundary"
      >
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-pink)] opacity-[0.06] blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.06] blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-md text-center" data-testid="error-boundary-content">
          <div className="inline-flex w-20 h-20 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/25 items-center justify-center mb-6">
            <AlertTriangle size={36} className="text-[var(--color-error)]" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-error)]/10 border border-[var(--color-error)]/25 text-[var(--color-error)] text-xs font-mono uppercase tracking-[0.2em] mb-5">
            Something went wrong
          </div>

          <h1 className="font-clash text-3xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="error-boundary-title">
            A glitch in the cosmos.
          </h1>
          <p className="text-[var(--color-text-muted)] font-bricolage mb-6 leading-relaxed">
            The app hit an unexpected error. Try again — if it keeps happening, reload or head back home.
          </p>

          {this.state.error?.message && (
            <pre
              className="text-[10px] font-mono text-[var(--color-text-faint)] bg-[var(--color-surface)]/60 border border-[var(--color-border)] rounded-lg p-3 mb-6 overflow-auto text-left max-h-32"
              data-testid="error-boundary-message"
            >
              {String(this.state.error.message)}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="error-boundary-reload"
            >
              <RefreshCw size={15} />
              Reload app
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
              data-testid="error-boundary-home"
            >
              <Home size={15} />
              Back home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
