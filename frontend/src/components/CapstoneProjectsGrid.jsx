import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, Sparkles, ArrowRight, Trophy, Clock, FileText } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

/**
 * Reusable 3-card capstone grid, used inside the Module 23 detail expansion
 * (and anywhere else we want to surface CAP-01..CAP-03 inline). Visual language
 * mirrors `CapstonesListPage.jsx` so the experience stays consistent.
 *
 * Self-fetching: needs only the master path id. Pulls user enrollment + the
 * single user_capstone_projects row on its own to derive locked/in-progress/
 * completed states + the prereq chips.
 */
export default function CapstoneProjectsGrid({ pathId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [capstones, setCapstones] = useState([]);
  const [userCapstone, setUserCapstone] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!pathId) { setLoading(false); return; }
      try {
        // Fetch all capstone projects — the table has no path_id column,
        // so we select all 3 rows and sort by code.
        const { data: caps, error: capErr } = await supabase
          .from('master_capstone_projects')
          .select('id, title, description, estimated_hours, deliverable_description, phases');
        if (capErr) throw capErr;
        const decorated = (caps || [])
          .map((c) => {
            let phases = c.phases;
            if (typeof phases === 'string') {
              try { phases = JSON.parse(phases); } catch { phases = {}; }
            }
            phases = phases || {};
            return {
              ...c,
              code: phases.code || '',
              prereq_codes: phases.prerequisite_capstone_codes || [],
              tools: phases.tools || phases.required_skills || [],
            };
          })
          .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        if (!mounted) return;
        setCapstones(decorated);

        if (user?.id) {
          const { data: enr } = await supabase
            .from('user_enrollments')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();
          if (enr?.id) {
            const { data: uc } = await supabase
              .from('user_capstone_projects')
              .select('id, capstone_id, started_at, is_completed')
              .eq('enrollment_id', enr.id)
              .maybeSingle();
            if (mounted) setUserCapstone(uc || null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [pathId, user?.id]);

  const completedCodes = new Set(
    capstones
      .filter((c) => userCapstone?.is_completed && userCapstone?.capstone_id === c.id)
      .map((c) => c.code),
  );
  const startedCapstoneId = userCapstone?.started_at && !userCapstone?.is_completed
    ? userCapstone.capstone_id : null;

  function statusFor(cap) {
    if (userCapstone?.is_completed && userCapstone?.capstone_id === cap.id) return 'completed';
    if (startedCapstoneId === cap.id) return 'in-progress';
    const allMet = (cap.prereq_codes || []).every((p) => completedCodes.has(p));
    if (!allMet) return 'locked';
    return 'available';
  }

  function handleOpen(cap) {
    if (statusFor(cap) === 'locked') return;
    navigate('/capstone/start');
  }

  if (loading) {
    return (
      <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="m23-capstone-grid-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-6">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-3 w-5/6 mb-4" />
            <Skeleton className="h-10 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (!capstones.length) return null;

  return (
    <div
      className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
      data-testid="m23-capstone-grid"
    >
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
            className={`text-left rounded-2xl p-5 sm:p-6 transition-all duration-200 flex flex-col h-full relative overflow-hidden border ${
              locked
                ? 'opacity-60 cursor-not-allowed bg-[var(--color-surface)] border-[var(--color-border)]'
                : completed
                ? 'bg-gradient-to-br from-[var(--color-success)]/10 via-transparent to-transparent border-[var(--color-success)]/40 hover:border-[var(--color-success)]/70 hover:shadow-[0_0_28px_rgba(34,197,94,0.18)]'
                : 'bg-gradient-to-br from-[var(--color-accent-purple)]/12 via-[var(--color-primary)]/5 to-transparent border-[var(--color-accent-purple)]/35 hover:border-[var(--color-accent-purple)]/70 hover:shadow-[0_0_28px_rgba(106,92,255,0.28)]'
            }`}
            data-testid={`m23-capstone-card-${cap.code || cap.id}`}
          >
            {/* Subtle top accent stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: locked
                  ? 'transparent'
                  : completed
                  ? 'linear-gradient(90deg, transparent, rgba(34,197,94,0.6), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(106,92,255,0.7), transparent)',
              }}
            />

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
              {locked && (
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-faint)] ml-auto">
                  · locked
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

            {cap.deliverable_description && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--bg-primary)]/40 border border-[var(--color-border)]">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-text-faint)] mb-1.5 inline-flex items-center gap-1">
                  <FileText size={10} /> Deliverable
                </div>
                <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                  {String(cap.deliverable_description).split('\n').slice(0, 2).join(' · ')}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--color-text-faint)] mb-4 flex-wrap">
              {cap.estimated_hours ? (
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} /> {cap.estimated_hours}h
                </span>
              ) : null}
              {(cap.tools || []).slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                >
                  {t}
                </span>
              ))}
            </div>

            {locked && (cap.prereq_codes || []).length > 0 && (
              <div
                className="text-[11px] font-mono text-[var(--color-text-faint)] mt-auto inline-flex items-center gap-2"
                data-testid={`m23-capstone-card-${cap.code}-prereq`}
              >
                <Lock size={11} />
                Requires:{' '}
                <span className="text-[var(--color-text-muted)] px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">
                  {(cap.prereq_codes || []).join(', ')}
                </span>
              </div>
            )}

            <div className="mt-auto">
              {locked ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-faint)]">
                  <Lock size={14} /> Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent-purple)]">
                  {completed ? 'View Capstone' : inProgress ? 'Continue Capstone' : 'Start Capstone'}{' '}
                  <ArrowRight size={14} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
