import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, Loader2, AlertCircle, RefreshCw, Wrench,
  FileSpreadsheet, FileText, GitBranch, MousePointerClick,
} from 'lucide-react';
import ExcelSim from './simulations/ExcelSim';
import DocumentSim from './simulations/DocumentSim';
import DecisionMakingSim from './simulations/DecisionMakingSim';
import InteractiveSim from './simulations/InteractiveSim';
import { markPhaseComplete } from '../utils/progress';

const TYPE_META = {
  excel: { label: 'Excel', Icon: FileSpreadsheet, color: '#10B981' },
  document: { label: 'Document', Icon: FileText, color: '#246BFD' },
  decision_making: { label: 'Decision Making', Icon: GitBranch, color: '#6A5CFF' },
  interactive: { label: 'Interactive', Icon: MousePointerClick, color: '#FF6AC1' },
};

export default function SimulationPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [sim, setSim] = useState(null);
  const [progress, setProgress] = useState({ correct: 0, total: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);

        if (!sess.master_session_id) {
          setSim(null);
          return;
        }

        const { data: s, error: simErr } = await supabase
          .from('master_simulations')
          .select('*')
          .eq('session_id', sess.master_session_id)
          .maybeSingle();
        if (simErr && simErr.code !== 'PGRST116') throw simErr;
        if (mounted) setSim(s || null);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load simulation');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const handleComplete = async ({ tasks_completed, tasks_total, accuracy }) => {
    if (saving) return;
    setSaving(true);
    try {
      const scoreData = {
        simulation_score: Math.round((accuracy || 0) * 100),
      };
      const res = await markPhaseComplete(sessionId, 'simulation', scoreData);
      if (!res?.success) {
        console.error('[simulation] markPhaseComplete failed:', res?.error);
      }
      navigate(`/session/${sessionId}/simulation/complete`, {
        state: { tasks_completed, tasks_total, accuracy, sim_type: sim?.sim_type, title: sim?.title },
      });
    } catch (err) {
      console.error('[simulation] save error:', err);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="simulation-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="simulation-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load simulation</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="simulation-empty-page">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-5">
            <Wrench size={28} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">No simulation configured</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
            This session doesn't have a simulation available.
          </p>
          <Link
            to={`/session/${sessionId}/complete`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
          >
            Continue
          </Link>
        </div>
      </div>
    );
  }

  const meta = TYPE_META[sim.sim_type] || TYPE_META.interactive;
  const config = sim.config || {};

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative" data-testid="simulation-page">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link
              to={`/session/${sessionId}/simulation/start`}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group font-bricolage"
              data-testid="simulation-exit-link"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Exit
            </Link>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40`, color: meta.color }}
              >
                <meta.Icon size={16} />
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)] leading-tight" data-testid="simulation-header-title">
                  {sim.title || 'Real-World Simulation'}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: meta.color }}>
                  {meta.label}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]" data-testid="simulation-phase-badge">
              Phase 4 / 4
            </span>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 pb-24">
        {sim.sim_type === 'excel' && (
          <ExcelSim config={config} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {sim.sim_type === 'document' && (
          <DocumentSim config={config} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {sim.sim_type === 'decision_making' && (
          <DecisionMakingSim config={config} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {sim.sim_type === 'interactive' && (
          <InteractiveSim config={config} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {!['excel', 'document', 'decision_making', 'interactive'].includes(sim.sim_type) && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="font-clash text-base text-[var(--color-text)] mb-2">Unsupported simulation type</p>
            <p className="text-xs font-mono text-[var(--color-text-muted)] mb-5">"{sim.sim_type}"</p>
            <button
              onClick={() => handleComplete({ tasks_completed: 0, tasks_total: 0, accuracy: 0 })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
            >
              Skip to completion
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
