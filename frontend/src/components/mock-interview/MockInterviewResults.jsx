import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Sidebar from '../Sidebar';
import { Trophy, CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const VERDICT_META = {
  strong_pass: { icon: Trophy,       label: 'STRONG PASS', color: 'text-amber-400', bg: 'from-amber-500/30 to-amber-700/10', tag: '🎉' },
  pass:        { icon: CheckCircle,  label: 'PASS',        color: 'text-emerald-400', bg: 'from-emerald-500/30 to-emerald-700/10', tag: '✅' },
  marginal:    { icon: AlertCircle,  label: 'MARGINAL',    color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-700/10', tag: '🟡' },
  fail:        { icon: XCircle,      label: 'FAIL',        color: 'text-red-400',    bg: 'from-red-500/20 to-red-700/10', tag: '❌' },
};

function SimpleMarkdown({ text }) {
  if (!text) return null;
  // Minimal markdown, paragraphs + **bold**
  const html = text
    .split(/\n\n+/)
    .map(p => p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))
    .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return <div className="prose prose-invert max-w-none text-[var(--color-text)] space-y-3" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function MockInterviewResults() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/mock-interview/${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (r.ok) setData(await r.json());
    })();
  }, [id]);

  if (!data) return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-8 text-[var(--color-text-muted)]">Loading results…</main>
    </div>
  );

  const iv = data.interview;
  const meta = VERDICT_META[iv.verdict] || VERDICT_META.marginal;
  const Icon = meta.icon;

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto" data-testid="mi-results-page">
        <div className="max-w-3xl mx-auto">
          {/* Verdict hero */}
          <div className={`rounded-3xl p-8 mb-6 bg-gradient-to-br ${meta.bg} border border-[var(--color-border)]`}>
            <div className="text-5xl mb-2">{meta.tag}</div>
            <h1 className={`text-4xl font-bold ${meta.color} mb-2 font-bricolage`} data-testid="mi-verdict">
              {meta.label}
            </h1>
            <p className="text-2xl text-[var(--color-text)]">
              Final score: <strong data-testid="mi-final-score">{iv.final_score}</strong> / 100
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Completed {iv.completed_at ? new Date(iv.completed_at).toLocaleString('en-IN') : '—'} · attempt #{iv.attempt_number}
            </p>
          </div>

          {/* Per-round scores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" data-testid="mi-round-grid">
            {data.scores.map(s => (
              <div key={s.round} className="rounded-2xl p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Round {s.round}</p>
                <p className="text-lg font-semibold capitalize text-[var(--color-text)]">{s.round_name}</p>
                <p className="text-3xl font-bold text-[var(--color-accent)] mt-1">{s.score}</p>
                {s.strengths?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-emerald-400 mb-1">Strengths</p>
                    <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
                      {s.strengths.slice(0, 3).map((b, i) => <li key={i}>• {b}</li>)}
                    </ul>
                  </div>
                )}
                {s.gaps?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-amber-400 mb-1">Gaps</p>
                    <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
                      {s.gaps.slice(0, 3).map((b, i) => <li key={i}>• {b}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Feedback */}
          <div className="rounded-2xl p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] mb-6">
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3 font-bricolage">Personalized Feedback</h2>
            <SimpleMarkdown text={iv.feedback_md} />
          </div>

          {/* Transcript */}
          <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] mb-6">
            <button onClick={() => setTranscriptOpen(o => !o)}
              data-testid="mi-toggle-transcript"
              className="w-full flex items-center justify-between p-4 text-[var(--color-text)] font-medium">
              <span>Review transcript ({data.turns.length} turns)</span>
              {transcriptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {transcriptOpen && (
              <div className="px-4 pb-4 space-y-3">
                {data.turns.map((t, i) => (
                  <div key={i} className={`p-3 rounded-lg text-sm ${t.role === 'interviewer'
                    ? 'bg-[var(--color-bg-card-hover)]'
                    : 'bg-[var(--color-accent)]/10 ml-6'}`}>
                    <p className="text-xs uppercase text-[var(--color-text-muted)] mb-1">{t.role} · R{t.round}</p>
                    <p className="text-[var(--color-text)] whitespace-pre-wrap">{t.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Link to="/dashboard" className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-card-hover)]">← Back to dashboard</Link>
            <Link to="/mock-interview" data-testid="mi-restart"
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">Schedule another attempt</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
