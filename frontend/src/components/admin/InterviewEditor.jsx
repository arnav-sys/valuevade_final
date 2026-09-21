/**
 * Phase B.2, Interview questions editor for the Admin Curriculum tab.
 * Flat list, question, context, sample_strong_answer, evaluation_criteria
 * (JSON blob). No LLM eval logic here; just content authoring.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Save, X as XIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

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

export default function InterviewEditor({ sessionId, sessionTitle }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [criteriaText, setCriteriaText] = useState('');
  const [criteriaErr, setCriteriaErr] = useState(null);
  const [err, setErr] = useState(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const j = await req(`/api/admin/interview-questions?session_id=${sessionId}`);
      setItems(j.items || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { reload(); }, [reload]);

  const addItem = async () => {
    try {
      const j = await req('/api/admin/interview-questions', 'POST', {
        session_id: sessionId,
        question: 'New interview question?',
        context: '',
        sample_strong_answer: '',
        evaluation_criteria: {},
      });
      await reload();
      startEdit(j.item);
    } catch (e) { alert(e.message); }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setDraft({
      question: it.question || '',
      context: it.context || '',
      sample_strong_answer: it.sample_strong_answer || '',
    });
    const crit = it.evaluation_criteria;
    setCriteriaText(crit ? JSON.stringify(crit, null, 2) : '{}');
    setCriteriaErr(null);
  };

  const saveEdit = async () => {
    let parsedCriteria;
    try {
      parsedCriteria = criteriaText.trim() ? JSON.parse(criteriaText) : {};
    } catch (e) {
      setCriteriaErr(`Invalid JSON: ${e.message}`);
      return;
    }
    try {
      await req(`/api/admin/interview-questions/${editingId}`, 'PATCH', {
        ...draft,
        evaluation_criteria: parsedCriteria,
      });
      setEditingId(null); setDraft(null); setCriteriaText(''); setCriteriaErr(null);
      await reload();
    } catch (e) { alert(e.message); }
  };

  const deleteItem = async (it) => {
    if (!window.confirm(`Delete interview question "${(it.question || '').slice(0, 40)}…"?`)) return;
    try {
      await req(`/api/admin/interview-questions/${it.id}`, 'DELETE');
      if (editingId === it.id) { setEditingId(null); setDraft(null); }
      await reload();
    } catch (e) { alert(e.message); }
  };

  if (!sessionId) return <p className="text-sm text-[var(--color-text-muted)]">Select a session on the left.</p>;
  if (err) return <p className="text-sm text-red-500">{err}</p>;

  return (
    <div className="flex flex-col h-full" data-testid="interview-editor">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Interview questions ({items.length})</p>
          <p className="text-sm text-[var(--color-text)] truncate" title={sessionTitle}>{sessionTitle}</p>
        </div>
        <button
          onClick={addItem}
          data-testid="add-interview-item"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">No interview questions yet, click Add.</p>
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-2" data-testid="interview-items-list">
          {items.map((it) => {
            const isEditing = editingId === it.id;
            return (
              <li key={it.id} className="border border-[var(--color-border)] rounded-lg" data-testid={`interview-item-${it.order_index}`}>
                <div className="flex items-start gap-2 px-2 py-1.5">
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-6 pt-1">IQ{it.order_index}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--color-text)] truncate block">{it.question || '(no question)'}</span>
                    {it.context && <span className="text-[10px] text-[var(--color-text-muted)] truncate block">{it.context}</span>}
                  </div>
                  {!isEditing ? (
                    <>
                      <button onClick={() => startEdit(it)} className="text-[10px] text-[var(--color-primary)] hover:underline" data-testid={`edit-interview-item-${it.id}`}>Edit</button>
                      <button onClick={() => deleteItem(it)} className="text-[var(--color-text-muted)] hover:text-red-500" data-testid={`delete-interview-item-${it.id}`}><Trash2 size={12} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={saveEdit} className="text-[10px] text-[var(--color-success)] hover:underline flex items-center gap-1" data-testid={`save-interview-item-${it.id}`}><Save size={10} /> Save</button>
                      <button onClick={() => { setEditingId(null); setDraft(null); }} className="text-[var(--color-text-muted)] hover:text-red-500"><XIcon size={12} /></button>
                    </>
                  )}
                </div>
                {isEditing && draft && (
                  <div className="border-t border-[var(--color-border)] p-2 space-y-2">
                    <div>
                      <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono mb-1">Question</p>
                      <textarea
                        value={draft.question}
                        onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                        rows={2}
                        data-testid={`draft-iq-question-${it.id}`}
                        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono mb-1">Context / Setup</p>
                      <textarea
                        value={draft.context}
                        onChange={(e) => setDraft({ ...draft, context: e.target.value })}
                        rows={2}
                        placeholder="Optional context shown to student before the question"
                        data-testid={`draft-iq-context-${it.id}`}
                        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono mb-1">Sample strong answer</p>
                      <textarea
                        value={draft.sample_strong_answer}
                        onChange={(e) => setDraft({ ...draft, sample_strong_answer: e.target.value })}
                        rows={5}
                        placeholder="Model answer shown after student submits"
                        data-testid={`draft-iq-sample-${it.id}`}
                        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono mb-1">
                        Evaluation criteria (JSON, level, trap, power_phrase, framework_bullets…)
                      </p>
                      <textarea
                        value={criteriaText}
                        onChange={(e) => { setCriteriaText(e.target.value); setCriteriaErr(null); }}
                        rows={7}
                        placeholder='{"level":"...", "framework_bullets":["..."]}'
                        data-testid={`draft-iq-criteria-${it.id}`}
                        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-mono resize-y"
                      />
                      {criteriaErr && <p className="text-[10px] text-red-500 mt-1">{criteriaErr}</p>}
                    </div>
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
