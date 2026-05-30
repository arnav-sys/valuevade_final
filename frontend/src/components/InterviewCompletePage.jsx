import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { markPhaseComplete, getNextPhaseRoute, updateDailyChallengesForPhase } from '../utils/progress';
import { triggerBadgeEvaluation } from '../utils/badgeBus';
import { aggregateScores } from '../utils/interviewEval';
import AvatarPersona from './tutor/AvatarPersona';
import { useDoubtsLauncher } from '../contexts/DoubtsLauncherContext';
import {
  ArrowRight, RotateCcw, CheckCircle2, AlertTriangle, Sparkles,
  Brain, MessageCircle, ListTree, Trophy, MessageCircleQuestion,
} from 'lucide-react';

function ScoreRing({ value, label, Icon, color }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = (value / 5) * 100;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center" data-testid={`interview-score-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={18} style={{ color }} />
          <div className="font-clash text-2xl font-bold text-[var(--color-text)] leading-none mt-1">{value.toFixed(1)}</div>
          <div className="text-[9px] font-mono text-[var(--color-text-muted)]">/ 5</div>
        </div>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mt-3 text-center max-w-[100px]">
        {label}
      </div>
    </div>
  );
}

function overallFeedback(scores) {
  const { technical, communication, structure, overall } = scores;
  const lowest = [
    { key: 'technical', label: 'technical knowledge', value: technical },
    { key: 'communication', label: 'communication clarity', value: communication },
    { key: 'structure', label: 'answer structure', value: structure },
  ].sort((a, b) => a.value - b.value)[0];

  const highest = [
    { key: 'technical', label: 'technical', value: technical },
    { key: 'communication', label: 'clarity', value: communication },
    { key: 'structure', label: 'structure', value: structure },
  ].sort((a, b) => b.value - a.value)[0];

  if (overall >= 4) {
    return {
      title: 'Strong showing.',
      body: `Your ${highest.label} stood out. Keep tightening ${lowest.label} and you'll be interview-ready for analyst roles.`,
      tone: 'success',
    };
  }
  if (overall >= 3) {
    return {
      title: 'Solid foundation.',
      body: `You've got the basics. To level up, focus on ${lowest.label} — that's where most analyst interviewers pressure-test candidates.`,
      tone: 'primary',
    };
  }
  return {
    title: 'Keep going — this is where growth happens.',
    body: `Your ${lowest.label} needs the most work. Review the notes, study the model answers, and try again. Every attempt compounds.`,
    tone: 'amber',
  };
}

export default function InterviewCompletePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { openDoubts } = useDoubtsLauncher();

  const { results = [] } = location.state || {};

  const scores = useMemo(() => aggregateScores(results), [results]);
  const feedback = useMemo(() => overallFeedback(scores), [scores]);
  const [saved, setSaved] = useState(false);
  const [nextRoute, setNextRoute] = useState({ phase: 'simulation', route: 'simulation/start', label: 'Simulation' });

  useEffect(() => {
    let mounted = true;
    async function save() {
      if (saved || !user?.id || !sessionId || !results.length) return;
      try {
        // user_sessions has interview_score column only — persist overall as integer (1-5)
        const res = await markPhaseComplete(sessionId, 'interview', {
          interview_score: Math.round(scores.overall),
        });
        if (!res?.success) {
          console.error('[interview] markPhaseComplete failed:', res?.error);
        } else if (mounted && res.data) {
          setNextRoute(getNextPhaseRoute(res.data, 'interview'));
          try {
            await triggerBadgeEvaluation({
              source_event: 'interview_complete',
              session_id: sessionId,
              interview_score: Math.round(scores.overall),
            });
          } catch { /* fire-and-forget */ }
          try {
            await updateDailyChallengesForPhase(user.id, 'interview', { minutes: 5 });
          } catch { /* fire-and-forget */ }
        }
      } catch (err) {
        console.error('[interview] save error:', err);
      } finally {
        if (mounted) setSaved(true);
      }
    }
    save();
    return () => { mounted = false; };
  }, [saved, user?.id, sessionId, scores.overall, results.length]);

  const hasResults = results.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative px-4 py-10 sm:py-14" style={{ overflowX: 'clip' }}>
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.06] blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto" data-testid="interview-complete-content">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-xs font-mono uppercase tracking-[0.2em] mb-5">
            {scores.overall >= 4 ? <Trophy size={12} /> : <Sparkles size={12} />}
            Interview complete
          </div>
          <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="interview-complete-title">
            {feedback.title}
          </h1>
          <p className="text-[var(--color-text-muted)] font-bricolage mb-8 max-w-md mx-auto leading-relaxed" data-testid="interview-complete-subtitle">
            {feedback.body}
          </p>

          {/* P55 — Pari hero: per-dimension result delivered by Pari */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] backdrop-blur p-4 sm:p-5 mb-6 flex items-center gap-4 text-left" data-testid="interview-complete-pari-hero">
            <AvatarPersona
              pose="explaining"
              size="md"
              position="inline"
              showSpeechBubble={false}
              ariaLabel="Pari"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-primary)] mb-1">
                Pari delivers your scores
              </div>
              <div className="text-sm sm:text-base text-[var(--color-text)] font-bricolage leading-relaxed">
                Here's how you did. Technical: <strong>{scores.technical}/5</strong> · Communication: <strong>{scores.communication}/5</strong> · Structure: <strong>{scores.structure}/5</strong>. Let me show you what went well and what to sharpen next time.
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 sm:p-8 mb-6" data-testid="interview-score-grid">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-5">Overall breakdown</div>
            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              <ScoreRing value={scores.technical} label="Technical Knowledge" Icon={Brain} color="#246BFD" />
              <ScoreRing value={scores.communication} label="Communication Clarity" Icon={MessageCircle} color="#6A5CFF" />
              <ScoreRing value={scores.structure} label="Answer Structure" Icon={ListTree} color="#FF6AC1" />
            </div>
            <div className="mt-6 pt-5 border-t border-[var(--color-border)] flex items-center justify-center gap-2" data-testid="interview-overall-score">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Overall</span>
              <span className="font-clash text-2xl font-bold text-[var(--color-text)]">{scores.overall.toFixed(1)}</span>
              <span className="text-sm font-mono text-[var(--color-text-muted)]">/ 5</span>
            </div>
          </div>
        </div>

        {/* Per-question quick recap */}
        {hasResults && (
          <div className="glass-card rounded-2xl p-5 mb-8" data-testid="interview-recap">
            <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-[var(--color-border)]">
              <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">Question by question</h2>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{results.length} answers</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-3" data-testid={`interview-recap-${i}`}>
                  <span className="text-[10px] font-mono text-[var(--color-text-faint)] shrink-0 w-6">Q{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-base sm:text-[17px] font-bricolage text-[var(--color-text)] truncate font-medium">{r.questionText}</div>
                  </div>
                  <span
                    className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      color: r.scores.overall >= 4 ? 'var(--color-success)' : r.scores.overall >= 3 ? 'var(--color-primary)' : '#F59E0B',
                      background: r.scores.overall >= 4
                        ? 'rgba(16,185,129,0.1)'
                        : r.scores.overall >= 3
                          ? 'rgba(36,107,253,0.1)'
                          : 'rgba(245,158,11,0.1)',
                    }}
                  >
                    {r.scores.overall}/5
                  </span>
                  <button
                    type="button"
                    onClick={() => openDoubts({
                      phase: 'interview',
                      courseSessionId: sessionId,
                      attemptContext: {
                        question_text: r.questionText,
                        user_answer: r.userAnswer || r.answer || '',
                        evaluation: r.scores,
                        feedback_existing: r.feedback || null,
                      },
                    })}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/25 border border-[var(--color-primary)]/35 text-[var(--color-primary)] px-2 py-1 text-[10px] font-semibold font-bricolage transition-colors"
                    title="Ask Pari to elaborate"
                    data-testid={`interview-ask-pari-${i}`}
                  >
                    <MessageCircleQuestion size={10} /> Ask Pari
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights card */}
        <div
          className={`rounded-2xl p-5 mb-8 border ${
            feedback.tone === 'success'
              ? 'bg-[var(--color-success)]/8 border-[var(--color-success)]/25'
              : feedback.tone === 'amber'
                ? 'bg-[#F59E0B]/8 border-[#F59E0B]/25'
                : 'bg-[var(--color-primary)]/8 border-[var(--color-primary)]/25'
          }`}
          data-testid="interview-key-feedback"
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                feedback.tone === 'success'
                  ? 'bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]'
                  : feedback.tone === 'amber'
                    ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B]'
                    : 'bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)]'
              }`}
            >
              {feedback.tone === 'amber' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-clash text-base font-semibold text-[var(--color-text)] mb-1.5">Key takeaway</div>
              <p className="text-base sm:text-[17px] text-[var(--color-text)] font-bricolage leading-relaxed">
                {feedback.body}
              </p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3" data-testid="interview-complete-ctas">
          <button
            onClick={() => navigate(`/session/${sessionId}/${nextRoute.route}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
            data-testid="interview-continue-simulation"
          >
            {nextRoute.phase ? `Continue to ${nextRoute.label}` : 'Complete Session'} <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate(`/session/${sessionId}/interview`)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="interview-practice-again"
          >
            <RotateCcw size={15} /> Practice Again
          </button>
          <Link
            to="/dashboard"
            className="text-center text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] font-mono mt-1"
            data-testid="interview-back-dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
