import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle, BookOpen, CheckCircle2, Circle, Loader2, MessageSquare,
  RefreshCw, Sparkles, Brain,
} from 'lucide-react';
import Sidebar from './Sidebar';
import AvatarPersona from './tutor/AvatarPersona';
import ExtendedPariChat from './tutor/ExtendedPariChat';
import { useOpenDoubts } from '../contexts/OpenDoubtsContext';
import {
  listSessionDoubts, resolveSessionDoubt, redoSessionDoubt,
} from '../utils/sessionDoubts';
import { setRedoState } from '../utils/redoState';

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
];

const REASON_LABELS = {
  doubt: { label: 'Doubt', color: 'var(--color-accent-purple)' },
  difficult: { label: 'Difficult', color: 'var(--color-accent-pink)' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function DoubtCard({ row, onRedo, onResolve, onAskPari, pendingId }) {
  const reason = REASON_LABELS[row.reason] || REASON_LABELS.doubt;
  const isResolved = row.status === 'resolved';
  const isPending = pendingId === row.id;
  return (
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 sm:p-5"
      data-testid={`doubt-card-${row.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.15em]"
              style={{
                color: reason.color,
                background: `${reason.color}15`,
                border: `1px solid ${reason.color}35`,
              }}
              data-testid={`doubt-reason-${row.id}`}
            >
              {reason.label}
            </span>
            {row.redo_count > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] border border-[var(--color-border)] bg-[var(--color-bg-card)]/40">
                Redone {row.redo_count}x
              </span>
            )}
            {isResolved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/30">
                <CheckCircle2 size={10} /> Resolved
              </span>
            )}
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
              {timeAgo(row.created_at)}
            </span>
          </div>
          <div className="font-clash text-base font-semibold text-[var(--color-text)] truncate" data-testid={`doubt-session-title-${row.id}`}>
            {row.session_title || 'Session'}
          </div>
          {row.module_title && (
            <div className="text-xs font-bricolage text-[var(--color-text-muted)] truncate flex items-center gap-1 mt-0.5">
              <BookOpen size={10} /> {row.module_title}
            </div>
          )}
        </div>
      </div>

      {!isResolved && (
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <button
            onClick={() => onAskPari(row)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent-purple)]/12 hover:bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] text-xs font-semibold font-bricolage transition-all disabled:opacity-50"
            data-testid={`doubt-ask-pari-${row.id}`}
          >
            <MessageSquare size={14} /> Ask Pari (15-turn chat)
          </button>
          <button
            onClick={() => onRedo(row)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary)]/12 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-xs font-semibold font-bricolage transition-all disabled:opacity-50"
            data-testid={`doubt-redo-${row.id}`}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Redo session (half XP)
          </button>
          <button
            onClick={() => onResolve(row)}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-success)]/12 hover:bg-[var(--color-success)]/20 border border-[var(--color-success)]/30 text-[var(--color-success)] text-xs font-semibold font-bricolage transition-all disabled:opacity-50"
            data-testid={`doubt-resolve-${row.id}`}
          >
            <CheckCircle2 size={14} /> Mark resolved
          </button>
        </div>
      )}
    </div>
  );
}

export default function DoubtsPage() {
  const navigate = useNavigate();
  const { refresh: refreshOpenCount } = useOpenDoubts();
  const [tab, setTab] = useState('open');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [chatDoubt, setChatDoubt] = useState(null);  // {id, session_title} for ExtendedPariChat

  const load = useCallback(async (status) => {
    setLoading(true);
    setError(null);
    try {
      const { ok, data } = await listSessionDoubts(status);
      if (!ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Failed to load doubts');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Failed to load doubts');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const onResolve = useCallback(async (row) => {
    setPendingId(row.id);
    try {
      const { ok, data } = await resolveSessionDoubt(row.id);
      if (!ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Resolve failed');
      toast.success('Doubt resolved');
      // Remove from open list optimistically
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      refreshOpenCount();
    } catch (e) {
      toast.error(e?.message || 'Could not resolve');
    } finally {
      setPendingId(null);
    }
  }, [refreshOpenCount]);

  const onRedo = useCallback(async (row) => {
    setPendingId(row.id);
    try {
      const { ok, data } = await redoSessionDoubt(row.id);
      if (!ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Redo failed');
      // Persist redo state so subsequent quiz/sim completions halve XP and
      // tag meta.redo_doubt_id + meta.redo_count.
      setRedoState({
        redo_doubt_id: row.id,
        redo_count: data.redo_count || 1,
        session_id: data.session_id,
      });
      toast.success('Half-XP redo started — opening session…');
      navigate(`/session/${data.session_id}/start`);
    } catch (e) {
      toast.error(e?.message || 'Could not start redo');
    } finally {
      setPendingId(null);
    }
  }, [navigate]);

  const onAskPari = useCallback((row) => {
    setChatDoubt({ id: row.id, session_title: row.session_title });
  }, []);

  const openCount = useMemo(() => rows.filter((r) => r.status === 'open').length, [rows]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto" data-testid="doubts-page">
          {/* Hero */}
          <section className="mb-8" data-testid="doubts-hero">
            <div className="flex items-start gap-4">
              <div className="hidden sm:block shrink-0">
                <AvatarPersona pose="explaining" size="md" position="inline" showSpeechBubble={false} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-3">
                  <Brain size={11} /> Your doubts
                </div>
                <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-2" data-testid="doubts-title">
                  Stuck somewhere? Let's fix it.
                </h1>
                <p className="text-sm sm:text-base font-bricolage text-[var(--color-text-muted)] max-w-2xl">
                  Sessions you flagged as confusing or difficult live here. Re-do the full session for half XP — or chat with Pari for up to 15 turns to untangle exactly what tripped you up.
                </p>
              </div>
            </div>
          </section>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6 border-b border-[var(--color-border)]" data-testid="doubts-tabs">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2.5 -mb-px border-b-2 font-bricolage text-sm font-semibold transition-all ${
                    active
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                  data-testid={`doubts-tab-${t.key}`}
                >
                  {t.label}
                  {t.key === 'open' && openCount > 0 && tab === 'open' && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-mono font-bold">
                      {openCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* List / states */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-[var(--color-text-muted)]" data-testid="doubts-loading">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading your doubts…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200 flex items-start gap-2" data-testid="doubts-error">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button onClick={() => load(tab)} className="text-xs underline shrink-0">Retry</button>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/40 p-8 sm:p-12 text-center" data-testid="doubts-empty">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] flex items-center justify-center mb-3">
                {tab === 'open' ? <Sparkles size={20} /> : <Circle size={20} />}
              </div>
              <h3 className="font-clash text-lg font-semibold text-[var(--color-text)] mb-1">
                {tab === 'open' ? 'No open doubts — you\'re flying.' : 'Nothing resolved yet.'}
              </h3>
              <p className="text-sm font-bricolage text-[var(--color-text-muted)] max-w-md mx-auto">
                {tab === 'open'
                  ? 'Finish a session and tap "Was this confusing?" if anything didn\'t land — it\'ll show up here for a clean re-do.'
                  : 'Once you mark a doubt resolved or finish a half-XP redo, it\'ll show up under this tab.'}
              </p>
            </div>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className="space-y-3" data-testid="doubts-list">
              {rows.map((row) => (
                <DoubtCard
                  key={row.id}
                  row={row}
                  onRedo={onRedo}
                  onResolve={onResolve}
                  onAskPari={onAskPari}
                  pendingId={pendingId}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <ExtendedPariChat
        open={!!chatDoubt}
        doubtId={chatDoubt?.id}
        sessionTitle={chatDoubt?.session_title}
        onClose={() => setChatDoubt(null)}
      />
    </div>
  );
}
