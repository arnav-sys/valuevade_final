/**
 * Admin "Courses" tab — edit a course's title, and a quick flat view of
 * every session in that course to toggle Preview / Free Trial (max 2 each)
 * without digging through the full module tree in the Curriculum tab.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Pencil, Check, X as XIcon, Eye, Unlock, Loader2, FolderOpen, PlayCircle } from 'lucide-react';

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

function PreviewSessionsModal({ course, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const j = await req(`/api/admin/courses/${course.id}/preview-sessions`);
      setSessions(j.sessions || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [course.id]);

  const toggleFlag = async (s, flag) => {
    const newVal = !s[flag];
    setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, [flag]: newVal } : x));
    try {
      await req(`/api/admin/sessions/${s.id}/flags`, 'PATCH', { [flag]: newVal });
    } catch (e) {
      setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, [flag]: !newVal } : x));
      alert(e.message);
    }
  };

  const previewCount = sessions.filter((s) => s.is_preview_session).length;
  const freeCount = sessions.filter((s) => s.is_free_session).length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" data-testid="preview-sessions-modal">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">{course.title}</h3>
            <p className="text-xs text-[var(--color-text-muted)] font-mono mt-1">
              <Eye size={10} className="inline mr-1" /> {previewCount}/2 preview · <Unlock size={10} className="inline mr-1" /> {freeCount}/2 free trial
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="preview-sessions-modal-close">
            <XIcon size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin" size={20} /></div>
          ) : err ? (
            <p className="text-sm text-red-400 p-4">{err}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] p-4">No sessions found for this course.</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] last:border-0"
                data-testid={`course-session-row-${s.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text)] truncate">{s.title}</p>
                  <p className="text-[10px] text-[var(--color-text-faint)] font-mono truncate">{s.module_title}</p>
                </div>
                {s.has_video && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-mono">video</span>}
                <button
                  onClick={() => toggleFlag(s, 'is_preview_session')}
                  title={s.is_preview_session ? 'Remove preview' : 'Mark as preview (video play button on course page)'}
                  data-testid={`course-preview-toggle-${s.id}`}
                  className={`flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded transition-all ${
                    s.is_preview_session
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-[var(--color-text-faint)] hover:text-blue-400 opacity-40 hover:opacity-100'
                  }`}
                >
                  <Eye size={9} /> preview
                </button>
                <button
                  onClick={() => toggleFlag(s, 'is_free_session')}
                  title={s.is_free_session ? 'Remove free access' : 'Mark as free trial (guest can access full session)'}
                  data-testid={`course-free-toggle-${s.id}`}
                  className={`flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded transition-all ${
                    s.is_free_session
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-[var(--color-text-faint)] hover:text-emerald-400 opacity-40 hover:opacity-100'
                  }`}
                >
                  <Unlock size={9} /> free
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoursesTab() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalCourse, setModalCourse] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const j = await req('/api/admin/courses');
      setCourses(j.courses || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (c) => { setEditingId(c.id); setDraftTitle(c.title || ''); };
  const cancelEdit = () => { setEditingId(null); setDraftTitle(''); };

  const saveTitle = async (c) => {
    const title = draftTitle.trim();
    if (!title) { alert('Title cannot be empty.'); return; }
    setSaving(true);
    try {
      await req(`/api/admin/courses/${c.id}`, 'PATCH', { title });
      setCourses((prev) => prev.map((x) => x.id === c.id ? { ...x, title } : x));
      setEditingId(null);
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" size={24} /></div>;
  if (err) return <p className="text-sm text-red-400 p-4">{err}</p>;

  return (
    <div data-testid="courses-tab" className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">Edit course titles and manage which sessions are marked Preview or Free Trial.</p>
      {courses.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-4"
          data-testid={`course-card-${c.id}`}
        >
          <FolderOpen size={20} className="text-[var(--color-primary)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {editingId === c.id ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveTitle(c)}
                  className="flex-1 text-sm bg-transparent border-b border-[var(--color-primary)] outline-none px-1 py-0.5"
                  data-testid={`course-title-input-${c.id}`}
                />
                <button onClick={() => saveTitle(c)} disabled={saving} data-testid={`course-title-save-${c.id}`}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40">
                  <Check size={16} />
                </button>
                <button onClick={cancelEdit} data-testid={`course-title-cancel-${c.id}`}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  <XIcon size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--color-text)] truncate" data-testid={`course-title-${c.id}`}>{c.title}</p>
                <button onClick={() => startEdit(c)} data-testid={`course-title-edit-${c.id}`}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                  <Pencil size={13} />
                </button>
              </div>
            )}
            {c.description && <p className="text-xs text-[var(--color-text-faint)] truncate mt-0.5">{c.description}</p>}
          </div>
          <button
            onClick={() => setModalCourse(c)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors flex-shrink-0"
            data-testid={`course-manage-sessions-${c.id}`}
          >
            <PlayCircle size={13} /> Preview & Free Sessions
          </button>
        </div>
      ))}
      {modalCourse && <PreviewSessionsModal course={modalCourse} onClose={() => setModalCourse(null)} />}
    </div>
  );
}
