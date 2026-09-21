/**
 * SessionReconnectBanner, subtle fixed banner shown when the Supabase
 * auth token briefly lapses (e.g. during a token refresh).
 * Auto-hides once the session is restored.
 */
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Wifi } from 'lucide-react';

export default function SessionReconnectBanner() {
  const { isReconnecting } = useAuth();

  if (!isReconnecting) return null;

  return (
    <div
      data-testid="session-reconnect-banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] shadow-lg backdrop-blur-sm animate-vv-fade-up"
      style={{ animation: 'vvFadeUp .25s ease-out both' }}
    >
      <Loader2 size={12} className="animate-spin text-[var(--color-primary)]" />
      <span>Reconnecting...</span>
      <style>{`
        @keyframes vvFadeUp { 0% { opacity: 0; transform: translate(-50%, 8px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}
