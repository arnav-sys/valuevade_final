import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import SessionCompleteSummaryCard from './gamification/SessionCompleteSummaryCard';
import AvatarPersona from './tutor/AvatarPersona';
import { resolveTutorPhase } from '../contexts/TutorContext';
import AskPariButton from './tutor/AskPariButton';
import {
  ArrowRight, Trophy, Sparkles, CheckCircle2, FileText, HelpCircle, MessageSquare,
  Wrench, Loader2, AlertCircle, RefreshCw, Award, Briefcase,
} from 'lucide-react';

const PHASE_DEFS = [
  { key: 'notes', label: 'Notes', icon: FileText, color: '#246BFD', scoreField: null },
  { key: 'quiz', label: 'Quiz', icon: HelpCircle, color: '#6A5CFF', scoreField: 'quiz_score' },
  { key: 'interview', label: 'Interview', icon: MessageSquare, color: '#FF6AC1', scoreField: 'interview_score' },
  { key: 'simulation', label: 'Simulation', icon: Wrench, color: '#10B981', scoreField: 'simulation_score' },
];

function Confetti() {
  const pieces = Array.from({ length: 60 });
  const colors = ['#246BFD', '#6A5CFF', '#FF6AC1', '#10B981', '#F59E0B'];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.8 + Math.random() * 1.8;
        const color = colors[i % colors.length];
        const size = 7 + Math.random() * 7;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-10px',
              width: size,
              height: size * 1.4,
              background: color,
              borderRadius: 2,
              opacity: 0.9,
              animation: `vvSessionConfettiFall ${duration}s cubic-bezier(.2,.7,.3,1) ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvSessionConfettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default function SessionCompletePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Anchor the gamification summary card to when the user first landed here.
  // markPhaseComplete writes XP events ~immediately before this page mounts,
  // so 60s back from mount covers the last awardXP loop + streak + badges
  // + daily-challenge updates.
  const sessionStartTsRef = useRef(Date.now() - 60_000);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [module, setModule] = useState(null);
  const [nextSession, setNextSession] = useState(null);
  const [moduleComplete, setModuleComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*, user_modules(id, title, order_index, enrollment_id, is_completed)')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);
        setModule(sess.user_modules || null);

        const modId = sess.user_module_id;
        if (modId) {
          const { data: siblings, error: sibErr } = await supabase
            .from('user_sessions')
            .select('id, title, order_index, is_completed, is_removed')
            .eq('user_module_id', modId)
            .eq('is_removed', false)
            .order('order_index');
          if (sibErr) throw sibErr;

          const active = siblings || [];
          const thisIdx = active.findIndex((s) => s.id === sessionId);
          const next = thisIdx >= 0 && thisIdx < active.length - 1 ? active[thisIdx + 1] : null;
          if (mounted) setNextSession(next);

          const allDone = active.every((s) => s.is_completed);
          if (mounted) setModuleComplete(allDone);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load session');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const phaseScores = useMemo(() => {
    if (!session) return [];
    return PHASE_DEFS.map((p) => {
      const score = p.scoreField ? session[p.scoreField] : null;
      const completed = session[`${p.key}_completed`];
      return { ...p, completed, score };
    });
  }, [session]);

  const allPhasesComplete = phaseScores.length > 0 && phaseScores.every((p) => p.completed);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="session-complete-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="session-complete-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load session</p>
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden px-4 py-10 sm:py-14" data-testid="session-complete-page">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.08] blur-[140px] pointer-events-none" />

      {showConfetti && <Confetti />}

      <div className="relative z-10 max-w-2xl mx-auto" data-testid="session-complete-content">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)] text-xs font-mono uppercase tracking-[0.2em] mb-5">
            <Trophy size={12} /> Session complete
          </div>
          <h1 className="font-clash text-4xl sm:text-6xl font-bold text-[var(--color-text)] mb-3" data-testid="session-complete-title">
            Session Complete!
          </h1>
          {session && (
            <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg mb-2" data-testid="session-complete-session-title">
              {session.title}
            </p>
          )}
          <p className="text-[var(--color-text-muted)] font-bricolage max-w-md mx-auto leading-relaxed">
            {allPhasesComplete
              ? 'You crushed all 4 phases. This is how real analysts learn — notes → quiz → interview → simulation.'
              : 'Great work. Finish the remaining phases when you\'re ready to cement what you learned.'}
          </p>
        </div>

        {/* Phase grid */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8" data-testid="session-complete-phases">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
            <Sparkles size={14} className="text-[var(--color-primary)]" />
            <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
              Your 4-phase journey
            </h3>
          </div>
          <div className="space-y-2">
            {phaseScores.map((p) => {
              const Icon = p.icon;
              // Quiz specifically: attempted (yellow) when score < 70; passed (green) when >= 70
              const isAttempted = p.completed && p.key === 'quiz' && (p.score ?? 100) < 70;
              return (
                <div
                  key={p.key}
                  className="flex items-center gap-4 p-3 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)]"
                  data-testid={`session-complete-phase-${p.key}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isAttempted ? '#F59E0B15' : `${p.color}15`,
                      border: `1px solid ${isAttempted ? '#F59E0B35' : p.color + '35'}`,
                      color: isAttempted ? '#F59E0B' : p.color,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-clash text-sm font-semibold text-[var(--color-text)]">{p.label}</div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                      {isAttempted ? 'Attempted' : p.completed ? 'Completed' : 'Skipped'}
                    </div>
                  </div>
                  {p.completed && (
                    <div className="flex items-center gap-2">
                      {p.score != null && p.scoreField && (
                        <span
                          className="text-xs font-mono font-bold px-2.5 py-1 rounded-full"
                          style={{
                            color: isAttempted ? '#F59E0B' : p.color,
                            background: `${isAttempted ? '#F59E0B' : p.color}12`,
                            border: `1px solid ${isAttempted ? '#F59E0B' : p.color}30`,
                          }}
                          data-testid={`session-complete-score-${p.key}`}
                        >
                          {p.scoreField === 'interview_score' ? `${p.score}/5` : `${p.score}%`}
                        </span>
                      )}
                      {isAttempted ? (
                        <span className="text-[10px] font-mono font-bold text-[#F59E0B] shrink-0">⚠</span>
                      ) : (
                        <CheckCircle2 size={16} className="text-[var(--color-success)] shrink-0" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gamification summary (Phase 47) */}
        <SessionCompleteSummaryCard sessionStartTs={sessionStartTsRef.current} />
        <div className="mt-2 mb-6">
          <AskPariButton phase="notes" courseSessionId={sessionId} variant="card" />
        </div>

        {/* Tutor — celebrating beside the summary */}
        {(() => {
          const t = resolveTutorPhase('session_complete');
          return (
            <div className="flex justify-center -mt-2 mb-8">
              <AvatarPersona
                pose={t?.pose || 'celebrating'}
                size="md"
                position="inline"
                message={t?.message}
              />
            </div>
          );
        })()}

        {/* Module-complete callout */}
        {moduleComplete && module && (
          <div className="rounded-2xl p-5 mb-8 bg-gradient-to-br from-[var(--color-accent-purple)]/12 via-[var(--color-primary)]/8 to-transparent border border-[var(--color-accent-purple)]/30 flex items-start gap-3" data-testid="session-complete-module-badge">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/40 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
              <Award size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-0.5">Module Complete!</div>
              <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                You've finished every session in <span className="text-[var(--color-text)]">{module.title}</span>. Time for the module project.
              </p>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3" data-testid="session-complete-ctas">
          {nextSession ? (
            <button
              onClick={() => navigate(`/session/${nextSession.id}/start`)}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="session-complete-next-session"
            >
              Next Session: {nextSession.title}
              <ArrowRight size={16} />
            </button>
          ) : moduleComplete ? (
            <button
              onClick={() => navigate(`/module/${module.id}/project/start`)}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(106,92,255,0.4)] hover:brightness-110 transition-all"
              data-testid="session-complete-module-project"
            >
              <Briefcase size={16} />
              Module Complete! Start Module Project
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="session-complete-to-dashboard"
            >
              Continue <ArrowRight size={16} />
            </button>
          )}

          <Link
            to="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="session-complete-back-dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
