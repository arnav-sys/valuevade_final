import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, ArrowLeft, ArrowRight, Sun, Moon, Sparkles, Layers, BookOpen, Clock,
  CheckCircle2, Lock, Loader2, Trash2,
} from 'lucide-react';

export default function ConfirmPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const stateData = location.state || {};
  const { plan, answers = [], freeText = '', courseStructure = [], courseTitle = '' } = stateData;

  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if no plan - wrapped in useEffect to avoid React warning
  useEffect(() => {
    if (!plan) {
      navigate(`/course/${courseId}/customize`, { replace: true });
    }
  }, [plan, courseId, navigate]);

  // Return null while redirecting
  if (!plan) {
    return null;
  }

  const removedModuleNums = new Set(
    (plan.customisation_plan || []).filter((c) => c.action === 'remove_module').map((c) => c.module_number)
  );
  const removedSessionIds = new Set(
    (plan.customisation_plan || []).filter((c) => c.action === 'remove_session').map((c) => c.session_id)
  );

  // Build final modules list (non-removed)
  const finalModules = courseStructure
    .map((mod, idx) => ({ ...mod, moduleNumber: idx + 1 }))
    .filter((mod) => !removedModuleNums.has(mod.moduleNumber));

  const totalSessions = finalModules.reduce((sum, mod) => {
    const sessions = (mod.master_sessions || []).filter((s) => !removedSessionIds.has(s.id));
    return sum + sessions.length;
  }, 0);

  const handleEnroll = async () => {
    setEnrolling(true);
    setError(null);

    try {
      // 1. Create enrollment
      const { data: enrollment, error: enrollErr } = await supabase
        .from('user_enrollments')
        .insert({
          user_id: user.id,
          master_path_id: courseId,
          status: 'active',
          customization_answers: answers,
          customization_prompt: freeText || null,
          ai_customization_plan: plan,
        })
        .select('id')
        .single();

      if (enrollErr) throw enrollErr;
      const enrollmentId = enrollment.id;

      // 2. Clone modules into user_modules
      for (let i = 0; i < courseStructure.length; i++) {
        const mod = courseStructure[i];
        const modNum = i + 1;
        const isRemoved = removedModuleNums.has(modNum);
        const removeChange = (plan.customisation_plan || []).find(
          (c) => c.action === 'remove_module' && c.module_number === modNum
        );
        const reorderChange = (plan.customisation_plan || []).find(
          (c) => c.action === 'reorder_module' && c.module_number === modNum
        );

        const { data: userMod, error: modErr } = await supabase
          .from('user_modules')
          .insert({
            enrollment_id: enrollmentId,
            master_module_id: mod.id,
            order_index: reorderChange ? reorderChange.new_position : mod.order_index,
            is_removed: isRemoved,
            ai_reasoning: isRemoved ? removeChange?.reason : null,
          })
          .select('id')
          .single();

        if (modErr) throw modErr;

        // 3. Clone sessions into user_sessions
        const sessions = mod.master_sessions || [];
        for (const sess of sessions) {
          const isSessRemoved = removedSessionIds.has(sess.id);
          const sessChange = (plan.customisation_plan || []).find(
            (c) => c.action === 'remove_session' && c.session_id === sess.id
          );

          const { error: sessErr } = await supabase
            .from('user_sessions')
            .insert({
              user_module_id: userMod.id,
              master_session_id: sess.id,
              order_index: sess.order_index,
              is_removed: isRemoved || isSessRemoved,
              ai_reasoning: isSessRemoved ? sessChange?.reason : null,
              is_added_by_ai: false,
            });

          if (sessErr) throw sessErr;
        }

        // 4. Add AI-generated sessions
        const addedSessions = (plan.customisation_plan || []).filter(
          (c) => c.action === 'add_session' && c.module_number === modNum
        );
        for (const added of addedSessions) {
          const { error: addErr } = await supabase
            .from('user_sessions')
            .insert({
              user_module_id: userMod.id,
              master_session_id: null,
              title: added.session_title,
              order_index: added.insert_after_session_number || 999,
              is_removed: false,
              ai_reasoning: added.reason,
              is_added_by_ai: true,
            });

          if (addErr) throw addErr;
        }
      }

      // Navigate to loading page
      navigate(`/course/${courseId}/loading`, {
        state: { courseTitle, enrollmentId },
      });
    } catch (err) {
      console.error('Enrollment failed:', err);
      setError(err.message || 'Failed to enroll. Please try again.');
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      <div className="absolute top-[-8%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]" data-testid="confirm-header">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="confirm-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all" data-testid="confirm-theme-toggle">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {profile && <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block">{profile.full_name}</span>}
            <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage" data-testid="confirm-signout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 sm:py-12 relative z-10">
        {/* Back */}
        <button
          onClick={() => navigate(`/course/${courseId}/preview`, { state: stateData })}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group"
          data-testid="confirm-back"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Preview
        </button>

        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/15 text-[var(--color-success)] text-xs font-mono mb-4">
            <CheckCircle2 size={14} /> Ready to Enroll
          </div>
          <h1 className="font-clash text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--color-text)] mb-2" data-testid="confirm-heading">
            Your Personalized Learning Path
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage">{courseTitle}</p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-3 mb-8" data-testid="confirm-stats">
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono bg-[var(--color-primary)]/8 text-[var(--color-primary)] border border-[var(--color-primary)]/10">
            <Layers size={14} /> {finalModules.length} modules
          </div>
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono bg-[var(--color-accent-purple)]/8 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/10">
            <BookOpen size={14} /> {totalSessions} sessions
          </div>
        </div>

        {/* Final module list */}
        <div className="space-y-2 mb-10" data-testid="confirm-modules">
          {finalModules.map((mod, idx) => {
            const isLocked = (plan.locked_modules || []).includes(mod.moduleNumber);
            const sessions = (mod.master_sessions || []).filter((s) => !removedSessionIds.has(s.id));
            return (
              <div key={mod.id} className="glass-card rounded-xl px-5 py-3.5 flex items-center gap-3" data-testid={`confirm-module-${idx}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-mono shrink-0 ${
                  isLocked
                    ? 'bg-[var(--color-text-faint)]/10 text-[var(--color-text-faint)] border border-[var(--color-border)]'
                    : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20'
                }`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-bricolage text-[var(--color-text)] flex-1">{mod.title}</span>
                <span className="text-xs font-mono text-[var(--color-text-faint)]">{sessions.length} sessions</span>
                {isLocked && <Lock size={12} className="text-[var(--color-text-faint)]" />}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-bricolage text-center" data-testid="confirm-error">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-4 pb-8" data-testid="confirm-actions">
          <button
            onClick={() => navigate(`/course/${courseId}/customize`)}
            className="px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all flex items-center gap-2"
            data-testid="confirm-modify-btn"
          >
            <ArrowLeft size={16} /> Modify
          </button>
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="px-8 py-3.5 rounded-xl text-sm font-semibold font-bricolage bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="confirm-enroll-btn"
          >
            {enrolling ? (
              <><Loader2 size={16} className="animate-spin" /> Enrolling...</>
            ) : (
              <><Sparkles size={16} /> Confirm & Enroll (Free)</>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
