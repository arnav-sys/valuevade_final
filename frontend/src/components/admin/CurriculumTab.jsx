/**
 * Admin "View Course" tab — Phase A: modules + sessions CRUD.
 *
 * Layout: left rail (modules list + Add), middle (sessions for selected
 * module + Add), right placeholder for future notes/quiz/IQ editors.
 *
 * Phase B (notes/quiz/IQ editors) and Phase C (capstones/projects) are
 * queued for a follow-up.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import NotesEditor from './NotesEditor';
import QuizEditor from './QuizEditor';
import InterviewEditor from './InterviewEditor';
import VideoEditor from './VideoEditor';
import CapstonesEditor from './CapstonesEditor';
import ModuleProjectModal from './ModuleProjectModal';
import { Plus, Trash2, Pencil, AlertTriangle, Folder, Download, Mic, ChevronUp, ChevronDown, Eye, Unlock } from 'lucide-react';

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

export default function CurriculumTab() {
  const [pathId, setPathId] = useState(null);
  const [modules, setModules] = useState([]);
  const [sel, setSel] = useState(null);          // selected module row
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [editingMod, setEditingMod] = useState(null);  // module_id being renamed
  const [editingSess, setEditingSess] = useState(null);
  const [selSession, setSelSession] = useState(null);  // Phase B — currently-open session
  const [activeTab, setActiveTab] = useState('notes'); // notes | quiz | interview | video
  const [viewMode, setViewMode] = useState('modules'); // 'modules' | 'capstones'
  const [projModule, setProjModule] = useState(null);  // { id, title } when the modal is open
  const [confirm, setConfirm] = useState(null);        // { kind, id, name, impact? }

  const reloadModules = async () => {
    try {
      const j = await req('/api/admin/curriculum/modules');
      setPathId(j.path_id);
      setModules(j.modules || []);
      if (!sel && j.modules?.length) setSel(j.modules[0]);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const reloadSessions = async (mid) => {
    try {
      const j = await req(`/api/admin/curriculum/sessions?module_id=${mid}`);
      setSessions(j.sessions || []);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { reloadModules(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (sel?.id) reloadSessions(sel.id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sel?.id]);

  const addModule = async () => {
    const title = window.prompt('Module title?');
    if (!title || !pathId) return;
    try {
      const j = await req('/api/admin/modules', 'POST', { path_id: pathId, title });
      await reloadModules();
      setSel(j.module);
    } catch (e) { alert(`Failed: ${e.message}`); }
  };

  const saveModuleTitle = async (id, title) => {
    try {
      await req(`/api/admin/modules/${id}`, 'PATCH', { title });
      setEditingMod(null);
      await reloadModules();
    } catch (e) { alert(`Rename failed: ${e.message}`); }
  };

  const toggleInterviewModule = async (m) => {
    const next = !m.is_interview_module;
    const msg = next
      ? `Mark "${m.title}" as a MOCK INTERVIEW module?\n\nIts sessions become video+notes only (quizzes/simulations hidden) and the module ends with the 5 full interview simulations.`
      : `Remove the MOCK INTERVIEW flag from "${m.title}"?\n\nIts sessions revert to the normal notes → quiz → simulation flow.`;
    if (!window.confirm(msg)) return;
    try {
      await req(`/api/admin/modules/${m.id}`, 'PATCH', { is_interview_module: next });
      await reloadModules();
    } catch (e) { alert(`Failed: ${e.message}`); }
  };

  const askDeleteModule = async (m) => {
    try {
      const impact = await req(`/api/admin/modules/${m.id}/impact`);
      setConfirm({ kind: 'module', id: m.id, name: m.title, impact });
    } catch (e) { alert(e.message); }
  };

  const doDelete = async () => {
    const c = confirm;
    setConfirm(null);
    try {
      if (c.kind === 'module') {
        await req(`/api/admin/modules/${c.id}`, 'DELETE');
        if (sel?.id === c.id) setSel(null);
        await reloadModules();
      } else if (c.kind === 'session') {
        await req(`/api/admin/sessions/${c.id}`, 'DELETE');
        if (selSession?.id === c.id) setSelSession(null);
        await reloadSessions(sel.id);
        await reloadModules();
      }
    } catch (e) { alert(`Delete failed: ${e.message}`); }
  };

  const addSession = async () => {
    if (!sel?.id) return;
    const title = window.prompt('Session title?');
    if (!title) return;
    try {
      await req('/api/admin/sessions', 'POST', { module_id: sel.id, title });
      await reloadSessions(sel.id);
      await reloadModules();
    } catch (e) { alert(`Failed: ${e.message}`); }
  };

  const saveSessionTitle = async (id, title) => {
    try {
      await req(`/api/admin/sessions/${id}`, 'PATCH', { title });
      setEditingSess(null);
      await reloadSessions(sel.id);
    } catch (e) { alert(`Rename failed: ${e.message}`); }
  };

  const askDeleteSession = (s) => {
    setConfirm({ kind: 'session', id: s.id, name: s.title });
  };

  const toggleFlag = async (e, s, flag) => {
    e.stopPropagation();
    const newVal = !s[flag];
    // Optimistic update
    setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, [flag]: newVal } : x));
    try {
      await req(`/api/admin/sessions/${s.id}/flags`, 'PATCH', { [flag]: newVal });
    } catch (err) {
      // Revert on failure (e.g. max-2 exceeded)
      setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, [flag]: !newVal } : x));
      alert(err.message);
    }
  };

  const moveSession = async (s, dir) => {
    const idx = sessions.findIndex((x) => x.id === s.id);
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sessions.length) return;
    const target = sessions[targetIdx];
    try {
      // Swap via a transient sentinel so no two sessions ever share an order_index mid-swap.
      await req(`/api/admin/sessions/${target.id}`, 'PATCH', { order_index: -1 });
      await req(`/api/admin/sessions/${s.id}`, 'PATCH', { order_index: target.order_index });
      await req(`/api/admin/sessions/${target.id}`, 'PATCH', { order_index: s.order_index });
      await reloadSessions(sel.id);
    } catch (e) { alert(`Reorder failed: ${e.message}`); }
  };

  if (err) return <div className="p-4 text-red-500" data-testid="curriculum-error">{err}</div>;
  if (loading) return <div className="p-4 text-[var(--color-text-muted)]">Loading curriculum…</div>;

  return (
    <div className="flex flex-col gap-3" data-testid="curriculum-tab">
      {/* Top-level view toggle + full-curriculum download */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex gap-1 p-1 rounded-lg bg-[var(--color-surface)] w-fit" data-testid="curriculum-view-toggle">
        <button
          onClick={() => setViewMode('modules')}
          data-testid="view-mode-modules"
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            viewMode === 'modules' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Modules
        </button>
        <button
          onClick={() => setViewMode('capstones')}
          data-testid="view-mode-capstones"
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            viewMode === 'capstones' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Capstones
        </button>
      </div>
      <DownloadCurriculumButton />
    </div>

    {viewMode === 'capstones' && <CapstonesEditor />}
    {viewMode === 'modules' && (
    <div className="flex gap-4 h-[calc(100vh-320px)] min-h-[500px]">
      {/* Left rail — modules */}
      <div className="w-72 flex-shrink-0 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-text)]">Modules ({modules.length})</span>
          <button
            onClick={addModule}
            data-testid="add-module-button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto" data-testid="modules-list">
          {modules.map((m) => (
            <li
              key={m.id}
              className={`border-b border-[var(--color-border)] transition-colors ${
                sel?.id === m.id ? 'bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-surface)]'
              }`}
              data-testid={`module-row-${m.module_number || m.order_index}`}
            >
              <div className="flex items-start px-3 py-2 gap-2">
                <button onClick={() => setSel(m)} className="flex-1 text-left min-w-0">
                  <div className="text-xs text-[var(--color-text-muted)] font-mono">M{m.module_number || m.order_index}</div>
                  {editingMod === m.id ? (
                    <input
                      autoFocus defaultValue={m.title}
                      onBlur={(e) => saveModuleTitle(m.id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveModuleTitle(m.id, e.currentTarget.value)}
                      className="w-full text-sm bg-transparent border-b border-[var(--color-primary)] outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="text-sm text-[var(--color-text)] truncate">{m.title}</div>
                  )}
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{m.session_count} sessions</div>
                  {m.is_interview_module && (
                    <span
                      className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] text-[9px] font-mono uppercase tracking-wider"
                      data-testid={`interview-module-badge-${m.id}`}
                    >
                      <Mic size={9} /> Mock Interview
                    </span>
                  )}
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleInterviewModule(m); }}
                    title={m.is_interview_module ? 'Unmark mock interview module' : 'Mark as mock interview module'}
                    data-testid={`toggle-interview-module-${m.id}`}
                    className={m.is_interview_module ? 'text-[var(--color-accent-purple)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent-purple)]'}
                  >
                    <Mic size={11} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setProjModule({ id: m.id, title: m.title }); }}
                    title="Edit module project"
                    data-testid={`edit-project-${m.id}`}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-accent-purple)]"
                  >
                    <Folder size={11} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingMod(m.id); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" data-testid={`edit-module-${m.id}`}>
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); askDeleteModule(m); }}
                    title="Delete module"
                    data-testid={`delete-module-${m.id}`}
                    className="text-[var(--color-text-muted)] hover:text-red-500"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Middle — sessions */}
      <div className="flex-1 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          {sel ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase text-[var(--color-text-muted)]">M{sel.module_number} · Sessions</div>
                <div className="text-sm font-semibold text-[var(--color-text)]">{sel.title}</div>
              </div>
              <button
                onClick={addSession}
                data-testid="add-session-button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110"
              >
                <Plus size={12} /> Add Session
              </button>
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-muted)]">Select a module</div>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto" data-testid="sessions-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              onClick={() => setSelSession(s)}
              className={`border-b border-[var(--color-border)] px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                selSession?.id === s.id ? 'bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-surface)]'
              }`}
              data-testid={`session-row-${s.order_index}`}
            >
              <span className="text-xs text-[var(--color-text-muted)] font-mono flex-shrink-0 w-8">{s.order_index}</span>
              {editingSess === s.id ? (
                <input
                  autoFocus defaultValue={s.title}
                  onBlur={(e) => saveSessionTitle(s.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveSessionTitle(s.id, e.currentTarget.value)}
                  className="flex-1 text-sm bg-transparent border-b border-[var(--color-primary)] outline-none"
                />
              ) : (
                <span className="flex-1 text-sm text-[var(--color-text)] truncate">{s.title}</span>
              )}
              {s.lecture_url && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-mono">video</span>}
              {/* Preview toggle */}
              <button
                onClick={(e) => toggleFlag(e, s, 'is_preview_session')}
                title={s.is_preview_session ? 'Remove preview' : 'Mark as preview (video play button on course page)'}
                data-testid={`preview-toggle-${s.id}`}
                className={`flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded transition-all ${
                  s.is_preview_session
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-[var(--color-text-faint)] hover:text-blue-400 opacity-40 hover:opacity-100'
                }`}
              >
                <Eye size={9} /> preview
              </button>
              {/* Free trial toggle */}
              <button
                onClick={(e) => toggleFlag(e, s, 'is_free_session')}
                title={s.is_free_session ? 'Remove free access' : 'Mark as free trial (guest can access full session)'}
                data-testid={`free-toggle-${s.id}`}
                className={`flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded transition-all ${
                  s.is_free_session
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-[var(--color-text-faint)] hover:text-emerald-400 opacity-40 hover:opacity-100'
                }`}
              >
                <Unlock size={9} /> free
              </button>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); moveSession(s, 'up'); }}
                  disabled={sessions.findIndex((x) => x.id === s.id) === 0}
                  title="Move up"
                  data-testid={`move-session-up-${s.id}`}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-25 disabled:hover:text-[var(--color-text-muted)]"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveSession(s, 'down'); }}
                  disabled={sessions.findIndex((x) => x.id === s.id) === sessions.length - 1}
                  title="Move down"
                  data-testid={`move-session-down-${s.id}`}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-25 disabled:hover:text-[var(--color-text-muted)]"
                >
                  <ChevronDown size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditingSess(s.id); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" data-testid={`edit-session-${s.id}`}>
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); askDeleteSession(s); }}
                  title="Delete session"
                  data-testid={`delete-session-${s.id}`}
                  className="text-[var(--color-text-muted)] hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
          {sessions.length === 0 && sel && (
            <li className="p-6 text-center text-sm text-[var(--color-text-muted)]">
              No sessions yet — click Add Session
            </li>
          )}
        </ul>
      </div>

      {/* Right rail — Content editors (Phase B.2). 4-tab segmented control. */}
      <div className="w-96 flex-shrink-0 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
        {selSession ? (
          <>
            <div className="border-b border-[var(--color-border)] p-1.5 flex gap-1 flex-shrink-0" data-testid="editor-tabs">
              {[
                { k: 'notes',     label: 'Notes' },
                { k: 'quiz',      label: 'Quiz' },
                { k: 'interview', label: 'Interview' },
                { k: 'video',     label: 'Video' },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setActiveTab(t.k)}
                  data-testid={`editor-tab-${t.k}`}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    activeTab === t.k
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden p-4">
              {activeTab === 'notes' && (
                <NotesEditor sessionId={selSession.id} sessionTitle={selSession.title} />
              )}
              {activeTab === 'quiz' && (
                <QuizEditor sessionId={selSession.id} sessionTitle={selSession.title} />
              )}
              {activeTab === 'interview' && (
                <InterviewEditor sessionId={selSession.id} sessionTitle={selSession.title} />
              )}
              {activeTab === 'video' && (
                <VideoEditor
                  sessionId={selSession.id}
                  sessionTitle={selSession.title}
                  lectureUrl={selSession.lecture_url}
                  onChange={(url) => {
                    // Optimistic local update so the middle column's video badge flips.
                    setSelSession({ ...selSession, lecture_url: url });
                    setSessions(sessions.map((s) => (s.id === selSession.id ? { ...s, lecture_url: url } : s)));
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-[var(--color-text-muted)] p-4">
            <p className="font-semibold text-[var(--color-text)] mb-2">Content editors</p>
            <p>Click a session in the middle column to edit its Notes, Quiz, Interview, and Video content.</p>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="curriculum-delete-confirm" onClick={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-500 mt-1" size={20} />
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text)]">
                  Delete {confirm.kind === 'module' ? 'module' : 'session'}?
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  "<span className="text-[var(--color-text)]">{confirm.name}</span>"
                </p>
              </div>
            </div>
            {confirm.impact && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 mb-4 text-xs text-[var(--color-text)]">
                <p className="font-semibold text-red-500 mb-1">This will cascade delete:</p>
                <ul className="space-y-0.5 text-[var(--color-text-muted)]">
                  <li>• {confirm.impact.sessions} sessions</li>
                  <li>• {confirm.impact.notes_cards} notes cards</li>
                  <li>• {confirm.impact.quiz_items} quiz items</li>
                  <li>• {confirm.impact.interview_questions} interview questions</li>
                </ul>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface)]" data-testid="delete-cancel">Cancel</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white font-semibold hover:brightness-110" data-testid="delete-confirm-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}

    {/* Module project modal (Phase C) */}
    {projModule && (
      <ModuleProjectModal
        moduleId={projModule.id}
        moduleTitle={projModule.title}
        onClose={() => setProjModule(null)}
      />
    )}
    </div>
  );
}

/**
 * DownloadCurriculumButton — small dropdown that pulls the full curriculum
 * tree from GET /api/admin/curriculum/export and offers three formats:
 *   • JSON   — structured, machine-readable, complete
 *   • Markdown — human-readable, printable, great for review/sharing
 *   • CSV    — flat rows of every session, opens in Excel
 */
function DownloadCurriculumButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const download = async (format) => {
    setBusy(true); setErr(null); setOpen(false);
    try {
      const data = await req('/api/admin/curriculum/export');
      const stamp = new Date().toISOString().slice(0, 10);
      const base = `valuevade-curriculum-${stamp}`;

      let blob, filename;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `${base}.json`;
      } else if (format === 'md') {
        blob = new Blob([toMarkdown(data)], { type: 'text/markdown' });
        filename = `${base}.md`;
      } else {
        blob = new Blob([toCsv(data)], { type: 'text/csv' });
        filename = `${base}.csv`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold hover:brightness-110 disabled:opacity-60"
        data-testid="curriculum-download-btn"
      >
        <Download size={13} />
        {busy ? 'Downloading…' : 'Download full curriculum'}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg z-10 py-1"
          data-testid="curriculum-download-menu"
        >
          <button type="button" onClick={() => download('md')} className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-surface)] text-[var(--color-text)]" data-testid="curriculum-download-md">
            <div className="font-semibold">Markdown (.md)</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Human-readable, printable</div>
          </button>
          <button type="button" onClick={() => download('csv')} className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-surface)] text-[var(--color-text)]" data-testid="curriculum-download-csv">
            <div className="font-semibold">CSV (.csv)</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Every session as a row — Excel</div>
          </button>
          <button type="button" onClick={() => download('json')} className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-surface)] text-[var(--color-text)]" data-testid="curriculum-download-json">
            <div className="font-semibold">JSON (.json)</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Structured, complete tree</div>
          </button>
        </div>
      )}
      {err && <p className="text-[10px] text-red-500 mt-1" data-testid="curriculum-download-error">{err}</p>}
    </div>
  );
}

// -- format helpers ---------------------------------------------------------
function toMarkdown(data) {
  const lines = [];
  lines.push(`# ${data.path?.title || 'Valuevade Curriculum'}`);
  lines.push('');
  const s = data.summary || {};
  lines.push(`_${s.module_count || 0} modules · ${s.session_count || 0} sessions · ${s.project_count || 0} module projects · ${s.capstone_count || 0} capstone projects_`);
  lines.push(`_Generated ${data.generated_at || new Date().toISOString()}_`);
  lines.push('');
  (data.modules || []).forEach((m) => {
    const num = m.module_number ?? m.order_index ?? '';
    lines.push(`## Module ${num}. ${m.title}`);
    if (m.description) { lines.push(''); lines.push(m.description); }
    if ((m.sessions || []).length) {
      lines.push('');
      lines.push('**Sessions**');
      m.sessions.forEach((sess, i) => {
        const mins = sess.estimated_minutes ? ` — ${sess.estimated_minutes} min` : '';
        const vid = sess.has_video ? ' 🎥' : '';
        lines.push(`${i + 1}. ${sess.title}${mins}${vid}`);
        if (sess.description) lines.push(`   > ${sess.description.replace(/\n/g, ' ')}`);
      });
    }
    if ((m.projects || []).length) {
      lines.push('');
      lines.push('**Module Projects**');
      m.projects.forEach((p) => {
        const hrs = p.estimated_hours ? ` (${p.estimated_hours}h)` : '';
        lines.push(`- ${p.title}${hrs}`);
        if (p.description) lines.push(`   > ${p.description.replace(/\n/g, ' ')}`);
        if (p.deliverable) lines.push(`   > **Deliverable:** ${p.deliverable.replace(/\n/g, ' ')}`);
      });
    }
    lines.push('');
  });
  if ((data.capstones || []).length) {
    lines.push('---');
    lines.push('# Capstone Projects');
    lines.push('');
    data.capstones.forEach((c) => {
      lines.push(`## ${c.code ? c.code + ' — ' : ''}${c.title}`);
      if (c.learning_outcomes) { lines.push(''); lines.push(`**Learning outcomes**: ${c.learning_outcomes}`); }
      if (c.required_structure) { lines.push(''); lines.push(`**Required structure**: ${c.required_structure}`); }
      if (c.tasks_raw) { lines.push(''); lines.push(c.tasks_raw); }
      lines.push('');
    });
  }
  return lines.join('\n');
}

function toCsv(data) {
  const rows = [];
  const esc = (v) => {
    const s = v == null ? '' : String(v).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${s}"`;
  };
  rows.push(['type','module_number','module_title','session_or_project_title','description','estimated_minutes','has_video','capstone_code'].map(esc).join(','));
  (data.modules || []).forEach((m) => {
    (m.sessions || []).forEach((s) => {
      rows.push(['session', m.module_number ?? '', m.title, s.title, s.description || '', s.estimated_minutes ?? '', s.has_video ? 'Y' : 'N', ''].map(esc).join(','));
    });
    (m.projects || []).forEach((p) => {
      rows.push(['module_project', m.module_number ?? '', m.title, p.title, p.description || '', p.estimated_hours ?? '', '', ''].map(esc).join(','));
    });
  });
  (data.capstones || []).forEach((c) => {
    rows.push(['capstone', '', '', c.title, (c.learning_outcomes || '').slice(0, 500), '', '', c.code || ''].map(esc).join(','));
  });
  return rows.join('\n');
}

