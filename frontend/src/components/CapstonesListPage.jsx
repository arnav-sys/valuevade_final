import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import { Lock, Sparkles, ArrowRight, Trophy, Clock, FileText } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

/**
 * Curriculum v2 — top-level capstones index.
 *
 * Always renders for any logged-in user enrolled in equity-research, regardless
 * of how far they are in the modules. Fetches all `master_capstone_projects`
 * tied to the user's path and surfaces them as a 3-card grid with prereq locking
 * resolved from the row's `phases.prerequisite_capstone_codes` JSONB.
 */
export default function CapstonesListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [capstones, setCapstones] = useState([]);
  const [userCapstone, setUserCapstone] = useState(null); // single row from user_capstone_projects (existing schema)

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id) {
        if (mounted) {
          setLoading(false);
          setError('Sign in to view capstones.');
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: enr, error: enrErr } = await supabase
          .from('user_enrollments')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (enrErr) throw enrErr;
        if (!mounted) return;
        setEnrollment(enr);
        if (!enr) {
          setLoading(false);
          return;
        }

        const { data: caps, error: capErr } = await supabase
          .from('master_capstone_projects')
          .select('id, title, description, estimated_hours, deliverable_description, phases')
          .eq('path_id', enr.master_path_id);
        if (capErr) throw capErr;
        if (!mounted) return;

        // Decorate each row with `code` + `prereq_codes` from the JSONB.
        const decorated = (caps || []).map((c) => {
          let phases = c.phases;
          if (typeof phases === 'string') {
            try { phases = JSON.parse(phases); } catch { phases = {}; }
          }
          phases = phases || {};
          return {
            ...c,
            code: phases.code || '',
            prereq_codes: phases.prerequisite_capstone_codes || [],
            learning_outcomes: phases.learning_outcomes || '',
          };
        }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setCapstones(decorated);

        // existing user capstone progress row (any of them — schema only stores one)
        const { data: uc } = await supabase
          .from('user_capstone_projects')
          .select('id, capstone_id, started_at, is_completed')
          .eq('enrollment_id', enr.id)
          .maybeSingle();
        if (!mounted) return;
        setUserCapstone(uc || null);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load capstones');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const completedCodes = new Set(
    capstones
      .filter((c) => userCapstone?.is_completed && userCapstone?.capstone_id === c.id)
      .map((c) => c.code)
  );

  const startedCapstoneId = userCapstone?.started_at && !userCapstone?.is_completed
    ? userCapstone.capstone_id : null;

  function statusFor(cap) {
    if (userCapstone?.is_completed && userCapstone?.capstone_id === cap.id) return 'completed';
    if (startedCapstoneId === cap.id) return 'in-progress';
    const allPrereqsMet = (cap.prereq_codes || []).every((p) => completedCodes.has(p));
    if (!allPrereqsMet) return 'locked';
    return 'available';
  }

  function handleOpen(cap) {
    const status = statusFor(cap);
    if (status === 'locked') return;
    // Route into the existing single-capstone flow. The CapstoneStartPage already
    // loads the user's user_capstone_projects row + module/project gates; for v2
    // the additional grid renders alongside the existing UI.
    navigate('/capstone/start');
  }

  return (
    <div className="min-h-screen relative flex bg-[var(--bg-primary)]" data-testid="capstones-list-page">
      <Sidebar />
      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={18} className="text-[var(--color-accent-purple)]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Equity Research · Capstones
            </span>
          </div>
          <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="capstones-list-title">
            Capstone projects
          </h1>
          <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg leading-relaxed mb-10 max-w-2xl">
            Three end-to-end equity research projects to take you from notes to portfolio-ready output.
            Complete CAP-01 to unlock CAP-02; CAP-03 is independent.
          </p>

          {loading && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="capstones-list-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-2xl p-6">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-5/6 mb-4" />
                  <Skeleton className="h-10 w-32" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="glass-card rounded-2xl p-6 text-[var(--color-text)]" data-testid="capstones-list-error">
              {error}
            </div>
          )}

          {!loading && !error && !enrollment && (
            <div className="glass-card rounded-2xl p-6" data-testid="capstones-list-not-enrolled">
              <p className="text-[var(--color-text)] mb-3">You're not enrolled in a learning path yet.</p>
              <button
                onClick={() => navigate('/courses')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold"
                data-testid="capstones-list-enroll-cta"
              >
                Browse courses <ArrowRight size={14} />
              </button>
            </div>
          )}

          {!loading && !error && enrollment && capstones.length === 0 && (
            <div className="glass-card rounded-2xl p-6 text-[var(--color-text-muted)]" data-testid="capstones-list-empty">
              No capstones configured for this path yet.
            </div>
          )}

          {!loading && !error && capstones.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5" data-testid="capstones-list-grid">
              {capstones.map((cap) => {
                const status = statusFor(cap);
                const locked = status === 'locked';
                const completed = status === 'completed';
                const inProgress = status === 'in-progress';
                return (
                  <button
                    key={cap.id}
                    onClick={() => handleOpen(cap)}
                    disabled={locked}
                    className={`text-left glass-card rounded-2xl p-5 sm:p-6 transition-all duration-200 flex flex-col h-full ${
                      locked
                        ? 'opacity-60 cursor-not-allowed border-[var(--color-border)]'
                        : completed
                        ? 'border-[var(--color-success)]/40 hover:border-[var(--color-success)]/70'
                        : 'border-[var(--color-accent-purple)]/30 hover:border-[var(--color-accent-purple)]/70 hover:shadow-[0_0_24px_rgba(106,92,255,0.25)]'
                    }`}
                    data-testid={`capstone-card-${cap.code || cap.id}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {completed ? (
                        <Trophy size={14} className="text-[var(--color-success)]" />
                      ) : locked ? (
                        <Lock size={14} className="text-[var(--color-text-faint)]" />
                      ) : (
                        <Sparkles size={14} className="text-[var(--color-accent-purple)]" />
                      )}
                      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        {cap.code || 'Capstone'}
                      </span>
                      {inProgress && (
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-accent-pink)] ml-auto">
                          · in progress
                        </span>
                      )}
                      {completed && (
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-success)] ml-auto">
                          · done
                        </span>
                      )}
                    </div>

                    <h3 className="font-clash text-lg sm:text-xl font-semibold text-[var(--color-text)] leading-tight mb-3">
                      {cap.title}
                    </h3>

                    {cap.description && (
                      <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed mb-4 line-clamp-3">
                        {cap.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] font-mono text-[var(--color-text-faint)] mb-4">
                      {cap.estimated_hours ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {cap.estimated_hours}h
                        </span>
                      ) : null}
                      {cap.deliverable_description ? (
                        <span className="inline-flex items-center gap-1">
                          <FileText size={12} /> Deliverable
                        </span>
                      ) : null}
                    </div>

                    {locked && (cap.prereq_codes || []).length > 0 && (
                      <div
                        className="text-[11px] font-mono text-[var(--color-text-faint)] mt-auto"
                        data-testid={`capstone-card-${cap.code}-prereq`}
                      >
                        Complete <span className="text-[var(--color-text-muted)]">{(cap.prereq_codes || []).join(', ')}</span> to unlock
                      </div>
                    )}

                    {!locked && (
                      <div className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent-purple)]">
                        {completed ? 'View' : inProgress ? 'Continue' : 'Start'} <ArrowRight size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
