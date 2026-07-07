/**
 * Phase B.1 — Notes cards editor for the AdminPanel View Course tab.
 * Simple flat list with add / edit / delete / ↑↓ reorder. No drag lib.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Save, ChevronUp, ChevronDown, X as XIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const CARD_TYPES = ['hook', 'concept', 'deep-dive', 'example', 'formula', 'mistake', 'summary', 'visual', 'study-card'];

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

export default function NotesEditor({ sessionId, sessionTitle }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null); // { card_type, title, content }
  const [err, setErr] = useState(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const j = await req(`/api/admin/notes-cards?session_id=${sessionId}`);
      setCards(j.cards || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { reload(); }, [reload]);

  const addCard = async () => {
    try {
      const j = await req('/api/admin/notes-cards', 'POST', {
        session_id: sessionId, card_type: 'concept', title: 'Untitled card', content: '',
      });
      await reload();
      setEditingId(j.card.id);
      setDraft({ card_type: j.card.card_type, title: j.card.title, content: j.card.content });
    } catch (e) { alert(e.message); }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setDraft({ card_type: c.card_type, title: c.title || '', content: c.content || '' });
  };

  const saveEdit = async () => {
    try {
      await req(`/api/admin/notes-cards/${editingId}`, 'PATCH', draft);
      setEditingId(null); setDraft(null);
      await reload();
    } catch (e) { alert(e.message); }
  };

  const deleteCard = async (c) => {
    if (!window.confirm(`Delete card "${c.title || c.card_type}"?`)) return;
    try {
      await req(`/api/admin/notes-cards/${c.id}`, 'DELETE');
      if (editingId === c.id) { setEditingId(null); setDraft(null); }
      await reload();
    } catch (e) { alert(e.message); }
  };

  const move = async (idx, dir) => {
    const next = [...cards];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setCards(next);
    try {
      await req('/api/admin/notes-cards/reorder', 'POST', { ids: next.map((c) => c.id) });
      await reload();
    } catch (e) { alert(`Reorder failed: ${e.message}`); await reload(); }
  };

  if (!sessionId) return <p className="text-sm text-[var(--color-text-muted)]">Select a session on the left.</p>;
  if (err) return <p className="text-sm text-red-500">{err}</p>;

  return (
    <div className="flex flex-col h-full" data-testid="notes-editor">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Notes cards</p>
          <p className="text-sm text-[var(--color-text)] truncate" title={sessionTitle}>{sessionTitle}</p>
        </div>
        <button
          onClick={addCard}
          data-testid="add-notes-card"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110"
        >
          <Plus size={12} /> Add card
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">No cards yet — click Add card.</p>
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-2" data-testid="notes-cards-list">
          {cards.map((c, i) => {
            const isEditing = editingId === c.id;
            return (
              <li key={c.id} className="border border-[var(--color-border)] rounded-lg" data-testid={`notes-card-${c.order_index}`}>
                <div className="flex items-start gap-2 px-2 py-1.5">
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-30" data-testid={`notes-card-up-${c.id}`}><ChevronUp size={12} /></button>
                    <button onClick={() => move(i, +1)} disabled={i === cards.length - 1} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-30" data-testid={`notes-card-down-${c.id}`}><ChevronDown size={12} /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-[var(--color-primary)]/15 text-[var(--color-primary)] mr-1.5">
                      {c.card_type}
                    </span>
                    <span className="text-xs text-[var(--color-text)] truncate">{c.title || '(no title)'}</span>
                  </div>
                  {!isEditing ? (
                    <>
                      <button onClick={() => startEdit(c)} className="text-[10px] text-[var(--color-primary)] hover:underline" data-testid={`edit-notes-card-${c.id}`}>Edit</button>
                      <button onClick={() => deleteCard(c)} className="text-[var(--color-text-muted)] hover:text-red-500" data-testid={`delete-notes-card-${c.id}`}><Trash2 size={12} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={saveEdit} className="text-[10px] text-[var(--color-success)] hover:underline flex items-center gap-1" data-testid={`save-notes-card-${c.id}`}><Save size={10} /> Save</button>
                      <button onClick={() => { setEditingId(null); setDraft(null); }} className="text-[var(--color-text-muted)] hover:text-red-500"><XIcon size={12} /></button>
                    </>
                  )}
                </div>
                {isEditing && draft && (
                  <div className="border-t border-[var(--color-border)] p-2 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={draft.card_type}
                        onChange={(e) => setDraft({ ...draft, card_type: e.target.value })}
                        data-testid={`draft-card-type-${c.id}`}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                      >
                        {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        placeholder="Card title"
                        data-testid={`draft-title-${c.id}`}
                        className="flex-1 text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                      />
                    </div>
                    <textarea
                      value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                      rows={8}
                      placeholder="Markdown body…"
                      data-testid={`draft-content-${c.id}`}
                      className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-mono resize-y"
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
