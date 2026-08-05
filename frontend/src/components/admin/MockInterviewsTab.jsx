/**
 * Admin — Mock Interviews content manager.
 *
 * CRUD for the 5 firm interview simulations (master_interview_sims):
 *   - list, add, edit, duplicate, activate/deactivate, delete, reorder
 *   - edit every content field: firm meta, brand, process (aptitude / behavioural
 *     / technical / case), case brief markdown, and the Excel case workbook
 *     (via a friendly params form that regenerates the workbook + expected
 *     summary, matching scripts/seed_interview_sims.py).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Pencil, Trash2, Copy, ArrowUp, ArrowDown, Save, X as XIcon,
  RefreshCw, Building2, AlertTriangle, Eye, EyeOff, FileSpreadsheet, Wand2,
} from 'lucide-react';

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
  let j = null; try { j = text ? JSON.parse(text) : null; } catch { /* raw */ }
  if (!r.ok) throw new Error((j && (j.detail || j.message)) || text || `${r.status}`);
  return j;
}

const EMPTY_DRAFT = {
  firm_slug: '',
  firm_name: '',
  firm_type: 'global',
  role_title: '',
  location: '',
  salary_band: '',
  about_md: '',
  brand: { accent: '#2E7D32', initials: '', tagline: '' },
  process: {
    persona: '',
    aptitude: { num_questions: 12, time_limit_minutes: 15, pass_pct: 40,
                topics: ['numerical reasoning', 'data interpretation', 'logical reasoning', 'verbal reasoning'] },
    behavioural: { num_questions: 4, focus: '' },
    technical: { num_questions: 5, focus: '' },
    case: { time_limit_minutes: 45, company_blurb: '' },
  },
  case_config: {
    brief_md: '',
    workbook: {},
    expected_summary: {},
    params: { rev0: 5000, growth: [12, 10, 8], ebitda_margin: 22, dna: 250,
              interest: 60, tax: 25, shares: 66, exit_pe: 45,
              company: '', firm: '', role: '' },
  },
  order_index: 1,
  is_active: true,
};

function fromSim(s) {
  const brand = s.brand || {};
  const process = s.process || {};
  const case_config = s.case_config || {};
  // Try to derive params from case_config if not stored explicitly
  const params = case_config.params || EMPTY_DRAFT.case_config.params;
  return {
    id: s.id,
    firm_slug: s.firm_slug || '',
    firm_name: s.firm_name || '',
    firm_type: s.firm_type || 'global',
    role_title: s.role_title || '',
    location: s.location || '',
    salary_band: s.salary_band || '',
    about_md: s.about_md || '',
    brand: {
      accent: brand.accent || '#2E7D32',
      initials: brand.initials || '',
      tagline: brand.tagline || '',
    },
    process: {
      persona: process.persona || '',
      aptitude: {
        num_questions: process.aptitude?.num_questions ?? 12,
        time_limit_minutes: process.aptitude?.time_limit_minutes ?? 15,
        pass_pct: process.aptitude?.pass_pct ?? 40,
        topics: process.aptitude?.topics || EMPTY_DRAFT.process.aptitude.topics,
      },
      behavioural: {
        num_questions: process.behavioural?.num_questions ?? 4,
        focus: process.behavioural?.focus || '',
      },
      technical: {
        num_questions: process.technical?.num_questions ?? 5,
        focus: process.technical?.focus || '',
      },
      case: {
        time_limit_minutes: process.case?.time_limit_minutes ?? 45,
        company_blurb: process.case?.company_blurb || '',
      },
    },
    case_config: {
      brief_md: case_config.brief_md || '',
      workbook: case_config.workbook || {},
      expected_summary: case_config.expected_summary || {},
      params: {
        rev0: params.rev0 ?? 5000,
        growth: Array.isArray(params.growth) && params.growth.length === 3 ? params.growth : [12, 10, 8],
        ebitda_margin: params.ebitda_margin ?? 22,
        dna: params.dna ?? 250,
        interest: params.interest ?? 60,
        tax: params.tax ?? 25,
        shares: params.shares ?? 66,
        exit_pe: params.exit_pe ?? 45,
        company: params.company || '',
        firm: params.firm || s.firm_name || '',
        role: params.role || s.role_title || '',
      },
    },
    order_index: s.order_index ?? 1,
    is_active: s.is_active !== false,
  };
}

// --------- Small reusable UI atoms --------------------------------------------
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{hint}</p>}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--bg-primary)] text-[var(--color-text)] ${props.className || ''}`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--bg-primary)] text-[var(--color-text)] resize-y font-mono ${props.className || ''}`}
    />
  );
}

// --------- Main tab -----------------------------------------------------------
export default function MockInterviewsTab() {
  const [sims, setSims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [openSimId, setOpenSimId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind:'delete'|'deactivate', sim, hard }
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const j = await req('/api/admin/interview-sims');
      setSims(j.sims || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const openEdit = async (sim) => {
    try {
      const j = await req(`/api/admin/interview-sims/${sim.id}`);
      setOpenSimId(sim.id);
      setDraft(fromSim(j.sim));
    } catch (e) { alert(e.message); }
  };

  const startCreate = () => {
    setCreating(true);
    setOpenSimId('new');
    setDraft({ ...EMPTY_DRAFT, order_index: (sims[sims.length - 1]?.order_index || 0) + 1 });
  };

  const closeEditor = () => { setOpenSimId(null); setDraft(null); setCreating(false); };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.firm_slug || !draft.firm_name || !draft.role_title) {
      alert('firm_slug, firm_name and role_title are required'); return;
    }
    setSaving(true);
    try {
      const body = {
        firm_slug: draft.firm_slug,
        firm_name: draft.firm_name,
        firm_type: draft.firm_type,
        role_title: draft.role_title,
        location: draft.location || null,
        salary_band: draft.salary_band || null,
        about_md: draft.about_md || null,
        brand: draft.brand || {},
        process: draft.process || {},
        case_config: draft.case_config || {},
        order_index: draft.order_index,
        is_active: draft.is_active,
      };
      if (creating) {
        await req('/api/admin/interview-sims', 'POST', body);
      } else {
        await req(`/api/admin/interview-sims/${openSimId}`, 'PATCH', body);
      }
      closeEditor();
      await reload();
    } catch (e) { alert(`Save failed: ${e.message}`); }
    finally { setSaving(false); }
  };

  const duplicate = async (sim) => {
    const newSlug = window.prompt(`Duplicate "${sim.firm_name}". Enter a NEW firm_slug for the copy:`, `${sim.firm_slug}-copy`);
    if (!newSlug) return;
    try {
      await req(`/api/admin/interview-sims/${sim.id}/duplicate`, 'POST', { firm_slug: newSlug });
      await reload();
    } catch (e) { alert(e.message); }
  };

  const move = async (idx, dir) => {
    const arr = [...sims];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setSims(arr);
    try {
      await req('/api/admin/interview-sims/reorder', 'POST', { ids: arr.map(s => s.id) });
      await reload();
    } catch (e) { alert(e.message); await reload(); }
  };

  const toggleActive = async (sim) => {
    try {
      await req(`/api/admin/interview-sims/${sim.id}`, 'PATCH', { is_active: !sim.is_active });
      await reload();
    } catch (e) { alert(e.message); }
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      const url = `/api/admin/interview-sims/${confirm.sim.id}${confirm.hard ? '?hard=true' : ''}`;
      await req(url, 'DELETE');
      setConfirm(null);
      await reload();
    } catch (e) { alert(e.message); }
  };

  if (err) return <div className="text-red-500 p-4" data-testid="mock-tab-error">{err}</div>;

  return (
    <div data-testid="admin-mock-interviews-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Mock Interview Content
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Manage every firm simulation — content, rounds, and case study — powering Module 20.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--color-border)] text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-card-hover)]"
            data-testid="mock-refresh-btn"
          ><RefreshCw size={12} /> Refresh</button>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs hover:brightness-110"
            data-testid="mock-add-firm-btn"
          ><Plus size={12} /> Add firm</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="mock-sims-table">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-card-hover)] text-[10px] uppercase font-mono text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left">Firm</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Slug</th>
                <th className="px-3 py-2 text-left">Attempts</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sims.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--color-text-muted)]">No simulations yet — click &quot;Add firm&quot;.</td></tr>
              )}
              {sims.map((s, idx) => (
                <tr key={s.id} className="border-t border-[var(--color-border)]" data-testid={`mock-sim-row-${s.firm_slug}`}>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.order_index}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold text-white"
                            style={{ background: (s.brand?.accent) || '#666' }}>
                        {(s.brand?.initials || s.firm_name.slice(0, 2)).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--color-text)] truncate">{s.firm_name}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">{s.firm_type === 'india' ? '🇮🇳 India' : '🌐 Global'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.role_title}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.location || '—'}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{s.firm_slug}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.attempts_count || 0}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${s.is_active
                        ? 'bg-green-500/15 text-green-600 hover:bg-green-500/25'
                        : 'bg-gray-500/15 text-gray-500 hover:bg-gray-500/25'}`}
                      data-testid={`mock-toggle-active-${s.firm_slug}`}
                    >
                      {s.is_active ? <><Eye size={10}/> Active</> : <><EyeOff size={10}/> Hidden</>}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0}
                              className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30"
                              title="Move up" data-testid={`mock-up-${s.firm_slug}`}><ArrowUp size={12}/></button>
                      <button onClick={() => move(idx, 1)} disabled={idx === sims.length - 1}
                              className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30"
                              title="Move down" data-testid={`mock-down-${s.firm_slug}`}><ArrowDown size={12}/></button>
                      <button onClick={() => openEdit(s)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-bg-card-hover)]"
                              data-testid={`mock-edit-${s.firm_slug}`}><Pencil size={11}/> Edit</button>
                      <button onClick={() => duplicate(s)}
                              className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                              title="Duplicate" data-testid={`mock-duplicate-${s.firm_slug}`}><Copy size={12}/></button>
                      <button onClick={() => setConfirm({ kind: 'delete', sim: s, hard: false })}
                              className="p-1 rounded hover:bg-red-500/10 text-red-500"
                              title="Delete" data-testid={`mock-delete-${s.firm_slug}`}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openSimId && draft && (
        <SimEditor
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onSave={saveDraft}
          onClose={closeEditor}
          isNew={creating}
        />
      )}

      {confirm && (
        <ConfirmDelete
          sim={confirm.sim}
          hard={confirm.hard}
          onSetHard={(h) => setConfirm({ ...confirm, hard: h })}
          onClose={() => setConfirm(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

// --------- Editor modal -------------------------------------------------------
function SimEditor({ draft, setDraft, saving, onSave, onClose, isNew }) {
  const [section, setSection] = useState('firm');
  const set = (patch) => setDraft({ ...draft, ...patch });
  const setProc = (key, patch) => setDraft({
    ...draft,
    process: { ...draft.process, [key]: { ...draft.process[key], ...patch } },
  });
  const setCase = (patch) => setDraft({
    ...draft,
    case_config: { ...draft.case_config, ...patch },
  });
  const setBrand = (patch) => setDraft({ ...draft, brand: { ...draft.brand, ...patch } });

  const sections = [
    { k: 'firm', label: 'Firm' },
    { k: 'brand', label: 'Brand' },
    { k: 'process', label: 'Rounds' },
    { k: 'case', label: 'Case Study' },
    { k: 'raw', label: 'Raw JSON' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="mock-editor-modal">
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div>
            <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">{isNew ? 'New firm' : 'Editing firm'}</p>
            <h3 className="text-base font-semibold text-[var(--color-text)]">{draft.firm_name || '(unnamed)'} <span className="text-xs font-mono text-[var(--color-text-muted)]">/{draft.firm_slug || '…'}</span></h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--color-bg-card-hover)]" data-testid="mock-editor-close"><XIcon size={16} /></button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-[var(--color-border)]">
          {sections.map(s => (
            <button
              key={s.k}
              onClick={() => setSection(s.k)}
              className={`px-3 py-2 text-xs border-b-2 transition-colors ${section === s.k
                ? 'border-[var(--color-primary)] text-[var(--color-text)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
              data-testid={`mock-editor-tab-${s.k}`}
            >{s.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {section === 'firm' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Firm slug (unique)"><Input value={draft.firm_slug} onChange={(e) => set({ firm_slug: e.target.value })} data-testid="edit-firm-slug" placeholder="jpmorgan" /></Field>
              <Field label="Firm name"><Input value={draft.firm_name} onChange={(e) => set({ firm_name: e.target.value })} data-testid="edit-firm-name" placeholder="J.P. Morgan" /></Field>
              <Field label="Firm type">
                <select value={draft.firm_type} onChange={(e) => set({ firm_type: e.target.value })}
                        className="w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--bg-primary)] text-[var(--color-text)]"
                        data-testid="edit-firm-type">
                  <option value="global">🌐 Global bank</option>
                  <option value="india">🇮🇳 Indian firm</option>
                </select>
              </Field>
              <Field label="Role title"><Input value={draft.role_title} onChange={(e) => set({ role_title: e.target.value })} data-testid="edit-role-title" placeholder="Equity Research Associate — India Consumer" /></Field>
              <Field label="Location"><Input value={draft.location} onChange={(e) => set({ location: e.target.value })} data-testid="edit-location" placeholder="Mumbai (BKC)" /></Field>
              <Field label="Salary band"><Input value={draft.salary_band} onChange={(e) => set({ salary_band: e.target.value })} data-testid="edit-salary" placeholder="₹28-34 LPA + bonus" /></Field>
              <Field label="Order index"><Input type="number" value={draft.order_index} onChange={(e) => set({ order_index: parseInt(e.target.value || '1', 10) })} data-testid="edit-order-index" /></Field>
              <Field label="Active">
                <select value={draft.is_active ? '1' : '0'} onChange={(e) => set({ is_active: e.target.value === '1' })}
                        className="w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--bg-primary)] text-[var(--color-text)]"
                        data-testid="edit-active">
                  <option value="1">Active (visible to learners)</option>
                  <option value="0">Hidden</option>
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="About (markdown)" hint="Shown on the firm card in the hub.">
                  <Textarea rows={4} value={draft.about_md} onChange={(e) => set({ about_md: e.target.value })} data-testid="edit-about-md" />
                </Field>
              </div>
            </div>
          )}

          {section === 'brand' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Accent color (hex)">
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.brand.accent} onChange={(e) => setBrand({ accent: e.target.value })}
                         className="h-9 w-14 rounded border border-[var(--color-border)] bg-[var(--bg-primary)] cursor-pointer"
                         data-testid="edit-brand-accent-picker" />
                  <Input value={draft.brand.accent} onChange={(e) => setBrand({ accent: e.target.value })} data-testid="edit-brand-accent" />
                </div>
              </Field>
              <Field label="Initials (badge)"><Input value={draft.brand.initials} onChange={(e) => setBrand({ initials: e.target.value })} maxLength={4} data-testid="edit-brand-initials" placeholder="JPM" /></Field>
              <div className="col-span-2">
                <Field label="Tagline"><Input value={draft.brand.tagline} onChange={(e) => setBrand({ tagline: e.target.value })} data-testid="edit-brand-tagline" placeholder="Global Investment Bank · New York HQ" /></Field>
              </div>

              <div className="col-span-2 flex items-center gap-3 mt-2 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card-hover)]">
                <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Preview:</p>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-md text-xs font-bold text-white"
                      style={{ background: draft.brand.accent || '#666' }}>
                  {(draft.brand.initials || (draft.firm_name || '?').slice(0, 3)).toUpperCase()}
                </span>
                <div>
                  <div className="font-medium text-sm text-[var(--color-text)]">{draft.firm_name || 'Firm name'}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">{draft.brand.tagline || 'Tagline'}</div>
                </div>
              </div>
            </div>
          )}

          {section === 'process' && (
            <div className="space-y-5">
              <Field label="Interviewer persona" hint="Sets the tone/voice of the AI interviewer across behavioural + technical rounds.">
                <Textarea rows={3} value={draft.process.persona} onChange={(e) => setDraft({ ...draft, process: { ...draft.process, persona: e.target.value } })} data-testid="edit-persona" />
              </Field>

              <div className="border border-[var(--color-border)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--color-text)] mb-3">📝 Aptitude test</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="# Questions"><Input type="number" value={draft.process.aptitude.num_questions} onChange={(e) => setProc('aptitude', { num_questions: parseInt(e.target.value || '0', 10) })} data-testid="edit-apt-n" /></Field>
                  <Field label="Time limit (min)"><Input type="number" value={draft.process.aptitude.time_limit_minutes} onChange={(e) => setProc('aptitude', { time_limit_minutes: parseInt(e.target.value || '0', 10) })} data-testid="edit-apt-time" /></Field>
                  <Field label="Pass cutoff (%)"><Input type="number" value={draft.process.aptitude.pass_pct} onChange={(e) => setProc('aptitude', { pass_pct: parseInt(e.target.value || '0', 10) })} data-testid="edit-apt-pass" /></Field>
                </div>
                <Field label="Topics (comma-separated)">
                  <Input
                    value={(draft.process.aptitude.topics || []).join(', ')}
                    onChange={(e) => setProc('aptitude', { topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                    data-testid="edit-apt-topics"
                  />
                </Field>
              </div>

              <div className="border border-[var(--color-border)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--color-text)] mb-3">🗣️ Behavioural round</p>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="# Questions"><Input type="number" value={draft.process.behavioural.num_questions} onChange={(e) => setProc('behavioural', { num_questions: parseInt(e.target.value || '0', 10) })} data-testid="edit-beh-n" /></Field>
                  <div className="col-span-3"><Field label="Round focus (topics the interviewer probes)">
                    <Input value={draft.process.behavioural.focus} onChange={(e) => setProc('behavioural', { focus: e.target.value })} data-testid="edit-beh-focus" />
                  </Field></div>
                </div>
              </div>

              <div className="border border-[var(--color-border)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--color-text)] mb-3">📊 Technical round</p>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="# Questions"><Input type="number" value={draft.process.technical.num_questions} onChange={(e) => setProc('technical', { num_questions: parseInt(e.target.value || '0', 10) })} data-testid="edit-tech-n" /></Field>
                  <div className="col-span-3"><Field label="Round focus">
                    <Input value={draft.process.technical.focus} onChange={(e) => setProc('technical', { focus: e.target.value })} data-testid="edit-tech-focus" />
                  </Field></div>
                </div>
              </div>

              <div className="border border-[var(--color-border)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--color-text)] mb-3">📁 Case study (metadata)</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Time limit (min)"><Input type="number" value={draft.process.case.time_limit_minutes} onChange={(e) => setProc('case', { time_limit_minutes: parseInt(e.target.value || '0', 10) })} data-testid="edit-case-time" /></Field>
                  <div className="col-span-2"><Field label="Company blurb (short)">
                    <Input value={draft.process.case.company_blurb} onChange={(e) => setProc('case', { company_blurb: e.target.value })} data-testid="edit-case-blurb" />
                  </Field></div>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-2">Full case brief + Excel workbook live in the &quot;Case Study&quot; tab.</p>
              </div>
            </div>
          )}

          {section === 'case' && (
            <CaseEditor
              draft={draft}
              setCase={setCase}
            />
          )}

          {section === 'raw' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-text-muted)]">Full JSON — advanced. Edits here overwrite the friendly fields.</p>
              {['brand', 'process', 'case_config'].map(k => (
                <Field key={k} label={k}>
                  <Textarea
                    rows={12}
                    value={JSON.stringify(draft[k] || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setDraft({ ...draft, [k]: parsed });
                      } catch { /* ignore invalid JSON while typing */ }
                    }}
                    data-testid={`edit-raw-${k}`}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-card-hover)]">
          <p className="text-[10px] text-[var(--color-text-muted)]">
            <AlertTriangle size={11} className="inline mr-1" />
            Changes take effect immediately for learners not currently mid-attempt.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-[var(--color-border)] text-xs" data-testid="mock-editor-cancel">Cancel</button>
            <button onClick={onSave} disabled={saving}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs hover:brightness-110 disabled:opacity-60"
                    data-testid="mock-editor-save">
              <Save size={12} /> {saving ? 'Saving…' : (isNew ? 'Create firm' : 'Save changes')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------- Case study editor -------------------------------------------------
function CaseEditor({ draft, setCase }) {
  const params = draft.case_config.params || {};
  const summary = draft.case_config.expected_summary || {};
  const [rebuilding, setRebuilding] = useState(false);
  const [growth, setGrowth] = useState((params.growth || [0, 0, 0]).map(String));

  useEffect(() => {
    setGrowth((params.growth || [0, 0, 0]).map(String));
  }, [draft.id, params.growth]);

  const updateParam = (key, val) => {
    const newParams = { ...params, [key]: val };
    setCase({ params: newParams });
  };

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const g = growth.map(x => parseFloat(x) || 0);
      const body = {
        rev0: parseFloat(params.rev0),
        growth: g,
        ebitda_margin: parseFloat(params.ebitda_margin),
        dna: parseFloat(params.dna),
        interest: parseFloat(params.interest),
        tax: parseFloat(params.tax),
        shares: parseFloat(params.shares),
        exit_pe: parseFloat(params.exit_pe),
        company: params.company || '',
        firm: params.firm || draft.firm_name,
        role: params.role || draft.role_title,
      };
      const j = await req('/api/admin/interview-sims/rebuild-workbook', 'POST', body);
      setCase({
        workbook: j.workbook,
        expected_summary: j.expected_summary,
        params: { ...j.case_params, growth: j.case_params.growth },
      });
    } catch (e) { alert(`Rebuild failed: ${e.message}`); }
    finally { setRebuilding(false); }
  };

  return (
    <div className="space-y-5">
      <Field label="Case brief (markdown, shown to learner)" hint="Include assumptions, tasks, and BUY/HOLD/SELL instructions.">
        <Textarea rows={10} value={draft.case_config.brief_md} onChange={(e) => setCase({ brief_md: e.target.value })} data-testid="edit-case-brief-md" />
      </Field>

      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
            <FileSpreadsheet size={14} /> Excel case workbook — params
          </p>
          <button onClick={rebuild} disabled={rebuilding}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs hover:brightness-110 disabled:opacity-60"
                  data-testid="edit-case-rebuild">
            <Wand2 size={12} /> {rebuilding ? 'Rebuilding…' : 'Rebuild workbook'}
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Edit the numeric assumptions then click &quot;Rebuild&quot; to regenerate the graded cells + expected values.</p>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Company name">
            <Input value={params.company || ''} onChange={(e) => updateParam('company', e.target.value)} data-testid="edit-case-company" placeholder="UrbanBite QSR Ltd" />
          </Field>
          <Field label="FY24A Revenue (₹ Cr)">
            <Input type="number" step="0.1" value={params.rev0 ?? ''} onChange={(e) => updateParam('rev0', parseFloat(e.target.value || '0'))} data-testid="edit-case-rev0" />
          </Field>
          <Field label="EBITDA margin (%)">
            <Input type="number" step="0.1" value={params.ebitda_margin ?? ''} onChange={(e) => updateParam('ebitda_margin', parseFloat(e.target.value || '0'))} data-testid="edit-case-ebitda" />
          </Field>

          <Field label="Growth FY25E (%)">
            <Input type="number" step="0.1" value={growth[0]} onChange={(e) => setGrowth([e.target.value, growth[1], growth[2]])} data-testid="edit-case-g1" />
          </Field>
          <Field label="Growth FY26E (%)">
            <Input type="number" step="0.1" value={growth[1]} onChange={(e) => setGrowth([growth[0], e.target.value, growth[2]])} data-testid="edit-case-g2" />
          </Field>
          <Field label="Growth FY27E (%)">
            <Input type="number" step="0.1" value={growth[2]} onChange={(e) => setGrowth([growth[0], growth[1], e.target.value])} data-testid="edit-case-g3" />
          </Field>

          <Field label="D&A FY27E (₹ Cr)">
            <Input type="number" step="0.1" value={params.dna ?? ''} onChange={(e) => updateParam('dna', parseFloat(e.target.value || '0'))} data-testid="edit-case-dna" />
          </Field>
          <Field label="Interest FY27E (₹ Cr)">
            <Input type="number" step="0.1" value={params.interest ?? ''} onChange={(e) => updateParam('interest', parseFloat(e.target.value || '0'))} data-testid="edit-case-interest" />
          </Field>
          <Field label="Tax rate (%)">
            <Input type="number" step="0.1" value={params.tax ?? ''} onChange={(e) => updateParam('tax', parseFloat(e.target.value || '0'))} data-testid="edit-case-tax" />
          </Field>

          <Field label="Shares outstanding (Cr)">
            <Input type="number" step="0.1" value={params.shares ?? ''} onChange={(e) => updateParam('shares', parseFloat(e.target.value || '0'))} data-testid="edit-case-shares" />
          </Field>
          <Field label="Exit P/E multiple (x)">
            <Input type="number" step="0.1" value={params.exit_pe ?? ''} onChange={(e) => updateParam('exit_pe', parseFloat(e.target.value || '0'))} data-testid="edit-case-exit-pe" />
          </Field>
        </div>

        {Object.keys(summary).length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 p-3 rounded-md bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">
            <p className="col-span-3 text-[10px] uppercase font-mono text-[var(--color-text-muted)] mb-1">Expected model outputs</p>
            <Stat label="Revenue FY27E" value={`₹${summary.rev_fy27} Cr`} />
            <Stat label="EBITDA FY27E" value={`₹${summary.ebitda_fy27} Cr`} />
            <Stat label="PAT FY27E" value={`₹${summary.pat_fy27} Cr`} />
            <Stat label="EPS FY27E" value={`₹${summary.eps_fy27}`} />
            <Stat label="Exit P/E" value={`${summary.exit_pe}x`} />
            <Stat label="Target Price" value={`₹${summary.target_price}`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

// --------- Delete confirm -----------------------------------------------------
function ConfirmDelete({ sim, hard, onSetHard, onClose, onConfirm }) {
  const hasAttempts = (sim.attempts_count || 0) > 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="mock-delete-modal">
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Delete &quot;{sim.firm_name}&quot;?</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {hasAttempts
                ? `${sim.attempts_count} learner attempt(s) exist for this firm.`
                : 'No learner attempts exist for this firm yet.'}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <label className="flex items-start gap-2 p-2 rounded-md border border-[var(--color-border)] cursor-pointer">
            <input type="radio" checked={!hard} onChange={() => onSetHard(false)} className="mt-1" data-testid="mock-delete-soft" />
            <div>
              <p className="text-xs font-medium text-[var(--color-text)]">Hide (recommended)</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">Deactivates the firm — learners can&apos;t see it. Existing attempts stay intact. Reversible.</p>
            </div>
          </label>
          <label className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer ${hard ? 'border-red-500/50 bg-red-500/5' : 'border-[var(--color-border)]'}`}>
            <input type="radio" checked={hard} onChange={() => onSetHard(true)} className="mt-1" data-testid="mock-delete-hard" />
            <div>
              <p className="text-xs font-medium text-red-500">Hard delete</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                Permanently removes the firm{hasAttempts ? ' AND cascades to ' + sim.attempts_count + ' learner attempt(s)' : ''}. Cannot be undone.
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-[var(--color-border)] text-xs" data-testid="mock-delete-cancel">Cancel</button>
          <button onClick={onConfirm}
                  className={`px-4 py-1.5 rounded-md text-white text-xs ${hard ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                  data-testid="mock-delete-confirm">
            {hard ? 'Delete permanently' : 'Hide firm'}
          </button>
        </div>
      </div>
    </div>
  );
}
