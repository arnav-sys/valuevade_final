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

// CustomizePage is intentionally a thin redirect now. The product decision was
// made to skip the question/LLM customisation flow and enroll users into the
// full master path 1:1. Anyone landing here from a stale link bounces back to
// the course details page and clicks "Enroll" from there.
export default function CustomizePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/course/${courseId}`, { replace: true });
  }, [courseId, navigate]);
  return null;
}
