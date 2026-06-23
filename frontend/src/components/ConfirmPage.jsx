import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './ui/dialog';
import {
  LogOut, ArrowLeft, Sun, Moon, Sparkles, Layers, BookOpen, Clock,
  CheckCircle2, Lock, Loader2, Trash2, Plus, ArrowUp, ArrowDown, RotateCcw,
  ChevronDown, ChevronRight, Wand2, X,
} from 'lucide-react';

// Batch 4 — Manual add/remove/reorder on the LLM-customized structure.
//
// Mental model:
//   plan.customisation_plan = the LLM's recipe of changes to apply on top
//     of the master courseStructure. Each entry is an action like
//     { action: 'remove_module', module_number }, { action: 'add_session',
//     module_number, session_title, ... }, etc.
//
//   editedPlan        = a LOCAL mutable copy of customisation_plan that the
//                       user can add/remove from via this page's controls.
//   sessionOrderOverrides[moduleId] = within-module session order override
//                       array of session ids (existing master ids OR synthetic
//                       AI add_session ids). Wins over master order_index.
//   addedAiSessions   = additional ai-added sessions the user manually
//                       inserted (mirrors plan.add_session entries).
//
// The final view is derived live from these three pieces, so every UI
// affordance just mutates state and the panel re-renders.

const SYN_AI_PREFIX = 'aiadd_';

function shortId() {
  return `${SYN_AI_PREFIX}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

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
  const enrollingRef = useRef(false);

  // Original LLM plan — preserved verbatim so "Reset" can restore it.
  const llmPlanRef = useRef(plan?.customisation_plan ? [...plan.customisation_plan] : []);

  // Mutable local copy of the customisation plan that the user edits.
  const [editedPlan, setEditedPlan] = useState(() => (plan?.customisation_plan ? [...plan.customisation_plan] : []));
  const [sessionOrderOverrides, setSessionOrderOverrides] = useState({}); // {masterModuleId: [sessId,...]}
  const [hasManualEdits, setHasManualEdits] = useState(false);

  // Modal state.
  const [addSessionFor, setAddSessionFor] = useState(null); // moduleNumber
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [expanded, setExpanded] = useState({}); // {moduleNumber: bool}
  const [confirmRemoval, setConfirmRemoval] = useState(null); // {kind:'module'|'session', payload}
  const [confirmReset, setConfirmReset] = useState(false);

  // ---------------------- Derived view (computed live) ----------------------
  // IMPORTANT: All hooks must be declared BEFORE any conditional return so we
  // never violate the rules-of-hooks. The `if (!plan)` guard is at the end.

  const removedModuleNums = useMemo(
    () => new Set(editedPlan.filter((c) => c.action === 'remove_module').map((c) => c.module_number)),
    [editedPlan]
  );
  const removedSessionIds = useMemo(
    () => new Set(editedPlan.filter((c) => c.action === 'remove_session').map((c) => c.session_id)),
    [editedPlan]
  );
  const addedSessionsByMod = useMemo(() => {
    const m = {};
    editedPlan
      .filter((c) => c.action === 'add_session')
      .forEach((c) => {
        if (!m[c.module_number]) m[c.module_number] = [];
        m[c.module_number].push(c);
      });
    return m;
  }, [editedPlan]);

  const reorderByModNum = useMemo(() => {
    const m = {};
    editedPlan.filter((c) => c.action === 'reorder_module').forEach((c) => { m[c.module_number] = c; });
    return m;
  }, [editedPlan]);

  const visibleModules = useMemo(() => {
    return (courseStructure || [])
      .map((mod, idx) => ({ ...mod, moduleNumber: idx + 1 }))
      .filter((mod) => !removedModuleNums.has(mod.moduleNumber));
  }, [courseStructure, removedModuleNums]);

  const removedModules = useMemo(() => {
    return (courseStructure || [])
      .map((mod, idx) => ({ ...mod, moduleNumber: idx + 1 }))
      .filter((mod) => removedModuleNums.has(mod.moduleNumber));
  }, [courseStructure, removedModuleNums]);

  const buildSessionListForModule = useCallback((mod) => {
    const masterSessions = (mod.master_sessions || [])
      .filter((s) => !removedSessionIds.has(s.id))
      .map((s) => ({ kind: 'master', id: s.id, title: s.title, baseOrder: s.order_index }));
    const aiSessions = (addedSessionsByMod[mod.moduleNumber] || []).map((c) => ({
      kind: 'ai',
      id: c._localId || c.session_id || `aiadd_${c.module_number}_${(c.session_title || '').slice(0, 12)}`,
      title: c.session_title,
      baseOrder: (c.insert_after_session_number || 999),
      planEntry: c,
    }));
    const combined = [...masterSessions, ...aiSessions];
    const override = sessionOrderOverrides[mod.id];
    if (Array.isArray(override) && override.length > 0) {
      const byId = Object.fromEntries(combined.map((s) => [s.id, s]));
      const ordered = override.map((id) => byId[id]).filter(Boolean);
      const inOverride = new Set(override);
      combined.forEach((s) => { if (!inOverride.has(s.id)) ordered.push(s); });
      return ordered;
    }
    return combined.sort((a, b) => (a.baseOrder ?? 0) - (b.baseOrder ?? 0));
  }, [removedSessionIds, addedSessionsByMod, sessionOrderOverrides]);

  const totalSessions = useMemo(() => {
    return visibleModules.reduce((sum, mod) => sum + buildSessionListForModule(mod).length, 0);
  }, [visibleModules, buildSessionListForModule]);

  const estimatedHours = useMemo(() => Math.max(1, Math.round(totalSessions * 0.5)), [totalSessions]);

  const canEnroll = useMemo(() => {
    if (visibleModules.length === 0) return false;
    return visibleModules.some((mod) => buildSessionListForModule(mod).length > 0);
  }, [visibleModules, buildSessionListForModule]);

  // Guard against rendering when plan is missing (declared LAST after all hooks).
  useEffect(() => {
    if (!plan) {
      navigate(`/course/${courseId}/customize`, { replace: true });
    }
  }, [plan, courseId, navigate]);
  if (!plan) return null;

  // ---------------------- Plan mutators ----------------------

  const markEdited = () => setHasManualEdits(true);

  const removeSession = (moduleNumber, session) => {
    setEditedPlan((prev) => {
      if (session.kind === 'ai') {
        // Drop the corresponding add_session plan entry.
        return prev.filter((c) => !(c.action === 'add_session' && (c._localId || c.session_id) === session.id));
      }
      // Master session → add remove_session entry if not already present.
      const has = prev.some((c) => c.action === 'remove_session' && c.session_id === session.id);
      if (has) return prev;
      return [...prev, {
        action: 'remove_session', module_number: moduleNumber, session_id: session.id,
        reason: 'Removed manually by student',
      }];
    });
    // Also drop from any override list.
    setSessionOrderOverrides((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = next[k].filter((id) => id !== session.id);
      });
      return next;
    });
    markEdited();
  };

  const addSessionBack = (moduleNumber, masterSessionId) => {
    setEditedPlan((prev) => prev.filter(
      (c) => !(c.action === 'remove_session' && c.session_id === masterSessionId)
    ));
    markEdited();
  };

  const addAiSession = (moduleNumber, title) => {
    const localId = shortId();
    setEditedPlan((prev) => [...prev, {
      action: 'add_session', module_number: moduleNumber, session_title: title,
      insert_after_session_number: 999, reason: 'Added manually by student',
      _localId: localId, session_id: localId,
    }]);
    markEdited();
  };

  const removeModule = (moduleNumber) => {
    setEditedPlan((prev) => {
      const has = prev.some((c) => c.action === 'remove_module' && c.module_number === moduleNumber);
      if (has) return prev;
      // Also drop any add_session entries scoped to this module (they'd be orphaned).
      const filtered = prev.filter((c) => !(c.action === 'add_session' && c.module_number === moduleNumber));
      return [...filtered, {
        action: 'remove_module', module_number: moduleNumber,
        reason: 'Removed manually by student',
      }];
    });
    markEdited();
  };

  const addModuleBack = (moduleNumber) => {
    setEditedPlan((prev) => prev.filter(
      (c) => !(c.action === 'remove_module' && c.module_number === moduleNumber)
    ));
    setExpanded((p) => ({ ...p, [moduleNumber]: true }));
    markEdited();
  };

  const reorderSession = (mod, currentIndex, direction) => {
    const list = buildSessionListForModule(mod);
    const target = currentIndex + direction;
    if (target < 0 || target >= list.length) return;
    const newOrder = list.map((s) => s.id);
    [newOrder[currentIndex], newOrder[target]] = [newOrder[target], newOrder[currentIndex]];
    setSessionOrderOverrides((prev) => ({ ...prev, [mod.id]: newOrder }));
    markEdited();
  };

  const resetToLlm = () => {
    setEditedPlan([...llmPlanRef.current]);
    setSessionOrderOverrides({});
    setHasManualEdits(false);
    setExpanded({});
    setConfirmReset(false);
  };

  // ---------------------- Enroll handler (Batch 3 bulk-insert preserved) ----------------------

  const handleEnroll = async () => {
    if (enrollingRef.current) return;
    if (!canEnroll) {
      setError('You need at least one module with at least one session.');
      return;
    }
    enrollingRef.current = true;
    setEnrolling(true);
    setError(null);
    try {
      // 1. Upsert enrollment (preserve user_stats by updating in place when present).
      const { data: existing } = await supabase
        .from('user_enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('master_path_id', courseId)
        .maybeSingle();

      // Build the final plan-shaped object we'll persist on the enrollment
      // for audit + so re-customize flows can read it back.
      const finalPlanForAudit = {
        ...plan,
        customisation_plan: editedPlan,
        session_order_overrides: sessionOrderOverrides,
        manually_edited: hasManualEdits,
      };

      let enrollmentId;
      if (existing) {
        enrollmentId = existing.id;
        const { error: delErr } = await supabase
          .from('user_modules')
          .delete()
          .eq('enrollment_id', enrollmentId);
        if (delErr) throw delErr;
        const { error: updErr } = await supabase
          .from('user_enrollments')
          .update({
            title: courseTitle,
            status: 'active',
            customization_answers: answers,
            customization_prompt: freeText || null,
            ai_customization_plan: finalPlanForAudit,
          })
          .eq('id', enrollmentId);
        if (updErr) throw updErr;
      } else {
        const { data: enrollment, error: enrollErr } = await supabase
          .from('user_enrollments')
          .insert({
            user_id: user.id,
            master_path_id: courseId,
            title: courseTitle,
            status: 'active',
            customization_answers: answers,
            customization_prompt: freeText || null,
            ai_customization_plan: finalPlanForAudit,
          })
          .select('id')
          .single();
        if (enrollErr) throw enrollErr;
        enrollmentId = enrollment.id;
      }

      // 2. Bulk insert user_modules (re-using Batch 3 single round-trip pattern).
      const modulePayload = courseStructure.map((mod, i) => {
        const modNum = i + 1;
        const isRemoved = removedModuleNums.has(modNum);
        const reorderChange = reorderByModNum[modNum];
        const removeChange  = editedPlan.find((c) => c.action === 'remove_module' && c.module_number === modNum);
        return {
          enrollment_id: enrollmentId,
          master_module_id: mod.id,
          title: mod.title,
          order_index: reorderChange ? reorderChange.new_position : mod.order_index,
          // Canonical label number — never affected by sort reorders. Falls
          // back to mod.module_number from master, then to mod.order_index.
          module_number: mod.module_number ?? mod.order_index,
          is_removed: isRemoved,
          ai_reasoning: isRemoved ? (removeChange?.reason || null) : null,
        };
      });
      const { data: insertedMods, error: modsErr } = await supabase
        .from('user_modules')
        .insert(modulePayload)
        .select('id, master_module_id');
      if (modsErr) throw modsErr;
      const userModIdByMaster = {};
      (insertedMods || []).forEach((r) => { if (r.master_module_id) userModIdByMaster[r.master_module_id] = r.id; });

      // 3. Bulk insert user_sessions, honoring the user's per-module reorder.
      const sessionPayload = [];
      courseStructure.forEach((mod, i) => {
        const modNum = i + 1;
        const isModRemoved = removedModuleNums.has(modNum);
        const umId = userModIdByMaster[mod.id];
        if (!umId) return;
        // Compute the FINAL ordered session id list for this module (factoring
        // user override + AI adds + master sessions minus removed).
        const orderedIds = isModRemoved
          ? []
          : buildSessionListForModule({ ...mod, moduleNumber: modNum }).map((s) => s.id);
        const orderRank = Object.fromEntries(orderedIds.map((id, idx) => [id, idx]));

        // Insert master sessions (kept).
        (mod.master_sessions || []).forEach((sess) => {
          const isSessRemoved = removedSessionIds.has(sess.id);
          const sessChange = editedPlan.find(
            (c) => c.action === 'remove_session' && c.session_id === sess.id
          );
          sessionPayload.push({
            user_module_id: umId,
            master_session_id: sess.id,
            title: sess.title,
            order_index: isSessRemoved || isModRemoved
              ? (sess.order_index ?? 0)
              : (orderRank[sess.id] ?? sess.order_index ?? 0),
            is_removed: isModRemoved || isSessRemoved,
            ai_reasoning: isSessRemoved ? (sessChange?.reason || null) : null,
            is_added_by_ai: false,
          });
        });
        // AI-added sessions for this module.
        (addedSessionsByMod[modNum] || []).forEach((added) => {
          const localId = added._localId || added.session_id;
          sessionPayload.push({
            user_module_id: umId,
            master_session_id: null,
            title: added.session_title,
            order_index: orderRank[localId] ?? (added.insert_after_session_number || 999),
            is_removed: false,
            ai_reasoning: added.reason,
            is_added_by_ai: true,
          });
        });
      });
      if (sessionPayload.length > 0) {
        const { error: sessErr } = await supabase.from('user_sessions').insert(sessionPayload);
        if (sessErr) throw sessErr;
      }

      // 4. Seed user_module_projects (unchanged from Batch 3).
      try {
        const { data: seededMods, error: seededErr } = await supabase
          .from('user_modules').select('id, master_module_id').eq('enrollment_id', enrollmentId);
        if (seededErr) throw seededErr;
        const masterModuleIds = (seededMods || []).map((m) => m.master_module_id).filter(Boolean);
        if (masterModuleIds.length > 0) {
          const { data: masterProjects, error: mpErr } = await supabase
            .from('master_module_projects').select('id, module_id').in('module_id', masterModuleIds);
          if (mpErr) throw mpErr;
          const projectByMaster = {};
          (masterProjects || []).forEach((p) => { projectByMaster[p.module_id] = p.id; });
          const projectRows = (seededMods || [])
            .map((um) => {
              const masterProjectId = projectByMaster[um.master_module_id];
              if (!masterProjectId) return null;
              return { user_module_id: um.id, master_project_id: masterProjectId, is_completed: false, started_at: null };
            }).filter(Boolean);
          if (projectRows.length > 0) {
            const { error: ump_err } = await supabase.from('user_module_projects').insert(projectRows);
            if (ump_err) throw ump_err;
          }
        }
      } catch (seedErr) {
        // eslint-disable-next-line no-console
        console.warn('[Enrollment] user_module_projects seed failed:', seedErr);
      }

      navigate(`/course/${courseId}/loading`, { state: { courseTitle, enrollmentId } });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Enrollment failed:', err);
      const msg = String(err?.message || err || '');
      const looksLikeDup = /duplicate key value violates unique constraint/i.test(msg) || err?.code === '23505';
      if (looksLikeDup) { navigate('/dashboard', { replace: true }); return; }
      setError(err.message || 'Failed to enroll. Please try again.');
      setEnrolling(false);
      enrollingRef.current = false;
    }
  };

  // ---------------------- Render ----------------------

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      <div className="absolute top-[-8%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[15%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-[var(--color-border)]/40 backdrop-blur-md sticky top-0 z-50 bg-[var(--color-bg)]/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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
        <button
          onClick={() => navigate(`/course/${courseId}/preview`, { state: stateData })}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group"
          data-testid="confirm-back"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Preview
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/15 text-[var(--color-success)] text-xs font-mono mb-4">
            <CheckCircle2 size={14} /> Ready to Enroll
          </div>
          <h1 className="font-clash text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--color-text)] mb-2" data-testid="confirm-heading">
            Your Personalized Learning Path
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage">{courseTitle}</p>
        </div>

        {/* Live counters (Batch 4) */}
        <div className="flex flex-wrap justify-center items-center gap-3 mb-8" data-testid="confirm-stats">
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono bg-[var(--color-primary)]/8 text-[var(--color-primary)] border border-[var(--color-primary)]/10" data-testid="confirm-stats-modules">
            <Layers size={14} /> {visibleModules.length} modules
          </div>
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono bg-[var(--color-accent-purple)]/8 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/10" data-testid="confirm-stats-sessions">
            <BookOpen size={14} /> {totalSessions} sessions
          </div>
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono bg-[var(--color-warning,#F59E0B)]/8 text-[var(--color-warning,#F59E0B)] border border-[var(--color-warning,#F59E0B)]/10" data-testid="confirm-stats-hours">
            <Clock size={14} /> ~{estimatedHours} hrs total
          </div>
          {hasManualEdits && (
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono bg-[var(--color-accent-purple)]/15 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/30" data-testid="confirm-modified-pill">
              <Wand2 size={14} /> Modified by you
            </div>
          )}
          {hasManualEdits && (
            <button
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
              data-testid="confirm-reset-btn"
            >
              <RotateCcw size={13} /> Reset to LLM
            </button>
          )}
        </div>

        {/* Final module list */}
        <div className="space-y-3 mb-6" data-testid="confirm-modules">
          {visibleModules.map((mod, idx) => {
            const isLocked = (plan.locked_modules || []).includes(mod.moduleNumber);
            const sessions = buildSessionListForModule(mod);
            const isOpen = !!expanded[mod.moduleNumber];
            return (
              <div
                key={mod.id}
                className="glass-card rounded-xl overflow-hidden"
                data-testid={`confirm-module-${idx}`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [mod.moduleNumber]: !p[mod.moduleNumber] }))}
                  className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-[var(--color-surface)]/40 transition-colors"
                  data-testid={`confirm-module-toggle-${idx}`}
                >
                  {isOpen ? <ChevronDown size={16} className="text-[var(--color-text-muted)] shrink-0" /> : <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />}
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
                  {!isLocked && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setConfirmRemoval({ kind: 'module', moduleNumber: mod.moduleNumber, sessionCount: sessions.length, title: mod.title }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setConfirmRemoval({ kind: 'module', moduleNumber: mod.moduleNumber, sessionCount: sessions.length, title: mod.title }); } }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer"
                      data-testid={`confirm-remove-module-${idx}`}
                      aria-label={`Remove module ${mod.title}`}
                    >
                      <Trash2 size={13} />
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pt-1 border-t border-[var(--color-border)]/40" data-testid={`confirm-module-body-${idx}`}>
                    {sessions.length === 0 && (
                      <div className="text-xs text-[var(--color-text-faint)] py-2 font-bricolage italic">
                        No sessions in this module yet. Add one below.
                      </div>
                    )}
                    <ul className="space-y-1.5 py-2">
                      {sessions.map((s, sidx) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface)]/40 border border-[var(--color-border)]/40 group"
                          data-testid={`confirm-session-${idx}-${sidx}`}
                        >
                          <span className="text-[10px] font-mono text-[var(--color-text-faint)] w-6 shrink-0">{String(sidx + 1).padStart(2, '0')}</span>
                          {s.kind === 'ai' && (
                            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-accent-purple)]/15 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/30 shrink-0">
                              new
                            </span>
                          )}
                          <span className="text-sm font-bricolage text-[var(--color-text)] flex-1 truncate">{s.title}</span>
                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              disabled={sidx === 0}
                              onClick={() => reorderSession(mod, sidx, -1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              data-testid={`confirm-session-up-${idx}-${sidx}`}
                              aria-label="Move session up"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={sidx === sessions.length - 1}
                              onClick={() => reorderSession(mod, sidx, 1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              data-testid={`confirm-session-down-${idx}-${sidx}`}
                              aria-label="Move session down"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSession(mod.moduleNumber, s)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                              data-testid={`confirm-session-remove-${idx}-${sidx}`}
                              aria-label="Remove session"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setAddSessionFor(mod.moduleNumber)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bricolage text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 border border-dashed border-[var(--color-primary)]/30 transition-colors"
                      data-testid={`confirm-add-session-btn-${idx}`}
                    >
                      <Plus size={12} /> Add session
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add module button */}
        {removedModules.length > 0 && (
          <div className="mb-8">
            <button
              type="button"
              onClick={() => setAddModuleOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bricolage text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 border border-dashed border-[var(--color-primary)]/30 transition-colors"
              data-testid="confirm-add-module-btn"
            >
              <Plus size={14} /> Add module ({removedModules.length} available)
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-bricolage text-center" data-testid="confirm-error">
            {error}
          </div>
        )}
        {!canEnroll && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[var(--color-warning,#F59E0B)]/10 border border-[var(--color-warning,#F59E0B)]/20 text-[var(--color-warning,#F59E0B)] text-sm font-bricolage text-center" data-testid="confirm-validation-warning">
            Your path needs at least one module with at least one session. Add something before you enroll.
          </div>
        )}

        {/* Actions */}
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
            disabled={enrolling || !canEnroll}
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

      {/* --- Add Session Modal --- */}
      <AddSessionDialog
        open={addSessionFor !== null}
        onClose={() => setAddSessionFor(null)}
        moduleNumber={addSessionFor}
        courseStructure={courseStructure}
        removedSessionIds={removedSessionIds}
        addedSessionsByMod={addedSessionsByMod}
        onAddBack={(sid) => addSessionBack(addSessionFor, sid)}
        onAddNew={(title) => addAiSession(addSessionFor, title)}
      />

      {/* --- Add Module Modal --- */}
      <AddModuleDialog
        open={addModuleOpen}
        onClose={() => setAddModuleOpen(false)}
        removedModules={removedModules}
        onAddBack={(modNum) => { addModuleBack(modNum); setAddModuleOpen(false); }}
      />

      {/* --- Confirm Removal Modal --- */}
      <Dialog open={!!confirmRemoval} onOpenChange={(v) => { if (!v) setConfirmRemoval(null); }}>
        <DialogContent data-testid="confirm-removal-dialog">
          <DialogHeader>
            <DialogTitle>
              {confirmRemoval?.kind === 'module' ? 'Remove this module?' : 'Remove this session?'}
            </DialogTitle>
            <DialogDescription>
              {confirmRemoval?.kind === 'module'
                ? `"${confirmRemoval?.title}" and its ${confirmRemoval?.sessionCount} session${confirmRemoval?.sessionCount === 1 ? '' : 's'} will be removed from your path. You can add it back from the "Add module" panel below.`
                : `This session will be dropped from your path. You can add it back later from the "Add session" panel.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmRemoval(null)}
              className="px-4 py-2 rounded-lg text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
              data-testid="confirm-removal-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmRemoval?.kind === 'module') removeModule(confirmRemoval.moduleNumber);
                setConfirmRemoval(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-bricolage text-white bg-[var(--color-error)] hover:brightness-110 transition-all flex items-center gap-1.5"
              data-testid="confirm-removal-confirm"
            >
              <Trash2 size={14} /> Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Reset Confirmation --- */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent data-testid="confirm-reset-dialog">
          <DialogHeader>
            <DialogTitle>Reset to the LLM suggestion?</DialogTitle>
            <DialogDescription>
              All of your manual edits (add/remove/reorder) will be undone and the LLM's original customized plan will be restored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-4 py-2 rounded-lg text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
              data-testid="confirm-reset-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={resetToLlm}
              className="px-4 py-2 rounded-lg text-sm font-bricolage text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] transition-all flex items-center gap-1.5"
              data-testid="confirm-reset-confirm"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


/* =========================== Sub-components =========================== */

function AddSessionDialog({ open, onClose, moduleNumber, courseStructure, removedSessionIds, addedSessionsByMod, onAddBack, onAddNew }) {
  const [tab, setTab] = useState('catalog'); // 'catalog' | 'custom'
  const [customTitle, setCustomTitle] = useState('');

  useEffect(() => { if (open) { setTab('catalog'); setCustomTitle(''); } }, [open]);

  const mod = courseStructure[(moduleNumber || 1) - 1];
  const removedMasters = (mod?.master_sessions || []).filter((s) => removedSessionIds.has(s.id));
  // Already-added AI sessions in this module — informational only.
  const aiAdded = (addedSessionsByMod[moduleNumber] || []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="add-session-dialog">
        <DialogHeader>
          <DialogTitle>Add a session to "{mod?.title}"</DialogTitle>
          <DialogDescription>
            Re-add a session from the original catalog, or write your own custom topic.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-3 border-b border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`px-3 py-2 text-sm font-bricolage transition-colors ${tab === 'catalog' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-px' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            data-testid="add-session-tab-catalog"
          >
            From catalog ({removedMasters.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('custom')}
            className={`px-3 py-2 text-sm font-bricolage transition-colors ${tab === 'custom' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-px' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            data-testid="add-session-tab-custom"
          >
            Write custom
          </button>
        </div>

        {tab === 'catalog' && (
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {removedMasters.length === 0 && (
              <div className="text-sm text-[var(--color-text-muted)] font-bricolage italic px-3 py-4 text-center">
                Every session from the original catalog is already in your path.
              </div>
            )}
            {removedMasters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onAddBack(s.id); onClose(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-colors text-left"
                data-testid={`add-session-catalog-${s.id}`}
              >
                <Plus size={13} className="text-[var(--color-primary)] shrink-0" />
                <span className="text-sm font-bricolage text-[var(--color-text)] flex-1 truncate">{s.title}</span>
              </button>
            ))}
            {aiAdded.length > 0 && (
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)] mt-3 mb-1">
                Already added in this module:
              </div>
            )}
            {aiAdded.map((c) => (
              <div key={c._localId || c.session_id} className="text-xs font-bricolage text-[var(--color-text-muted)] px-3 py-1.5 opacity-70">
                + {c.session_title}
              </div>
            ))}
          </div>
        )}

        {tab === 'custom' && (
          <div className="space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              Session title
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Building a 3-statement model for Reliance"
              className="w-full px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-bricolage text-sm outline-none focus:border-[var(--color-primary)]"
              data-testid="add-session-custom-input"
              maxLength={120}
            />
            <p className="text-[11px] text-[var(--color-text-faint)] font-bricolage">
              Custom sessions are marked as "new" and will be generated by AI when you start them.
            </p>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="add-session-cancel"
          >
            Cancel
          </button>
          {tab === 'custom' && (
            <button
              type="button"
              disabled={!customTitle.trim()}
              onClick={() => { onAddNew(customTitle.trim()); onClose(); }}
              className="px-4 py-2 rounded-lg text-sm font-bricolage text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              data-testid="add-session-custom-confirm"
            >
              <Plus size={13} /> Add session
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function AddModuleDialog({ open, onClose, removedModules, onAddBack }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="add-module-dialog">
        <DialogHeader>
          <DialogTitle>Add a module back</DialogTitle>
          <DialogDescription>
            These modules were removed from your customized path. Pick one to add it back — all of its master sessions will be re-included, and you can trim them after.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {removedModules.length === 0 && (
            <div className="text-sm text-[var(--color-text-muted)] font-bricolage italic px-3 py-4 text-center">
              Every module from the original catalog is already in your path.
            </div>
          )}
          {removedModules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => onAddBack(mod.moduleNumber)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-colors text-left"
              data-testid={`add-module-row-${mod.moduleNumber}`}
            >
              <span className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 flex items-center justify-center text-[10px] font-mono shrink-0">
                {String(mod.moduleNumber).padStart(2, '0')}
              </span>
              <span className="text-sm font-bricolage text-[var(--color-text)] flex-1">{mod.title}</span>
              <span className="text-xs font-mono text-[var(--color-text-faint)] shrink-0">
                {(mod.master_sessions || []).length} sessions
              </span>
              <Plus size={14} className="text-[var(--color-primary)] shrink-0" />
            </button>
          ))}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="add-module-cancel"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
