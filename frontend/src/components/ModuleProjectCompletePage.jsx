import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowRight, Trophy, Sparkles, CheckCircle2, Loader2, AlertCircle, RefreshCw,
  Briefcase, Rocket, Target,
} from 'lucide-react';

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
              animation: `vvModProjConfettiFall ${duration}s cubic-bezier(.2,.7,.3,1) ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvModProjConfettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default function ModuleProjectCompletePage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [module, setModule] = useState(null);
  const [masterProject, setMasterProject] = useState(null);
  const [nextModule, setNextModule] = useState(null);
  const [allModulesDone, setAllModulesDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !moduleId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: upRows, error: upErr } = await supabase
          .from('user_module_projects')
          .select('*, user_modules(id, title, order_index, enrollment_id, is_completed)')
          .eq('user_module_id', moduleId)
          .order('updated_at', { ascending: false, nullsFirst: false });
        if (upErr) throw upErr;
        if (!mounted) return;
        const up = Array.isArray(upRows) && upRows.length > 0 ? upRows[0] : null;
        if (!up) throw new Error('No project found for this module.');
        setModule(up.user_modules || null);

        const [mpRes, sibRes] = await Promise.all([
          up.master_project_id
            ? supabase.from('master_module_projects').select('*').eq('id', up.master_project_id).single()
            : Promise.resolve({ data: null }),
          up.user_modules?.enrollment_id
            ? supabase
                .from('user_modules')
                .select('id, title, order_index, is_completed, is_removed')
                .eq('enrollment_id', up.user_modules.enrollment_id)
                .eq('is_removed', false)
                .order('order_index')
            : Promise.resolve({ data: [] }),
        ]);

        if (!mounted) return;
        setMasterProject(mpRes.data || null);

        const siblings = sibRes.data || [];
        const thisIdx = siblings.findIndex((m) => m.id === moduleId);
        const next = thisIdx >= 0 && thisIdx < siblings.length - 1 ? siblings[thisIdx + 1] : null;
        setNextModule(next);
        setAllModulesDone(siblings.length > 0 && siblings.every((m) => m.is_completed));
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load completion');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [moduleId, user?.id]);

  const skills = Array.isArray(masterProject?.skills_demonstrated)
    ? masterProject.skills_demonstrated
    : (Array.isArray(masterProject?.skills) ? masterProject.skills : []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="module-project-complete-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="module-project-complete-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load completion</p>
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
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden px-4 py-10 sm:py-14" data-testid="module-project-complete-page">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.08] blur-[140px] pointer-events-none" />

      {showConfetti && <Confetti />}

      <div className="relative z-10 max-w-2xl mx-auto" data-testid="module-project-complete-content">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)] text-xs font-mono uppercase tracking-[0.2em] mb-5">
            <Trophy size={12} /> Project complete
          </div>
          <h1 className="font-clash text-4xl sm:text-6xl font-bold text-[var(--color-text)] mb-3" data-testid="module-project-complete-title">
            Project Submitted!
          </h1>
          {masterProject?.title && (
            <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg mb-2">
              {masterProject.title}
            </p>
          )}
          <p className="text-[var(--color-text-muted)] font-bricolage max-w-md mx-auto leading-relaxed">
            You applied what you learned to a real deliverable. This is exactly how analysts build portfolios that land offers.
          </p>
        </div>

        {/* Module badge */}
        {module && (
          <div className="rounded-2xl p-5 mb-6 bg-gradient-to-br from-[var(--color-accent-purple)]/12 via-[var(--color-primary)]/8 to-transparent border border-[var(--color-accent-purple)]/30 flex items-start gap-3" data-testid="module-project-complete-module">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/40 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
              <Briefcase size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-0.5">
                {module.title}
              </div>
              <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                Module {module.order_index + 1} · Project deliverable submitted and saved.
              </p>
            </div>
          </div>
        )}

        {/* Skills demonstrated */}
        {skills.length > 0 && (
          <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8" data-testid="module-project-skills">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
              <Target size={14} className="text-[var(--color-primary)]" />
              <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                Skills demonstrated
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                  data-testid={`module-project-skill-${i}`}
                >
                  <CheckCircle2 size={11} />
                  {typeof skill === 'string' ? skill : (skill.name || skill.label || String(skill))}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3" data-testid="module-project-complete-ctas">
          {allModulesDone ? (
            <button
              onClick={() => navigate('/capstone/start')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-accent-pink)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(255,106,193,0.4)] hover:brightness-110 transition-all"
              data-testid="module-project-begin-capstone"
            >
              <Rocket size={16} />
              Begin Capstone
              <ArrowRight size={16} />
            </button>
          ) : nextModule ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="module-project-continue-next"
            >
              <Sparkles size={16} />
              Continue to Module {nextModule.order_index + 1}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="module-project-back-dashboard"
            >
              Back to Dashboard <ArrowRight size={16} />
            </button>
          )}

          <Link
            to="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="module-project-complete-back-dashboard-link"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
