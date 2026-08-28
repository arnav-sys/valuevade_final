/**
 * MockExamStartPage — pre-exam briefing page for NISM-style module mock exams.
 * Route: /module/:moduleId/mock-exam/start
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import {
  ArrowLeft, ArrowRight, ClipboardList, Clock, Target, AlertCircle,
  RefreshCw, BookOpen, Loader2, CheckCircle2,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

const API = process.env.REACT_APP_BACKEND_URL;

async function authedGet(path, accessToken) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export default function MockExamStartPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exam, setExam] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id) { if (mounted) setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const tok = session?.access_token;
        const [examData, attData] = await Promise.all([
          authedGet(`/api/mock-exams/${moduleId}`, tok),
          authedGet(`/api/mock-exams/${moduleId}/my-attempts`, tok),
        ]);
        if (!mounted) return;
        setExam(examData.exam);
        setAttempts(attData.attempts || []);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load exam');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [moduleId, user?.id]);

  const startExam = async () => {
    setStarting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/mock-exams/${moduleId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const { attempt_id } = await r.json();
      navigate(`/module/${moduleId}/mock-exam`, { state: { attempt_id } });
    } catch (e) {
      alert(`Could not start exam: ${e.message}`);
      setStarting(false);
    }
  };

  const bestAttempt = attempts.find((a) => a.passed) || attempts[0];
  const estMins = exam ? exam.time_limit_minutes : 120;

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)] opacity-[0.03] blur-[160px] pointer-events-none" />
      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link
            to={`/module/${moduleId}/project/start`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group"
            data-testid="mock-exam-start-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Module
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="mock-exam-start-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-12 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-32 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="mock-exam-start-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="font-semibold text-[var(--color-text)] mb-2">No mock exam available</p>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">{error}</p>
              <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold">
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && exam && (
            <>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
                <ClipboardList size={12} /> Final Assessment
              </div>

              <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="mock-exam-start-title">
                {exam.title}
              </h1>
              {exam.description && (
                <p className="text-[var(--color-text-muted)] text-base leading-relaxed mb-6" data-testid="mock-exam-start-description">
                  {exam.description}
                </p>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 mb-8" data-testid="mock-exam-info-grid">
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center mb-3">
                    <ClipboardList size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Questions</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="mock-exam-question-count">
                    {exam.question_count}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
                    <Clock size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Time limit</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="mock-exam-time-limit">
                    {estMins} min
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] flex items-center justify-center mb-3">
                    <Target size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Pass mark</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="mock-exam-pass-mark">
                    {exam.pass_percentage}%
                  </div>
                </div>
              </div>

              {/* Previous attempts */}
              {attempts.length > 0 && (
                <div className="glass-card rounded-2xl p-5 mb-8" data-testid="mock-exam-prev-attempts">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={14} className="text-[var(--color-text-muted)]" />
                    <p className="text-sm font-semibold text-[var(--color-text)]">Previous attempts</p>
                  </div>
                  <div className="space-y-2">
                    {attempts.slice(0, 3).map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)] font-mono">
                          {new Date(a.completed_at).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--color-text)] font-semibold">{a.score}%</span>
                          {a.passed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)] text-[10px] font-mono">
                              <CheckCircle2 size={9} /> PASSED
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-mono">FAILED</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guidelines */}
              <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8 border-amber-500/20" data-testid="mock-exam-guidelines">
                <p className="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
                  <ClipboardList size={14} className="text-amber-400" /> Exam guidelines
                </p>
                <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
                  <li>• The timer starts the moment you click "Start Exam"</li>
                  <li>• Navigate freely between questions using the question panel</li>
                  <li>• Unanswered questions count as incorrect — attempt every question</li>
                  <li>• The exam auto-submits when the timer reaches zero</li>
                  <li>• You can retake the exam as many times as you need</li>
                </ul>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                  {exam.question_count === 0 ? 'No questions loaded yet' : `${exam.question_count} questions ready`}
                </span>
                <button
                  onClick={startExam}
                  disabled={starting || exam.question_count === 0}
                  data-testid="mock-exam-start-cta"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {starting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
                  {starting ? 'Preparing exam…' : 'Start Exam'}
                  {!starting && <ArrowRight size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
