/**
 * Phase B.2, Quiz items editor for the Admin Curriculum tab.
 * Flat list of quiz questions with 4 options each, correct-index selector,
 * explanation, difficulty. Add / edit / delete. Sequential order_index.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Save, X as XIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const DIFFICULTIES = ['easy', 'medium', 'hard'];

async function req(path, method = 'GET', body = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error((j && (j.detail || j.message)) || text || `${r.status}`);
  return j;
}

function normalizeOptions(opts) {
  const arr = Array.isArray(opts) ? opts.map((o) => (typeof o === 'string' ? o : o?.text || '')) : [];
  while (arr.length < 4) arr.push('');
  return arr.slice(0, 6);
}

export default function QuizEditor({ sessionId, sessionTitle }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const j = await req(`/api/admin/quiz-items?session_id=${sessionId}`);
      setItems(j.items || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { reload(); }, [reload]);

  const addItem = async () => {
    try {
      const j = await req('/api/admin/quiz-items', 'POST', {
        session_id: sessionId,
        question: 'New question?',
        options: ['', '', '', ''],
        correct_answer_index: 0,
        explanation: '',
        difficulty: 'medium',
      });
      await reload();
      startEdit(j.item);
    } catch (e) { alert(e.message); }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setDraft({
      question: it.question || '',
      options: normalizeOptions(it.options),
      correct_answer_index: Number.isFinite(it.correct_answer_index) ? it.correct_answer_index : 0,
      explanation: it.explanation || '',
      difficulty: it.difficulty || 'medium',
    });
  };

  const saveEdit = async () => {
    try {
      // Strip trailing empty options (keep at least 2)
      const opts = draft.options.filter((o, i) => i < 2 || (o || '').trim().length > 0);
      const payload = { ...draft, options: opts };
      if (payload.correct_answer_index >= opts.length) payload.correct_answer_index = 0;
      await req(`/api/admin/quiz-items/${editingId}`, 'PATCH', payload);
      setEditingId(null); setDraft(null);
      await reload();
    } catch (e) { alert(e.message); }
  };

  const deleteItem = async (it) => {
    if (!window.confirm(`Delete quiz question "${(it.question || '').slice(0, 40)}…"?`)) return;
    try {
      await req(`/api/admin/quiz-items/${it.id}`, 'DELETE');
      if (editingId === it.id) { setEditingId(null); setDraft(null); }
      await reload();
    } catch (e) { alert(e.message); }
  };

  const updateOption = (i, val) => {
    const next = [...draft.options];
    next[i] = val;
    setDraft({ ...draft, options: next });
  };
  const addOption = () => {
    if (draft.options.length >= 6) return;
    setDraft({ ...draft, options: [...draft.options, ''] });
  };
  const removeOption = (i) => {
    if (draft.options.length <= 2) return;
    const next = draft.options.filter((_, j) => j !== i);
    let cai = draft.correct_answer_index;
    if (cai === i) cai = 0; else if (cai > i) cai -= 1;
    setDraft({ ...draft, options: next, correct_answer_index: cai });
  };

  if (!sessionId) return <p className="text-sm text-[var(--color-text-muted)]">Select a session on the left.</p>;
  if (err) return <p className="text-sm text-red-500">{err}</p>;

  return (
    <div className="flex flex-col h-full" data-testid="quiz-editor">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Quiz items ({items.length})</p>
          <p className="text-sm text-[var(--color-text)] truncate" title={sessionTitle}>{sessionTitle}</p>
        </div>
        <button
          onClick={addItem}
          data-testid="add-quiz-item"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">No quiz questions yet, click Add.</p>
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-2" data-testid="quiz-items-list">
          {items.map((it) => {
            const isEditing = editingId === it.id;
            return (
              <li key={it.id} className="border border-[var(--color-border)] rounded-lg" data-testid={`quiz-item-${it.order_index}`}>
                <div className="flex items-start gap-2 px-2 py-1.5">
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-6 pt-1">Q{it.order_index}</span>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-[var(--color-primary)]/15 text-[var(--color-primary)] mr-1.5">
                      {it.difficulty || 'medium'}
                    </span>
                    <span className="text-xs text-[var(--color-text)] truncate">{it.question || '(no question)'}</span>
                  </div>
                  {!isEditing ? (
                    <>
                      <button onClick={() => startEdit(it)} className="text-[10px] text-[var(--color-primary)] hover:underline" data-testid={`edit-quiz-item-${it.id}`}>Edit</button>
                      <button onClick={() => deleteItem(it)} className="text-[var(--color-text-muted)] hover:text-red-500" data-testid={`delete-quiz-item-${it.id}`}><Trash2 size={12} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={saveEdit} className="text-[10px] text-[var(--color-success)] hover:underline flex items-center gap-1" data-testid={`save-quiz-item-${it.id}`}><Save size={10} /> Save</button>
                      <button onClick={() => { setEditingId(null); setDraft(null); }} className="text-[var(--color-text-muted)] hover:text-red-500"><XIcon size={12} /></button>
                    </>
                  )}
                </div>

                {isEditing && draft && (
                  <div className="border-t border-[var(--color-border)] p-2 space-y-2">
                    <textarea
                      value={draft.question}
                      onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                      rows={2}
                      placeholder="Question text"
                      data-testid={`draft-quiz-question-${it.id}`}
                      className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono">Difficulty</span>
                      <select
                        value={draft.difficulty}
                        onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
                        data-testid={`draft-quiz-difficulty-${it.id}`}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                      >
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono">Options (click ✓ for correct)</span>
                        {draft.options.length < 6 && (
                          <button onClick={addOption} className="text-[10px] text-[var(--color-primary)] hover:underline" data-testid={`add-option-${it.id}`}>+ option</button>
                        )}
                      </div>
                      {draft.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDraft({ ...draft, correct_answer_index: i })}
                            data-testid={`draft-quiz-correct-${it.id}-${i}`}
                            className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-mono border ${
                              draft.correct_answer_index === i
                                ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white'
                                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]'
                            }`}
                            title={draft.correct_answer_index === i ? 'Correct answer' : 'Mark as correct'}
                          >
                            {String.fromCharCode(65 + i)}
                          </button>
                          <input
                            value={opt}
                            onChange={(e) => updateOption(i, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                            data-testid={`draft-quiz-option-${it.id}-${i}`}
                            className="flex-1 text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                          />
                          {draft.options.length > 2 && (
                            <button onClick={() => removeOption(i)} className="text-[var(--color-text-muted)] hover:text-red-500" title="Remove option">
                              <XIcon size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <textarea
                      value={draft.explanation}
                      onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                      rows={3}
                      placeholder="Explanation (shown after student answers)"
                      data-testid={`draft-quiz-explanation-${it.id}`}
                      className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
