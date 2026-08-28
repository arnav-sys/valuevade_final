/**
 * MockExamModal — Admin modal to create/edit a mock exam and manage its
 * questions. Opened from the CurriculumTab module row (ClipboardList icon).
 *
 * Layout: full-width modal with two panels:
 *   Left  — Exam settings (title, timer, pass %, description)
 *   Right — Question CRUD (same pattern as QuizEditor)
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X as XIcon, Save, Trash2, Plus, ChevronUp, ChevronDown, ClipboardList,
  Clock, Target, BookOpen, Loader2,
} from 'lucide-react';

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

// ─── Question row ────────────────────────────────────────────────────────────

function QuestionRow({ q, onEdit, onDelete }) {
  return (
    <li
      className="border border-[var(--color-border)] rounded-lg"
      data-testid={`mock-q-row-${q.order_index}`}
    >
      <div className="flex items-start gap-2 px-2 py-1.5">
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-7 pt-0.5 flex-shrink-0">
          Q{q.order_index}
        </span>
        <div className="flex-1 min-w-0">
          {q.topic_tag && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-[var(--color-accent-purple)]/15 text-[var(--color-accent-purple)] mr-1.5">
              {q.topic_tag}
            </span>
          )}
          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-[var(--color-primary)]/15 text-[var(--color-primary)] mr-1.5">
            {q.difficulty || 'medium'}
          </span>
          <span className="text-xs text-[var(--color-text)] line-clamp-1">{q.question || '(no question)'}</span>
        </div>
        <button
          onClick={() => onEdit(q)}
          className="text-[10px] text-[var(--color-primary)] hover:underline flex-shrink-0"
          data-testid={`edit-mock-q-${q.id}`}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(q)}
          className="text-[var(--color-text-muted)] hover:text-red-500 flex-shrink-0"
          data-testid={`delete-mock-q-${q.id}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}

// ─── Question editor form ────────────────────────────────────────────────────

function QuestionForm({ draft, setDraft, onSave, onCancel, saving }) {
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

  return (
    <div className="space-y-3 border border-[var(--color-primary)]/30 rounded-lg p-3 bg-[var(--color-primary)]/5">
      <textarea
        value={draft.question}
        onChange={(e) => setDraft({ ...draft, question: e.target.value })}
        rows={3}
        placeholder="Question text…"
        data-testid="mock-exam-draft-question"
        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
      />
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono">Difficulty</span>
          <select
            value={draft.difficulty}
            onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
            className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono">Topic</span>
          <input
            value={draft.topic_tag}
            onChange={(e) => setDraft({ ...draft, topic_tag: e.target.value })}
            placeholder="e.g. Regulation"
            className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] w-32"
          />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-mono">Options (click letter for correct)</span>
          {draft.options.length < 6 && (
            <button onClick={addOption} className="text-[10px] text-[var(--color-primary)] hover:underline">+ option</button>
          )}
        </div>
        {draft.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, correct_answer_index: i })}
              className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-mono border ${
                draft.correct_answer_index === i
                  ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]'
              }`}
            >
              {String.fromCharCode(65 + i)}
            </button>
            <input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="flex-1 text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
            {draft.options.length > 2 && (
              <button onClick={() => removeOption(i)} className="text-[var(--color-text-muted)] hover:text-red-500">
                <XIcon size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
      <textarea
        value={draft.explanation}
        onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
        rows={2}
        placeholder="Explanation (shown after the exam is submitted)"
        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface)]">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          data-testid="save-mock-exam-question"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--color-success)] text-white text-xs hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save question
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function MockExamModal({ moduleId, moduleTitle, onClose }) {
  const [loadingExam, setLoadingExam] = useState(true);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [settings, setSettings] = useState({
    title: 'Mock Exam',
    description: '',
    time_limit_minutes: 120,
    pass_percentage: 60,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsErr, setSettingsErr] = useState(null);
  const [editingQId, setEditingQId] = useState(null); // null = no edit, 'new' = new Q
  const [draft, setDraft] = useState(null);
  const [qSaving, setQSaving] = useState(false);
  const [examErr, setExamErr] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadQuestions = useCallback(async (examId) => {
    if (!examId) return;
    setLoadingQs(true);
    try {
      const j = await req(`/api/admin/mock-exam-questions?exam_id=${examId}`);
      setQuestions(j.questions || []);
    } catch (e) { console.error('loadQuestions:', e); }
    finally { setLoadingQs(false); }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingExam(true);
      try {
        const j = await req(`/api/admin/mock-exams/${moduleId}`);
        if (!mounted) return;
        if (j.exam) {
          setExam(j.exam);
          setSettings({
            title: j.exam.title || 'Mock Exam',
            description: j.exam.description || '',
            time_limit_minutes: j.exam.time_limit_minutes || 120,
            pass_percentage: j.exam.pass_percentage || 60,
          });
          await loadQuestions(j.exam.id);
        }
      } catch (e) {
        if (mounted) {
          // Surface a friendly message — DB migration likely not applied yet
          const msg = e.message || '';
          if (msg.includes('PGRST') || msg.includes('schema cache') || msg.includes('does not exist')) {
            setExamErr('DB migration 0043 not applied yet. Run 0043_mock_exams.sql in Supabase Studio.');
          } else {
            setExamErr(msg.slice(0, 120));
          }
        }
      }
      finally { if (mounted) setLoadingExam(false); }
    })();
    return () => { mounted = false; };
  }, [moduleId, loadQuestions]);

  const createExam = async () => {
    setCreating(true); setExamErr(null);
    try {
      const j = await req(`/api/admin/mock-exams/${moduleId}`, 'POST', settings);
      setExam(j.exam);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('PGRST') || msg.includes('schema cache') || msg.includes('does not exist')) {
        setExamErr('DB migration 0043 not applied yet. Run 0043_mock_exams.sql in Supabase Studio first.');
      } else {
        setExamErr(msg.slice(0, 120));
      }
    }
    finally { setCreating(false); }
  };

  const saveSettings = async () => {
    if (!exam) return;
    setSettingsSaving(true); setSettingsErr(null);
    try {
      const j = await req(`/api/admin/mock-exams/${exam.id}`, 'PATCH', settings);
      setExam(j.exam);
    } catch (e) { setSettingsErr(e.message); }
    finally { setSettingsSaving(false); }
  };

  const startNewQuestion = () => {
    setEditingQId('new');
    setDraft({ question: '', options: ['', '', '', ''], correct_answer_index: 0, explanation: '', difficulty: 'medium', topic_tag: '' });
  };

  const startEditQuestion = (q) => {
    setEditingQId(q.id);
    setDraft({
      question: q.question || '',
      options: normalizeOptions(q.options),
      correct_answer_index: q.correct_answer_index ?? 0,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'medium',
      topic_tag: q.topic_tag || '',
    });
  };

  const saveQuestion = async () => {
    if (!draft || !exam) return;
    const opts = draft.options.filter((o, i) => i < 2 || (o || '').trim().length > 0);
    const payload = { ...draft, options: opts };
    if (payload.correct_answer_index >= opts.length) payload.correct_answer_index = 0;
    setQSaving(true);
    try {
      if (editingQId === 'new') {
        await req('/api/admin/mock-exam-questions', 'POST', { exam_id: exam.id, ...payload });
      } else {
        await req(`/api/admin/mock-exam-questions/${editingQId}`, 'PATCH', payload);
      }
      setEditingQId(null); setDraft(null);
      await loadQuestions(exam.id);
    } catch (e) { alert(e.message); }
    finally { setQSaving(false); }
  };

  const deleteQuestion = async (q) => {
    if (!window.confirm(`Delete question "${(q.question || '').slice(0, 50)}…"?`)) return;
    try {
      await req(`/api/admin/mock-exam-questions/${q.id}`, 'DELETE');
      if (editingQId === q.id) { setEditingQId(null); setDraft(null); }
      await loadQuestions(exam.id);
    } catch (e) { alert(e.message); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="mock-exam-modal"
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-[var(--color-primary)]" />
              <span className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Mock Exam</span>
            </div>
            <div className="text-sm font-semibold text-[var(--color-text)] mt-0.5" data-testid="mock-exam-modal-title">
              {moduleTitle}
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="mock-exam-modal-close"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <XIcon size={18} />
          </button>
        </div>

        {loadingExam ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
          </div>
        ) : !exam ? (
          /* No exam yet — create it */
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center">
              <ClipboardList size={28} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)] mb-1">No mock exam yet for this module</p>
              <p className="text-xs text-[var(--color-text-muted)]">Create one to replace the module project with a timed exam.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-2">
              <div className="text-center">
                <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Questions</label>
                <p className="text-xs text-[var(--color-text)] mt-1">100 (add after)</p>
              </div>
              <div className="text-center">
                <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Time limit</label>
                <input
                  type="number" min="1" value={settings.time_limit_minutes}
                  onChange={(e) => setSettings({ ...settings, time_limit_minutes: Number(e.target.value) })}
                  className="w-full text-center text-xs px-2 py-1 mt-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                  data-testid="create-exam-time-limit"
                />
                <p className="text-[9px] text-[var(--color-text-muted)]">minutes</p>
              </div>
              <div className="text-center">
                <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Pass %</label>
                <input
                  type="number" min="1" max="100" value={settings.pass_percentage}
                  onChange={(e) => setSettings({ ...settings, pass_percentage: Number(e.target.value) })}
                  className="w-full text-center text-xs px-2 py-1 mt-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                  data-testid="create-exam-pass-pct"
                />
                <p className="text-[9px] text-[var(--color-text-muted)]">percent</p>
              </div>
            </div>
            {examErr && <p className="text-xs text-red-500">{examErr}</p>}
            <button
              onClick={createExam}
              disabled={creating}
              data-testid="create-mock-exam-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Mock Exam
            </button>
          </div>
        ) : (
          /* Exam exists — show settings + question editor */
          <div className="flex-1 overflow-hidden flex gap-0 min-h-0">

            {/* Left — Settings */}
            <div className="w-72 flex-shrink-0 border-r border-[var(--color-border)] overflow-y-auto p-5 space-y-4">
              <div>
                <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider mb-3">Exam settings</p>
                <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Title</label>
                <input
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  data-testid="mock-exam-title-input"
                  className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Description</label>
                <textarea
                  value={settings.description}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                  rows={3}
                  data-testid="mock-exam-description-input"
                  className="w-full mt-1 text-xs px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                  placeholder="Optional intro text shown before the exam starts"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] flex items-center gap-1">
                    <Clock size={9} /> Time (min)
                  </label>
                  <input
                    type="number" min="1"
                    value={settings.time_limit_minutes}
                    onChange={(e) => setSettings({ ...settings, time_limit_minutes: Number(e.target.value) })}
                    data-testid="mock-exam-time-input"
                    className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] flex items-center gap-1">
                    <Target size={9} /> Pass %
                  </label>
                  <input
                    type="number" min="1" max="100"
                    value={settings.pass_percentage}
                    onChange={(e) => setSettings({ ...settings, pass_percentage: Number(e.target.value) })}
                    data-testid="mock-exam-pass-pct-input"
                    className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                  />
                </div>
              </div>
              <div className="pt-1 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-text)] font-bold">{questions.length}</span> questions added
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <BookOpen size={10} className="text-[var(--color-text-muted)]" />
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Score to pass: {Math.ceil(questions.length * settings.pass_percentage / 100)} / {questions.length}
                  </span>
                </div>
              </div>
              {settingsErr && <p className="text-xs text-red-500">{settingsErr}</p>}
              <button
                onClick={saveSettings}
                disabled={settingsSaving}
                data-testid="save-mock-exam-settings"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-accent-purple)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50"
              >
                {settingsSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save settings
              </button>
            </div>

            {/* Right — Questions */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
                <p className="text-xs font-semibold text-[var(--color-text)]">
                  Questions ({questions.length})
                </p>
                <button
                  onClick={startNewQuestion}
                  disabled={!!editingQId}
                  data-testid="add-mock-exam-question"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs hover:brightness-110 disabled:opacity-50"
                >
                  <Plus size={12} /> Add Question
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2" data-testid="mock-exam-questions-list">
                {editingQId === 'new' && draft && (
                  <QuestionForm
                    draft={draft}
                    setDraft={setDraft}
                    onSave={saveQuestion}
                    onCancel={() => { setEditingQId(null); setDraft(null); }}
                    saving={qSaving}
                  />
                )}
                {loadingQs ? (
                  <p className="text-xs text-[var(--color-text-muted)] text-center py-4">Loading questions…</p>
                ) : questions.length === 0 && !editingQId ? (
                  <div className="text-center py-10">
                    <p className="text-xs text-[var(--color-text-muted)]">No questions yet.</p>
                    <p className="text-[10px] text-[var(--color-text-faint)] mt-1">Click "Add Question" to start building the exam.</p>
                  </div>
                ) : (
                  <ul className="space-y-1.5" data-testid="mock-exam-question-list">
                    {questions.map((q) =>
                      editingQId === q.id && draft ? (
                        <li key={q.id}>
                          <QuestionForm
                            draft={draft}
                            setDraft={setDraft}
                            onSave={saveQuestion}
                            onCancel={() => { setEditingQId(null); setDraft(null); }}
                            saving={qSaving}
                          />
                        </li>
                      ) : (
                        <QuestionRow
                          key={q.id}
                          q={q}
                          onEdit={startEditQuestion}
                          onDelete={deleteQuestion}
                        />
                      )
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
