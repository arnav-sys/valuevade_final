import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/ui/skeleton';
import {
  LogOut, ArrowLeft, ArrowRight, Sun, Moon, CheckCircle2, AlertCircle, RefreshCw, Sparkles, MessageSquare,
} from 'lucide-react';

/* ────────────────────── Question Renderers ────────────────────── */

function SingleSelect({ question, value, onChange }) {
  const options = question.options || [];
  return (
    <div className="space-y-2.5" data-testid={`q-${question.id}-options`}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            value === opt.value
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8 shadow-[0_0_0_1px_var(--color-primary)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/30'
          }`}
          data-testid={`q-${question.id}-opt-${opt.value}`}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            value === opt.value ? 'border-[var(--color-primary)]' : 'border-[var(--color-text-faint)]'
          }`}>
            {value === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />}
          </div>
          <span className="text-sm font-bricolage text-[var(--color-text)]">{opt.label}</span>
          <input type="radio" name={question.id} value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} className="sr-only" />
        </label>
      ))}
    </div>
  );
}

function MultiSelect({ question, value = [], onChange }) {
  const options = question.options || [];
  const toggle = (v) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="space-y-2.5" data-testid={`q-${question.id}-options`}>
      {options.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              checked
                ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/8 shadow-[0_0_0_1px_var(--color-accent-purple)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent-purple)]/30'
            }`}
            data-testid={`q-${question.id}-opt-${opt.value}`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
              checked ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]' : 'border-[var(--color-text-faint)]'
            }`}>
              {checked && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </div>
            <span className="text-sm font-bricolage text-[var(--color-text)]">{opt.label}</span>
            <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)} className="sr-only" />
          </label>
        );
      })}
    </div>
  );
}

function SliderInput({ question, value, onChange }) {
  const opts = question.options || {};
  const min = opts.min ?? 0;
  const max = opts.max ?? 10;
  const step = opts.step ?? 1;
  const unit = opts.unit || '';
  const labels = opts.labels || {};
  const current = value ?? opts.default_value ?? min;
  const pct = ((current - min) / (max - min)) * 100;

  return (
    <div className="space-y-4" data-testid={`q-${question.id}-slider`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-clash font-bold text-[var(--color-primary)]">{current}{unit}</span>
      </div>
      <div className="relative">
        <div className="h-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)]" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          data-testid={`q-${question.id}-range`}
        />
      </div>
      {Object.keys(labels).length > 0 && (
        <div className="flex justify-between text-xs font-mono text-[var(--color-text-faint)]">
          {Object.entries(labels).sort(([a], [b]) => Number(a) - Number(b)).map(([pos, label]) => (
            <span key={pos}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingGrid({ question, value = {}, onChange }) {
  const opts = question.options || {};
  const scaleMin = opts.scale_min ?? 1;
  const scaleMax = opts.scale_max ?? 5;
  const scaleLabels = opts.scale_labels || {};
  const items = opts.items || [];
  const scale = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);

  const setRating = (key, rating) => onChange({ ...value, [key]: rating });

  return (
    <div className="space-y-1" data-testid={`q-${question.id}-grid`}>
      {/* Scale header */}
      <div className="flex items-end mb-3">
        <div className="flex-1" />
        <div className="flex gap-0" style={{ width: `${scale.length * 52}px` }}>
          {scale.map((n) => (
            <div key={n} className="w-[52px] text-center text-[10px] font-mono text-[var(--color-text-faint)]">
              {scaleLabels[String(n)] || n}
            </div>
          ))}
        </div>
      </div>
      {/* Rows */}
      {items.map((item) => (
        <div key={item.key} className="flex items-center py-2.5 border-b border-[var(--color-border)] last:border-b-0">
          <span className="flex-1 text-sm font-bricolage text-[var(--color-text)] pr-4">{item.label}</span>
          <div className="flex gap-0" style={{ width: `${scale.length * 52}px` }}>
            {scale.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(item.key, n)}
                className="w-[52px] flex items-center justify-center"
                data-testid={`q-${question.id}-${item.key}-${n}`}
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  value[item.key] === n
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white scale-110'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 text-[var(--color-text-faint)]'
                }`}>
                  <span className="text-xs font-mono">{n}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionRenderer({ question, value, onChange }) {
  switch (question.question_type) {
    case 'single_select': return <SingleSelect question={question} value={value} onChange={onChange} />;
    case 'multi_select': return <MultiSelect question={question} value={value} onChange={onChange} />;
    case 'slider': return <SliderInput question={question} value={value} onChange={onChange} />;
    case 'rating_grid': return <RatingGrid question={question} value={value} onChange={onChange} />;
    default: return <p className="text-sm text-[var(--color-text-muted)]">Unsupported question type: {question.question_type}</p>;
  }
}

/* ────────────────────── Main Page ────────────────────── */

export default function CustomizePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [questions, setQuestions] = useState([]);
  const [courseStructure, setCourseStructure] = useState([]);
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [answers, setAnswers] = useState({});
  const [freeText, setFreeText] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, mRes, pRes] = await Promise.all([
        supabase.from('master_customization_questions').select('*').eq('path_id', courseId).order('order_index'),
        supabase.from('master_modules').select('id, title, description, order_index, learning_objectives, prerequisite_knowledge, master_sessions(id, title, description, order_index, learning_objectives, prerequisite_knowledge)').eq('path_id', courseId).order('order_index'),
        supabase.from('master_paths').select('title').eq('id', courseId).single(),
      ]);
      if (qRes.error) throw qRes.error;
      if (mRes.error) throw mRes.error;
      setQuestions(qRes.data || []);
      const sorted = (mRes.data || []).map((m) => ({
        ...m,
        master_sessions: (m.master_sessions || []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
      }));
      setCourseStructure(sorted);
      setCourseTitle(pRes.data?.title || 'Course');
    } catch (err) {
      setError(err.message || 'Failed to load customization data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Group questions into steps of 3
  const questionSteps = useMemo(() => {
    if (questions.length === 0) return [];
    if (questions.length <= 3) return [questions];
    const steps = [];
    for (let i = 0; i < questions.length; i += 3) {
      steps.push(questions.slice(i, i + 3));
    }
    return steps;
  }, [questions]);

  // Total steps = question steps + free text step
  const totalSteps = questionSteps.length + 1;
  const isFreeTextStep = currentStep === questionSteps.length;
  const isLastStep = currentStep === totalSteps - 1;

  // Answer management
  const getAnswer = (qId) => answers[qId];
  const setAnswer = (qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }));

  // Build answers array for the AI
  const buildAnswersArray = () => {
    return questions.map((q) => ({
      question_id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      purpose: q.purpose,
      answer: answers[q.id] ?? null,
    }));
  };

  const handleNext = () => {
    if (isLastStep) {
      // Navigate to preview/AI step (Phase B)
      const answersArray = buildAnswersArray();
      navigate(`/course/${courseId}/preview`, {
        state: {
          answers: answersArray,
          freeText,
          courseStructure,
          courseTitle,
        },
      });
    } else {
      setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigate(`/course/${courseId}`);
    } else {
      setCurrentStep((s) => Math.max(s - 1, 0));
    }
  };

  // Check if current step has required answers
  const currentStepValid = useMemo(() => {
    if (isFreeTextStep) return true; // free text is optional
    const stepQuestions = questionSteps[currentStep] || [];
    return stepQuestions.every((q) => {
      const a = answers[q.id];
      if (q.question_type === 'rating_grid') {
        const items = q.options?.items || [];
        return items.length === 0 || (a && Object.keys(a).length === items.length);
      }
      if (q.question_type === 'multi_select') return Array.isArray(a) && a.length > 0;
      return a !== undefined && a !== null && a !== '';
    });
  }, [currentStep, isFreeTextStep, questionSteps, answers]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[5%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]" data-testid="customize-header">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="customize-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all" data-testid="customize-theme-toggle">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {profile && <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block" data-testid="customize-user-name">{profile.full_name}</span>}
            <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage" data-testid="customize-signout">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 sm:py-12 relative z-10">
        {/* Back link */}
        <button onClick={handleBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group" data-testid="customize-back">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {currentStep === 0 ? 'Back to Course' : 'Previous Step'}
        </button>

        {/* Loading */}
        {loading && (
          <div className="space-y-6" data-testid="customize-loading">
            <Skeleton className="h-8 w-2/3 bg-[var(--color-surface)]" />
            <Skeleton className="h-4 w-full bg-[var(--color-surface)]" />
            <Skeleton className="h-48 w-full rounded-xl bg-[var(--color-surface)]" />
            <Skeleton className="h-48 w-full rounded-xl bg-[var(--color-surface)]" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center text-center py-16" data-testid="customize-error">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
              <AlertCircle size={28} className="text-[var(--color-error)]" />
            </div>
            <p className="text-[var(--color-text)] font-bricolage mb-2">Failed to load questions</p>
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
            <button onClick={fetchData} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage" data-testid="customize-retry">
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Wizard */}
        {!loading && !error && (
          <>
            {/* Progress bar */}
            <div className="mb-8" data-testid="customize-progress">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[var(--color-text-faint)]">
                  Step {currentStep + 1} of {totalSteps}
                </span>
                <span className="text-xs font-mono text-[var(--color-accent-purple)]">
                  {courseTitle}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] transition-all duration-500"
                  style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                />
              </div>
              {/* Step dots */}
              <div className="flex items-center justify-center gap-2 mt-3">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentStep ? 'bg-[var(--color-primary)] scale-125' : i < currentStep ? 'bg-[var(--color-accent-purple)]' : 'bg-[var(--color-border)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question Steps */}
            {!isFreeTextStep && questionSteps[currentStep] && (
              <div className="space-y-8" data-testid={`customize-step-${currentStep}`}>
                {questionSteps[currentStep].map((q) => (
                  <div key={q.id} className="glass-card rounded-2xl p-6 sm:p-8" data-testid={`question-card-${q.id}`}>
                    <h3 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-1" data-testid={`question-text-${q.id}`}>
                      {q.question_text}
                    </h3>
                    {q.helper_text && (
                      <p className="text-xs text-[var(--color-text-muted)] font-bricolage mb-5">{q.helper_text}</p>
                    )}
                    {!q.helper_text && <div className="mb-5" />}
                    <QuestionRenderer question={q} value={getAnswer(q.id)} onChange={(val) => setAnswer(q.id, val)} />
                  </div>
                ))}
              </div>
            )}

            {/* Free Text Step */}
            {isFreeTextStep && (
              <div className="glass-card rounded-2xl p-6 sm:p-8" data-testid="customize-freetext-step">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent-pink)]/15 to-[var(--color-accent-purple)]/15 border border-[var(--color-accent-pink)]/20 flex items-center justify-center">
                    <MessageSquare size={20} className="text-[var(--color-accent-pink)]" />
                  </div>
                  <h3 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)]">
                    Anything else we should know?
                  </h3>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-5">
                  Tell us anything that would help us personalize your learning path. This is optional.
                </p>
                <div className="relative">
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value.slice(0, 1000))}
                    rows={5}
                    maxLength={1000}
                    placeholder="For example: I work at a brokerage and need to focus on Indian pharma sector analysis. I already know DCF well but struggle with relative valuation."
                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.1)] resize-none"
                    data-testid="customize-freetext-input"
                  />
                  <span className="absolute bottom-3 right-3 text-[10px] font-mono text-[var(--color-text-faint)]" data-testid="customize-freetext-count">
                    {freeText.length}/1000
                  </span>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 gap-4">
              <button
                onClick={handleBack}
                className="px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
                data-testid="customize-prev-btn"
              >
                <span className="flex items-center gap-2"><ArrowLeft size={16} /> Back</span>
              </button>

              <button
                onClick={handleNext}
                disabled={!isFreeTextStep && !currentStepValid}
                className={`px-6 py-3 rounded-xl text-sm font-semibold font-bricolage flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isLastStep
                    ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110'
                    : 'bg-[var(--color-primary)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)]'
                }`}
                data-testid="customize-next-btn"
              >
                {isLastStep ? (
                  <><Sparkles size={16} /> Generate My Personalized Path</>
                ) : (
                  <>Next <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
