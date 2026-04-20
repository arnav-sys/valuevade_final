import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LogOut, ArrowLeft, ArrowRight, Sun, Moon, Sparkles, Trash2, Plus, ArrowUpDown,
  CheckCircle2, AlertCircle, RefreshCw, Loader2, ChevronRight, Lock,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LOADING_STEPS = [
  'Analyzing your knowledge levels...',
  'Identifying gaps and opportunities...',
  'Optimizing your learning sequence...',
];

function ActionBadge({ action }) {
  const config = {
    remove_module: { label: 'Removed', icon: Trash2, cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
    remove_session: { label: 'Removed', icon: Trash2, cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
    add_session: { label: 'AI Added', icon: Plus, cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    reorder_module: { label: 'Reordered', icon: ArrowUpDown, cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  };
  const c = config[action] || config.remove_module;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${c.cls}`}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

export default function PreviewPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const stateData = location.state || {};
  const { answers = [], freeText = '', courseStructure = [], courseTitle = '' } = stateData;

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    setLoadingStep(0);

    // Animate loading steps
    const stepInterval = setInterval(() => {
      setLoadingStep((s) => {
        if (s < LOADING_STEPS.length - 1) return s + 1;
        return s;
      });
    }, 2500);

    try {
      const res = await fetch(`${API}/api/customize/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          free_text: freeText,
          course_structure: courseStructure,
          course_title: courseTitle,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      setPlan(data);
    } catch (err) {
      setError(err.message || 'Failed to generate customization plan');
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (answers.length === 0 && courseStructure.length === 0) {
      navigate(`/course/${courseId}/customize`, { replace: true });
      return;
    }
    generatePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build lookup maps from the plan
  const removedModuleNums = new Set(
    (plan?.customisation_plan || [])
      .filter((c) => c.action === 'remove_module')
      .map((c) => c.module_number)
  );

  const removedSessionIds = new Set(
    (plan?.customisation_plan || [])
      .filter((c) => c.action === 'remove_session')
      .map((c) => c.session_id)
  );

  const addedSessions = (plan?.customisation_plan || []).filter((c) => c.action === 'add_session');
  const reorderedModules = (plan?.customisation_plan || []).filter((c) => c.action === 'reorder_module');

  const getReasonForModule = (modNum) => {
    const change = (plan?.customisation_plan || []).find(
      (c) => c.action === 'remove_module' && c.module_number === modNum
    );
    return change?.reason;
  };

  const getReasonForSession = (sessId) => {
    const change = (plan?.customisation_plan || []).find(
      (c) => c.action === 'remove_session' && c.session_id === sessId
    );
    return change?.reason;
  };

  const getReorderInfo = (modNum) => {
    return reorderedModules.find((c) => c.module_number === modNum);
  };

  const handleAccept = () => {
    navigate(`/course/${courseId}/confirm`, {
      state: {
        plan,
        answers,
        freeText,
        courseStructure,
        courseTitle,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      <div className="absolute top-[-8%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]" data-testid="preview-header">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="preview-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all" data-testid="preview-theme-toggle">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {profile && <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block">{profile.full_name}</span>}
            <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage" data-testid="preview-signout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 sm:py-12 relative z-10">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24" data-testid="preview-loading">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-accent-purple)]/15 border border-[var(--color-primary)]/20 flex items-center justify-center mb-8">
              <Sparkles size={32} className="text-[var(--color-primary)] animate-pulse" />
            </div>

            <div className="space-y-4 text-center mb-8">
              {LOADING_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 transition-all duration-500 ${
                    i <= loadingStep ? 'opacity-100' : 'opacity-20'
                  }`}
                  data-testid={`loading-step-${i}`}
                >
                  {i < loadingStep ? (
                    <CheckCircle2 size={18} className="text-[var(--color-success)] shrink-0" />
                  ) : i === loadingStep ? (
                    <Loader2 size={18} className="text-[var(--color-primary)] animate-spin shrink-0" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full border border-[var(--color-border)] shrink-0" />
                  )}
                  <span className={`text-sm font-bricolage ${
                    i <= loadingStep ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'
                  }`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>

            <div className="w-48 h-1 rounded-full overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] transition-all duration-1000"
                style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center text-center py-16" data-testid="preview-error">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
              <AlertCircle size={28} className="text-[var(--color-error)]" />
            </div>
            <p className="text-[var(--color-text)] font-bricolage mb-2 font-semibold">AI generation failed</p>
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6 max-w-md">{error}</p>
            <div className="flex gap-3">
              <button onClick={generatePlan} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage" data-testid="preview-retry">
                <RefreshCw size={16} /> Try Again
              </button>
              <button
                onClick={() => navigate(`/course/${courseId}/customize`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                data-testid="preview-go-back"
              >
                <ArrowLeft size={16} /> Modify Answers
              </button>
            </div>
          </div>
        )}

        {/* Plan loaded */}
        {!loading && !error && plan && (
          <>
            {/* Summary */}
            <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8" data-testid="preview-summary">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-accent-purple)]/15 border border-[var(--color-primary)]/20 flex items-center justify-center">
                  <Sparkles size={20} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]">Your Personalized Plan</h2>
                  <p className="text-xs font-mono text-[var(--color-accent-purple)]">{courseTitle}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-5" data-testid="preview-profile-summary">
                {plan.user_profile_summary}
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-primary)]/8 text-[var(--color-primary)] border border-[var(--color-primary)]/10" data-testid="preview-stat-modules">
                  {plan.total_modules_final} modules
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-accent-purple)]/8 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/10" data-testid="preview-stat-sessions">
                  {plan.total_sessions_final} sessions
                </div>
                {(plan.customisation_plan || []).length > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-accent-pink)]/8 text-[var(--color-accent-pink)] border border-[var(--color-accent-pink)]/10" data-testid="preview-stat-changes">
                    {(plan.customisation_plan || []).length} customizations
                  </div>
                )}
              </div>
            </div>

            {/* Visual diff - course structure with changes */}
            <h3 className="font-clash text-lg font-bold text-[var(--color-text)] mb-4">Course Structure</h3>
            <div className="space-y-3 mb-8" data-testid="preview-diff">
              {courseStructure.map((mod, idx) => {
                const modNum = idx + 1;
                const isRemoved = removedModuleNums.has(modNum);
                const reorderInfo = getReorderInfo(modNum);
                const isLocked = (plan.locked_modules || []).includes(modNum);
                const sessions = mod.master_sessions || [];
                const addedForModule = addedSessions.filter((a) => a.module_number === modNum);

                return (
                  <div
                    key={mod.id}
                    className={`glass-card rounded-xl overflow-hidden transition-all ${
                      isRemoved ? 'opacity-60 border-red-500/20' : reorderInfo ? 'border-blue-500/20' : ''
                    }`}
                    data-testid={`preview-module-${modNum}`}
                  >
                    {/* Module header */}
                    <div className={`px-5 py-4 flex items-center gap-3 ${isRemoved ? 'bg-red-500/5' : ''}`}>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono shrink-0 ${
                        isRemoved
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                          : isLocked
                          ? 'bg-[var(--color-text-faint)]/10 text-[var(--color-text-faint)] border border-[var(--color-border)]'
                          : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20'
                      }`}>
                        {String(modNum).padStart(2, '0')}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold font-bricolage ${
                          isRemoved ? 'line-through text-[var(--color-text-faint)]' : 'text-[var(--color-text)]'
                        }`}>
                          {mod.title}
                        </p>
                        {isRemoved && (
                          <p className="text-[10px] text-red-400 font-bricolage mt-0.5">{getReasonForModule(modNum)}</p>
                        )}
                        {reorderInfo && (
                          <p className="text-[10px] text-blue-400 font-bricolage mt-0.5">{reorderInfo.reason}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isRemoved && <ActionBadge action="remove_module" />}
                        {reorderInfo && <ActionBadge action="reorder_module" />}
                        {isLocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-text-faint)]/10 text-[var(--color-text-faint)] border border-[var(--color-border)]">
                            <Lock size={10} /> Locked
                          </span>
                        )}
                        {!isRemoved && !isLocked && !reorderInfo && (
                          <span className="text-xs font-mono text-[var(--color-text-faint)]">{sessions.length} sessions</span>
                        )}
                      </div>
                    </div>

                    {/* Sessions (show only for non-removed modules that have session-level changes or added sessions) */}
                    {!isRemoved && (sessions.some((s) => removedSessionIds.has(s.id)) || addedForModule.length > 0) && (
                      <div className="px-5 pb-4 border-t border-[var(--color-border)]">
                        <div className="space-y-1 pt-3">
                          {sessions.map((sess) => {
                            const isSessRemoved = removedSessionIds.has(sess.id);
                            return (
                              <div key={sess.id} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg ${isSessRemoved ? 'bg-red-500/5' : ''}`}>
                                <ChevronRight size={12} className={isSessRemoved ? 'text-red-400' : 'text-[var(--color-text-faint)]'} />
                                <span className={`text-xs font-bricolage flex-1 ${
                                  isSessRemoved ? 'line-through text-[var(--color-text-faint)]' : 'text-[var(--color-text-secondary)]'
                                }`}>
                                  {sess.title}
                                </span>
                                {isSessRemoved && <ActionBadge action="remove_session" />}
                                {isSessRemoved && (
                                  <span className="text-[9px] text-red-400 font-bricolage max-w-[200px] truncate">{getReasonForSession(sess.id)}</span>
                                )}
                              </div>
                            );
                          })}
                          {addedForModule.map((added, i) => (
                            <div key={`added-${i}`} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg bg-emerald-500/5">
                              <Plus size={12} className="text-emerald-500" />
                              <span className="text-xs font-bricolage flex-1 text-emerald-600">{added.session_title}</span>
                              <ActionBadge action="add_session" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Conservative flags */}
            {(plan.conservative_flags || []).length > 0 && (
              <div className="glass-card rounded-xl p-5 mb-8" data-testid="preview-flags">
                <p className="text-xs font-mono text-[var(--color-accent-purple)] mb-2">CONSERVATIVE DECISIONS</p>
                <ul className="space-y-1">
                  {plan.conservative_flags.map((flag, i) => (
                    <li key={i} className="text-xs text-[var(--color-text-muted)] font-bricolage flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-purple)] mt-1.5 shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-4 pb-8" data-testid="preview-actions">
              <button
                onClick={() => navigate(`/course/${courseId}/customize`)}
                className="px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all flex items-center gap-2"
                data-testid="preview-modify-btn"
              >
                <ArrowLeft size={16} /> Go Back & Modify Answers
              </button>
              <button
                onClick={handleAccept}
                className="px-6 py-3 rounded-xl text-sm font-semibold font-bricolage bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all flex items-center gap-2"
                data-testid="preview-accept-btn"
              >
                Accept & Continue <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
