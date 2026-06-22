import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { isChunkLoadError } from '@/utils/lazyWithRetry';

const RELOAD_FLAG = 'vv-chunk-reloaded';

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

    // Self-heal stale-deploy chunk failures: hard-reload once to pick up new index.html.
    if (isChunkLoadError(error)) {
      const alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG);
      if (!alreadyReloaded) {
        window.sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    /* Dark-themed boundary — hardcoded so it works outside the .landing-dark scope. */
    return (
      <div
        className="min-h-screen relative overflow-hidden px-4 py-10 flex items-center justify-center"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(167,139,250,0.10) 0%, transparent 55%),' +
            'radial-gradient(ellipse at bottom, rgba(139,92,246,0.10) 0%, transparent 55%),' +
            '#080810',
          color: '#ffffff',
        }}
        data-testid="error-boundary"
      >
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full pointer-events-none"
             style={{ background: '#a78bfa', opacity: 0.07, filter: 'blur(140px)' }} />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full pointer-events-none"
             style={{ background: '#8b5cf6', opacity: 0.07, filter: 'blur(140px)' }} />

        <div className="relative z-10 max-w-md text-center" data-testid="error-boundary-content">
          <div
            className="inline-flex w-20 h-20 rounded-2xl items-center justify-center mb-6"
            style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)' }}
          >
            <AlertTriangle size={36} style={{ color: '#fca5a5' }} />
          </div>

          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-[0.2em] mb-5"
            style={{
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.30)',
              color: '#fca5a5',
            }}
          >
            Something went wrong
          </div>

          <h1
            className="font-clash text-3xl sm:text-5xl font-bold mb-3"
            style={{ color: '#ffffff' }}
            data-testid="error-boundary-title"
          >
            A glitch in the cosmos.
          </h1>
          <p
            className="font-bricolage mb-6 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.70)' }}
          >
            The app hit an unexpected error. Try again — if it keeps happening, reload or head back home.
          </p>

          {this.state.error?.message && (
            <pre
              className="text-[10px] font-mono rounded-lg p-3 mb-6 overflow-auto text-left max-h-32"
              style={{
                color: 'rgba(255,255,255,0.50)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(167,139,250,0.18)',
              }}
              data-testid="error-boundary-message"
            >
              {String(this.state.error.message)}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                color: '#ffffff',
                boxShadow: '0 8px 24px -8px rgba(139,92,246,0.55)',
              }}
              data-testid="error-boundary-reload"
            >
              <RefreshCw size={15} />
              Reload app
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage transition-all"
              style={{
                color: 'rgba(255,255,255,0.78)',
                background: 'transparent',
                border: '1px solid rgba(167,139,250,0.25)',
              }}
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
