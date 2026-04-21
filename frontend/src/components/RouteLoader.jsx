/**
 * Branded Suspense fallback shown while lazy-loaded route chunks load.
 * Uses the same shimmer treatment as ProtectedRoute's loading shell.
 */
export default function RouteLoader() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)]"
      data-testid="route-loader"
    >
      <img src="/valuevade-logo.svg" alt="Valuevade" className="w-14 h-14 mb-5 opacity-90 animate-pulse" />
      <div className="w-40 h-1 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] animate-[shimmer_1.5s_ease-in-out_infinite]"
          style={{ width: '60%' }}
        />
      </div>
    </div>
  );
}
