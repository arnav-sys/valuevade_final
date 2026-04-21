import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import {
  ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Lock, Trophy, Rocket,
  Clock, Sparkles, Target, PlayCircle, FileText, CheckCircle2,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

export default function CapstoneStartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [capstone, setCapstone] = useState(null);
  const [masterCapstone, setMasterCapstone] = useState(null);
  const [modules, setModules] = useState([]);
  const [moduleProjects, setModuleProjects] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id) return;
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

        const { data: cap, error: capErr } = await supabase
          .from('user_capstone_projects')
          .select('*, master_capstone_projects(*)')
          .eq('enrollment_id', enr.id)
          .maybeSingle();
        if (capErr) throw capErr;
        if (!mounted) return;
        setCapstone(cap || null);
        setMasterCapstone(cap?.master_capstone_projects || null);

        const { data: mods, error: mErr } = await supabase
          .from('user_modules')
          .select('id, title, order_index, is_completed, is_removed')
          .eq('enrollment_id', enr.id)
          .eq('is_removed', false)
          .order('order_index');
        if (mErr) throw mErr;
        if (!mounted) return;
        const activeModules = mods || [];
        setModules(activeModules);

        if (activeModules.length) {
          const { data: projs } = await supabase
            .from('user_module_projects')
            .select('user_module_id, is_completed')
            .in('user_module_id', activeModules.map((m) => m.id));
          if (mounted) setModuleProjects(projs || []);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load capstone');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const allModulesDone = modules.length > 0 && modules.every((m) => m.is_completed);
  const projectsMap = new Map(moduleProjects.map((p) => [p.user_module_id, p]));
  const incompleteModules = modules.filter((m) => !m.is_completed);
  const incompleteProjects = modules.filter((m) => {
    const p = projectsMap.get(m.id);
    return !p || !p.is_completed;
  });
  const isUnlocked = allModulesDone && incompleteProjects.length === 0;

  const handleBegin = async () => {
    try {
      if (capstone && !capstone.started_at) {
        await supabase
          .from('user_capstone_projects')
          .update({ started_at: new Date().toISOString() })
          .eq('id', capstone.id);
      }
      navigate('/capstone/tasks');
    } catch {
      navigate('/capstone/tasks');
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      {/* Premium ambient glow */}
      <div className="absolute top-[-10%] left-[15%] w-[600px] h-[600px] rounded-full bg-[var(--color-accent-pink)] opacity-[0.08] blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[15%] w-[600px] h-[600px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.08] blur-[160px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage"
            data-testid="capstone-start-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="capstone-start-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-14 w-3/4 bg-[var(--color-surface)]" />
              <Skeleton className="h-24 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-40 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="capstone-start-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load capstone</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && (!enrollment || !masterCapstone) && (
            <div className="flex flex-col items-center text-center py-16" data-testid="capstone-empty">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-5">
                <Trophy size={28} className="text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">No capstone configured</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage">
                Your active enrollment doesn't have a capstone project yet.
              </p>
            </div>
          )}

          {!loading && !error && enrollment && masterCapstone && (
            <>
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5" data-testid="capstone-breadcrumb">
                <span>{enrollment.title}</span>
                <span className="text-[var(--color-text-faint)]">›</span>
                <span className="text-[var(--color-text)]">Capstone</span>
              </div>

              {/* Premium gradient-border card */}
              <div
                className="relative rounded-3xl p-[1.5px] mb-8 overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, var(--color-accent-pink) 0%, var(--color-accent-purple) 50%, var(--color-primary) 100%)',
                }}
                data-testid="capstone-premium-card"
              >
                <div className="rounded-[22px] bg-[var(--color-surface)] p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-accent-pink)]/20 to-[var(--color-accent-purple)]/20 border border-[var(--color-accent-pink)]/30 flex items-center justify-center shrink-0">
                      <Trophy size={28} className="text-[var(--color-accent-pink)]" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-pink)]">
                        The Final Challenge
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mt-0.5">
                        Capstone Project
                      </div>
                    </div>
                  </div>

                  <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="capstone-start-title">
                    {masterCapstone.title || 'Capstone Project'}
                  </h1>

                  {masterCapstone.description && (
                    <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg leading-relaxed" data-testid="capstone-start-description">
                      {masterCapstone.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Deliverable */}
              {masterCapstone.deliverable_description && (
                <div className="glass-card rounded-2xl p-5 sm:p-6 mb-6" data-testid="capstone-deliverable">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-[var(--color-accent-purple)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Final deliverable
                    </h2>
                  </div>
                  <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                    {masterCapstone.deliverable_description}
                  </p>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 mb-8" data-testid="capstone-meta">
                <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-pink)]/15 border border-[var(--color-accent-pink)]/30 text-[var(--color-accent-pink)] flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-0.5">
                      Estimated hours
                    </div>
                    <div className="font-clash text-base font-semibold text-[var(--color-text)]">
                      {masterCapstone.estimated_hours
                        ? `${masterCapstone.estimated_hours} hrs`
                        : masterCapstone.estimated_time || '—'}
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
                    <Target size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-0.5">
                      Phases
                    </div>
                    <div className="font-clash text-base font-semibold text-[var(--color-text)]">
                      {Array.isArray(masterCapstone.phases) ? masterCapstone.phases.length : 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Locked or Unlocked CTA */}
              {!isUnlocked ? (
                <div className="glass-card rounded-2xl p-5 sm:p-6 border-[var(--color-warning)]/25" data-testid="capstone-locked">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock size={16} className="text-[var(--color-warning)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Finish everything first
                    </h2>
                  </div>
                  <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed mb-4">
                    Your capstone unlocks once every module and module project is complete.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)]">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">
                        Modules remaining
                      </div>
                      <div className="font-clash text-xl font-bold text-[var(--color-text)]" data-testid="capstone-locked-modules-count">
                        {incompleteModules.length}
                      </div>
                    </div>
                    <div className="rounded-xl p-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)]">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">
                        Projects remaining
                      </div>
                      <div className="font-clash text-xl font-bold text-[var(--color-text)]" data-testid="capstone-locked-projects-count">
                        {incompleteProjects.length}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 flex-wrap" data-testid="capstone-begin-row">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    <Sparkles size={11} className="inline mr-1" /> This is the last mile
                  </span>
                  <button
                    onClick={handleBegin}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-accent-pink)] via-[var(--color-accent-purple)] to-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_28px_rgba(255,106,193,0.4)] hover:brightness-110 transition-all"
                    data-testid="capstone-begin-cta"
                  >
                    {capstone?.started_at ? <PlayCircle size={16} /> : <Rocket size={16} />}
                    {capstone?.started_at ? 'Continue Capstone' : 'Begin Capstone'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
