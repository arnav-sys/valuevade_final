/**
 * Phase B.1, Notes cards editor for the AdminPanel View Course tab.
 * Top section: PDF/PPT file upload (renders as a document viewer for students).
 * Bottom section: Individual notes cards (hook / concept / formula / etc.).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Save, ChevronUp, ChevronDown, X as XIcon, Upload, FileText, AlertCircle, Loader2, Eye, CheckCircle2 } from 'lucide-react';

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

async function uploadFile(path, file) {
  const { data: { session } } = await supabase.auth.getSession();
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    body: form,
  });
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error((j && (j.detail || j.message)) || text || `${r.status}`);
  return j;
}

// ─── PDF/PPT File Upload Section ──────────────────────────────────────────
function NotesFileSection({ sessionId }) {
  const [fileInfo, setFileInfo] = useState(null); // { has_file, file_url, file_name, file_type }
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState(null);
  const [progress, setProgress] = useState(null);
  const inputRef = useRef(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const j = await req(`/api/admin/sessions/${sessionId}/notes-file`);
      setFileInfo(j);
    } catch (e) {
      setFileInfo({ has_file: false });
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { reload(); }, [reload]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'pptx', 'ppt'].includes(ext)) {
      setErr('Only PDF and PPT/PPTX files are supported.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErr('File too large. Maximum size is 50 MB.');
      return;
    }

    setErr(null);
    setUploading(true);
    setProgress('Uploading…');
    try {
      const result = await uploadFile(`/api/admin/sessions/${sessionId}/notes-file`, file);
      setFileInfo({ has_file: true, ...result });
      setProgress(null);
    } catch (e) {
      const msg = e.message || 'Upload failed';
      // Check for DB constraint violation on card_type
      if (msg.toLowerCase().includes('check') || msg.toLowerCase().includes('constraint') || msg.toLowerCase().includes('pdf_document')) {
        setErr('DB migration required, run 0040_notes_pdf_card_type.sql in Supabase Studio first (see /app/scripts/migrations/).');
      } else {
        setErr(msg);
      }
      setProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove the uploaded file "${fileInfo?.file_name}"? Students will see notes cards instead.`)) return;
    setDeleting(true);
    setErr(null);
    try {
      await req(`/api/admin/sessions/${sessionId}/notes-file`, 'DELETE');
      setFileInfo({ has_file: false });
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="mb-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      <Loader2 size={12} className="animate-spin" /> Loading file info…
    </div>
  );

  return (
    <div className="mb-4" data-testid="notes-file-section">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={13} className="text-[var(--color-primary)]" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">PDF / PPT Document</span>
        <span className="text-[9px] text-[var(--color-text-faint)] font-mono">(replaces card view for students)</span>
      </div>

      {fileInfo?.has_file ? (
        <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--color-primary)]/15 flex items-center justify-center flex-shrink-0">
            <FileText size={15} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[var(--color-text)] truncate">{fileInfo.file_name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                {fileInfo.file_type?.toUpperCase()}
              </span>
              <CheckCircle2 size={10} className="text-emerald-500" />
              <span className="text-[9px] text-emerald-600 font-mono">Active, students see this document</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href={fileInfo.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/10"
              data-testid="notes-file-preview-btn"
            >
              <Eye size={10} /> View
            </a>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading || deleting}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50"
              data-testid="notes-file-replace-btn"
            >
              <Upload size={10} /> Replace
            </button>
            <button
              onClick={handleDelete}
              disabled={uploading || deleting}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-500 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
              data-testid="notes-file-delete-btn"
            >
              {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
              {deleting ? '…' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/50 bg-[var(--color-surface)]/30 hover:bg-[var(--color-primary)]/5 transition-all p-4 flex flex-col items-center gap-2 cursor-pointer ${uploading ? 'opacity-60 cursor-wait' : ''}`}
          data-testid="notes-file-drop-zone"
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
              <span className="text-xs text-[var(--color-text-muted)]">{progress || 'Uploading…'}</span>
            </>
          ) : (
            <>
              <Upload size={18} className="text-[var(--color-text-muted)]" />
              <span className="text-xs font-semibold text-[var(--color-text)]">Upload PDF or PPT/PPTX</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">Max 50 MB · Replaces card-based notes for students</span>
            </>
          )}
        </div>
      )}

      {err && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-500" data-testid="notes-file-error">
          <AlertCircle size={11} /> {err}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.pptx,.ppt,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={handleFileChange}
        className="hidden"
        data-testid="notes-file-input"
      />
    </div>
  );
}


// ─── Notes Cards Editor ────────────────────────────────────────────────────
export default function NotesEditor({ sessionId, sessionTitle }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const j = await req(`/api/admin/notes-cards?session_id=${sessionId}`);
      // Filter out pdf_document cards, they're managed by the file section above
      setCards((j.cards || []).filter((c) => c.card_type !== 'pdf_document'));
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
      {/* PDF/PPT file upload section */}
      <NotesFileSection sessionId={sessionId} />

      <div className="border-t border-[var(--color-border)] pt-3 flex items-center justify-between mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Notes cards</p>
          <p className="text-[10px] text-[var(--color-text-faint)]">Optional, shown if no PDF/PPT is uploaded</p>
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
        <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">No cards yet, click Add card.</p>
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
