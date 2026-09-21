import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { markPhaseComplete } from '../utils/progress';
import Sidebar from './Sidebar';
import {
  ArrowLeft, ArrowRight, Wrench, PlayCircle, Target, AlertCircle, RefreshCw,
  FileSpreadsheet, FileText, GitBranch, MousePointerClick, CheckCircle2, Info,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

const TYPE_META = {
  excel: {
    label: 'Excel',
    Icon: FileSpreadsheet,
    color: '#10B981',
    blurb: 'Fill in the spreadsheet like a real analyst.',
  },
  document: {
    label: 'Document',
    Icon: FileText,
    color: '#246BFD',
    blurb: 'Read a live financial statement and answer targeted questions.',
  },
  decision_making: {
    label: 'Decision Making',
    Icon: GitBranch,
    color: '#6A5CFF',
    blurb: 'Navigate a real-world scenario. Every choice has consequences.',
  },
  interactive: {
    label: 'Interactive',
    Icon: MousePointerClick,
    color: '#FF6AC1',
    blurb: 'Drag, match, order, hands-on exercises.',
  },
};

export default function SimulationStartPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [module, setModule] = useState(null);
  const [sim, setSim] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*, user_modules(id, title, order_index, module_number)')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);
        setModule(sess.user_modules || null);

        if (sess.master_session_id) {
          // Many master_sessions have multiple sim rows (e.g. 1 interactive +
          // 2 excel). Use .maybeSingle() here would error out with PGRST116
          // for multi-row results AND return the wrong sim when one happens
          // to be the only one. Mirror SimulationPage.jsx's fetch-all +
          // priority-sort logic so the student lands on the most useful sim.
          const { data: sList, error: simErr } = await supabase
            .from('master_simulations')
            .select('*')
            .eq('session_id', sess.master_session_id);
          if (simErr && simErr.code !== 'PGRST116') throw simErr;
          const pickPriority = ['excel', 'interactive', 'decision_making', 'document'];
          const sorted = (sList || []).slice().sort(
            (a, b) => {
              const ai = pickPriority.indexOf(a.sim_type);
              const bi = pickPriority.indexOf(b.sim_type);
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            }
          );
          const picked = sorted[0] || null;
          if (mounted) setSim(picked);

          // Defense-in-depth: if this session has NO simulation at all
          // (typical for M14 career / M15 AI modules), auto-mark the
          // simulation phase complete and forward to the session-complete
          // screen. The wrench fallback below is now unreachable.
          if (!picked) {
            try {
              await markPhaseComplete(sessionId, 'simulation', {}, { actualMinutes: 0 });
            } catch { /* fire-and-forget */ }
            if (mounted) {
              navigate(`/session/${sessionId}/complete`, { replace: true });
              return;
            }
          }
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load simulation');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const meta = sim?.sim_type ? TYPE_META[sim.sim_type] : null;
  const objectives = sim?.objectives || sim?.learning_objectives || [];
  const instructions = sim?.instructions || sim?.how_to_play || '';
  const scenario = sim?.scenario || sim?.description || '';

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link
            to={`/session/${sessionId}/start`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage"
            data-testid="simulation-start-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Session
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="simulation-start-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-10 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-24 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-40 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="simulation-start-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Something went wrong</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && !sim && (
            <div className="flex flex-col items-center text-center py-16" data-testid="simulation-empty">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-5">
                <Wrench size={28} className="text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">No simulation configured yet</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
                This session doesn't have a simulation available. Skipping ahead.
              </p>
              <Link
                to={`/session/${sessionId}/complete`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
                data-testid="simulation-skip"
              >
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {!loading && !error && sim && session && (
            <>
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5" data-testid="simulation-breadcrumb">
                {module && (
                  <>
                    <span>{/^\s*module\b/i.test(module.title || '') ? module.title : `Module ${module.module_number ?? module.order_index}: ${module.title}`}</span>
                    <span className="text-[var(--color-text-faint)]">›</span>
                  </>
                )}
                <span>
                  {session.order_index != null ? `Session ${session.order_index + 1}: ` : ''}{session.title}
                </span>
                <span className="text-[var(--color-text-faint)]">›</span>
                <span className="text-[var(--color-text)]">Simulation</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
                <Wrench size={12} /> Phase 4 of 4 · Real-World Simulation
              </div>

              {meta && (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] mb-4"
                  style={{
                    background: `${meta.color}15`,
                    border: `1px solid ${meta.color}40`,
                    color: meta.color,
                  }}
                  data-testid="simulation-type-badge"
                >
                  <meta.Icon size={12} />
                  {meta.label}
                </div>
              )}

              <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="simulation-start-title">
                {sim.title || 'Real-World Simulation'}
              </h1>
              {meta && (
                <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg leading-relaxed mb-8" data-testid="simulation-type-blurb">
                  {meta.blurb}
                </p>
              )}

              {scenario && (
                <div className="glass-card rounded-2xl p-5 sm:p-6 mb-6" data-testid="simulation-scenario">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={16} className="text-[var(--color-primary)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Scenario
                    </h2>
                  </div>
                  <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                    {scenario}
                  </p>
                </div>
              )}

              {objectives && objectives.length > 0 && (
                <div className="glass-card rounded-2xl p-5 sm:p-6 mb-6" data-testid="simulation-objectives">
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={16} className="text-[var(--color-accent-purple)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Your objectives
                    </h2>
                  </div>
                  <ul className="space-y-2.5">
                    {objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-bricolage text-[var(--color-text)]" data-testid={`simulation-objective-${i}`}>
                        <CheckCircle2 size={16} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
                        <span>{typeof obj === 'string' ? obj : obj.text || JSON.stringify(obj)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {instructions && (
                <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8" data-testid="simulation-instructions">
                  <div className="flex items-center gap-2 mb-3">
                    <PlayCircle size={16} className="text-[var(--color-success)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      How to play
                    </h2>
                  </div>
                  <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                    {instructions}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                  No right path, just your best analysis
                </span>
                <button
                  onClick={() => navigate(`/session/${sessionId}/simulation`)}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                  data-testid="simulation-begin-cta"
                >
                  <PlayCircle size={16} />
                  Start Simulation
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
