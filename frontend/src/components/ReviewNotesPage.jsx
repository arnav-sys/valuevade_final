import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Library, Search, BookOpen, Clock, MessageCircleQuestion,
  ChevronDown, ChevronUp, Sparkles, ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import AvatarPersona from './tutor/AvatarPersona';
import { TUTOR_NAME } from '../contexts/TutorContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const PHASE_FILTERS = [
  { value: null, label: 'All' },
  { value: 'notes', label: 'Notes' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'interview', label: 'Interview' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'dashboard', label: 'Dashboard' },
];

function timeAgo(iso) {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    const now = new Date();
    const ms = now - dt;
    const secs = Math.round(ms / 1000);
    const mins = Math.round(secs / 60);
    const hours = Math.round(mins / 60);
    const days = Math.round(hours / 24);
    if (secs < 60) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function PhaseChip({ phase }) {
  const colors = {
    notes: { fg: '#FF6AC1', bg: 'rgba(255,106,193,0.12)', bd: 'rgba(255,106,193,0.35)' },
    quiz: { fg: '#246BFD', bg: 'rgba(36,107,253,0.12)', bd: 'rgba(36,107,253,0.35)' },
    interview: { fg: '#6A5CFF', bg: 'rgba(106,92,255,0.12)', bd: 'rgba(106,92,255,0.35)' },
    simulation: { fg: '#10B981', bg: 'rgba(16,185,129,0.12)', bd: 'rgba(16,185,129,0.35)' },
    dashboard: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.35)' },
  };
  const c = colors[phase] || { fg: 'var(--color-text-muted)', bg: 'var(--glass-bg)', bd: 'var(--glass-border)' };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] font-semibold"
      style={{ color: c.fg, background: c.bg, border: `1px solid ${c.bd}` }}
    >
      {phase || 'session'}
    </span>
  );
}

function ReviewCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = (item.pari_answer || '').length > 240;
  const preview = useMemo(() => {
    if (!truncated || expanded) return item.pari_answer || '';
    return (item.pari_answer || '').slice(0, 240).trimEnd() + '…';
  }, [item.pari_answer, truncated, expanded]);

  return (
    <article
      className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4 sm:p-5"
      data-testid={`review-card-${item.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <PhaseChip phase={item.phase} />
        {item.module_code && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--color-text-muted)] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em]">
            {item.module_code}
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] flex items-center gap-1">
          <Clock size={10} /> {timeAgo(item.created_at)}
        </span>
      </div>
      <h3 className="font-clash text-base sm:text-lg font-bold text-[var(--color-text)] leading-snug mb-3">
        {item.topic || 'Untitled topic'}
      </h3>
      {item.user_question && (
        <div className="mb-3 text-xs sm:text-sm">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1">
            Your question
          </div>
          <p className="italic text-[var(--color-text-muted)] font-bricolage leading-relaxed">
            "{item.user_question}"
          </p>
        </div>
      )}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-primary)] mb-1.5 flex items-center gap-1.5">
          <Sparkles size={11} /> {TUTOR_NAME} said
        </div>
        <p className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed whitespace-pre-line">
          {preview}
        </p>
        {truncated && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline font-semibold"
            data-testid={`review-expand-${item.id}`}
          >
            {expanded ? (<>Show less <ChevronUp size={12} /></>) : (<>Read more <ChevronDown size={12} /></>)}
          </button>
        )}
      </div>
    </article>
  );
}

export default function ReviewNotesPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total_count: 0, unique_topics: 0, most_recent_at: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('Please sign in.'); return; }
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (phaseFilter) params.set('phase', phaseFilter);
      if (moduleFilter) params.set('module_code', moduleFilter);
      const res = await fetch(`${BACKEND}/api/portfolio/review_notes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.detail || 'Could not load review notes');
      } else {
        setItems(json.items || []);
        setStats({
          total_count: json.total_count || 0,
          unique_topics: json.unique_topics || 0,
          most_recent_at: json.most_recent_at,
        });
      }
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [phaseFilter, moduleFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const enrolledModules = useMemo(() => {
    const set = new Set();
    items.forEach((i) => { if (i.module_code) set.add(i.module_code); });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((i) =>
      (i.topic || '').toLowerCase().includes(q)
      || (i.user_question || '').toLowerCase().includes(q)
      || (i.pari_answer || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]" data-testid="review-notes-page">
      <Sidebar />
      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 space-y-8">

          {/* Hero */}
          <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center gap-5" data-testid="review-notes-hero">
            <AvatarPersona
              pose="encouraging"
              size="md"
              position="inline"
              showSpeechBubble={false}
              ariaLabel={TUTOR_NAME}
            />
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-primary)] mb-2">
                <Library size={11} /> {TUTOR_NAME}'s study cabinet
              </div>
              <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] leading-tight mb-1">
                {TUTOR_NAME}'s Review Notes
              </h1>
              <p className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed">
                Every concept {TUTOR_NAME} helped you with — your personal study cabinet.
              </p>
            </div>
          </section>

          {/* Stats strip */}
          <section className="grid grid-cols-3 gap-3" data-testid="review-stats-strip">
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
                <MessageCircleQuestion size={11} /> Answers
              </div>
              <div className="font-clash text-2xl font-bold text-[var(--color-text)]">{stats.total_count}</div>
            </div>
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
                <BookOpen size={11} /> Unique topics
              </div>
              <div className="font-clash text-2xl font-bold text-[var(--color-text)]">{stats.unique_topics}</div>
            </div>
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
                <Clock size={11} /> Most recent
              </div>
              <div className="font-clash text-lg font-bold text-[var(--color-text)]">
                {stats.most_recent_at ? timeAgo(stats.most_recent_at) : '—'}
              </div>
            </div>
          </section>

          {/* Filter chips + module dropdown + search */}
          <section className="space-y-3" data-testid="review-filters">
            <div className="flex flex-wrap items-center gap-2">
              {PHASE_FILTERS.map((f) => {
                const active = phaseFilter === f.value;
                return (
                  <button
                    key={f.label}
                    onClick={() => setPhaseFilter(f.value)}
                    data-testid={`review-filter-${f.value || 'all'}`}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold font-bricolage transition-colors border ${
                      active
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {enrolledModules.length > 0 && (
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  data-testid="review-module-filter"
                  className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur text-[var(--color-text)] px-3 py-2 text-sm font-bricolage focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">All modules</option>
                  {enrolledModules.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search topics, questions, or ${TUTOR_NAME}'s answers...`}
                  data-testid="review-search-input"
                  className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur text-[var(--color-text)] pl-9 pr-3 py-2 text-sm font-bricolage placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
          </section>

          {/* List */}
          <section className="space-y-3" data-testid="review-list">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-[var(--glass-bg)] animate-pulse" />
              ))
            ) : error ? (
              <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200" data-testid="review-error">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5" data-testid="review-empty">
                <AvatarPersona
                  pose="listening"
                  size="md"
                  position="inline"
                  showSpeechBubble={false}
                  ariaLabel={TUTOR_NAME}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-clash text-xl font-bold text-[var(--color-text)] mb-2">
                    {stats.total_count === 0 ? 'No review notes yet' : 'No matches for your filters'}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-4">
                    {stats.total_count === 0
                      ? `Ask me anything during a session and I'll save my answer here for you to revisit.`
                      : 'Try clearing a filter or adjusting your search.'}
                  </p>
                  {stats.total_count === 0 && (
                    <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] hover:brightness-110 text-white px-4 py-2 text-sm font-semibold font-bricolage" data-testid="review-empty-cta">
                      Go to dashboard <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              filtered.map((item) => <ReviewCard key={item.id} item={item} />)
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
