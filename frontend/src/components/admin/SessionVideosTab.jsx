import React, { useState, useEffect } from 'react';
import { authFetch, authPost, authFetchJson, fmt } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Search, Upload, Trash2, Play, Loader2, Check, Link2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function VideoPreviewModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="admin-video-preview">
      <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        <video src={src} controls autoPlay className="w-full rounded-lg border border-[var(--color-primary)]/40" />
        <div className="text-right mt-2">
          <button onClick={onClose} className="px-3 py-1 rounded text-sm border border-[var(--color-border)] text-[var(--color-text)]">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function SessionVideosTab() {
  const [data, setData]         = useState(null);
  const [err, setErr]           = useState(null);
  const [selectedModule, setSelectedModule] = useState('');
  const [search, setSearch]     = useState('');
  const [busy, setBusy]         = useState({});
  const [progress, setProgress] = useState({});
  const [preview, setPreview]   = useState(null);

  const reload = () => authFetchJson('/api/admin/sessions/videos').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (data?.modules?.length && !selectedModule) setSelectedModule(String(data.modules[0].module_number || ''));
  }, [data, selectedModule]);

  const uploadFor = async (session_id, file) => {
    setBusy((b) => ({ ...b, [session_id]: 'upload' }));
    setProgress((p) => ({ ...p, [session_id]: 0 }));
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error('You must be signed in as admin.');
      const created = await authPost(`/api/admin/sessions/${session_id}/tus-create-upload`, { upload_length: file.size, content_type: file.type || 'video/mp4' });
      if (!created?.location) throw new Error('Backend did not return a TUS upload location.');
      const CHUNK = 8 * 1024 * 1024;
      let offset = 0;
      while (offset < file.size) {
        const end = Math.min(offset + CHUNK, file.size);
        const blob = file.slice(offset, end);
        const fd = new FormData();
        fd.append('location', created.location); fd.append('offset', String(offset)); fd.append('chunk', blob, 'chunk.bin');
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const r = await fetch(`${API}/api/admin/tus-patch-chunk`, { method: 'POST', headers: { Authorization: `Bearer ${authSession.access_token}` }, body: fd });
            if (!r.ok) { const txt = await r.text(); throw new Error(`chunk ${offset}-${end} failed [${r.status}]: ${txt.slice(0, 200)}`); }
            // eslint-disable-next-line no-await-in-loop
            const j = await r.json();
            offset = typeof j.upload_offset === 'number' && j.upload_offset > offset ? j.upload_offset : end;
            setProgress((p) => ({ ...p, [session_id]: Math.round((offset / file.size) * 100) }));
            break;
          } catch (e) {
            attempt += 1;
            if (attempt > 3) throw e;
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 800 * attempt));
          }
        }
      }
      await authPost(`/api/admin/sessions/${session_id}/video-url`, { public_url: created.public_url });
      await reload();
    } catch (e) { alert(`Upload failed: ${e.message}`); }
    finally {
      setBusy((b) => { const n = { ...b }; delete n[session_id]; return n; });
      setProgress((p) => { const n = { ...p }; delete n[session_id]; return n; });
    }
  };

  const pickAndUpload = (session_id) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/mp4,video/webm,video/quicktime';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 50 * 1024 * 1024 * 1024) { alert(`File too large (${(f.size/1073741824).toFixed(2)} GB). Max 50 GB.`); return; }
      uploadFor(session_id, f);
    };
    input.click();
  };

  const pasteUrlFor = async (session_id, title) => {
    const u = window.prompt(`Paste an external video URL for "${title}":\n\nUse this for 30-min+ videos that exceed the Supabase Storage cap.\nSupported: YouTube, Vimeo, Cloudflare Stream, Mux, BunnyCDN, any direct .mp4 link.`, '');
    if (!u || !u.trim()) return;
    const url = u.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) { alert('URL must start with http:// or https://'); return; }
    setBusy((b) => ({ ...b, [session_id]: 'url' }));
    try { await authPost(`/api/admin/sessions/${session_id}/video-url`, { public_url: url }); await reload(); }
    catch (e) { alert(`Save URL failed: ${e.message}`); }
    finally { setBusy((b) => { const n = { ...b }; delete n[session_id]; return n; }); }
  };

  const deleteVideo = async (session_id, title) => {
    if (!window.confirm(`Remove the video for "${title}"?`)) return;
    setBusy((b) => ({ ...b, [session_id]: 'delete' }));
    try { await authFetchJson(`/api/admin/sessions/${session_id}/video`, { method: 'DELETE' }); await reload(); }
    catch (e) { alert(`Delete failed: ${e.message}`); }
    finally { setBusy((b) => { const n = { ...b }; delete n[session_id]; return n; }); }
  };

  if (err) return <div className="text-red-500 p-4" data-testid="admin-videos-error">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;

  const mod = data.modules.find((m) => String(m.module_number) === selectedModule) || data.modules[0];
  const sessions = mod ? mod.sessions.filter((s) => !search || (s.title || '').toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <div data-testid="admin-videos-tab">
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] font-mono" data-testid="admin-videos-module-select">
          {data.modules.map((m) => (<option key={m.module_id} value={m.module_number || ''}>M{m.module_number} · {m.module_title.slice(0, 46)}</option>))}
        </select>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search session titles…" className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" data-testid="admin-videos-search" />
        </div>
        <div className="ml-auto text-xs font-mono text-[var(--color-text-muted)]">{sessions.filter((s) => s.has_video).length} / {sessions.length} uploaded</div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-[11px] font-mono uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left w-20">Module.Session</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left w-40">Status</th>
              <th className="p-3 text-right w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const rowBusy = busy[s.id];
              const pct = progress[s.id];
              return (
                <tr key={s.id} className="border-t border-[var(--color-border)]" data-testid={`admin-video-row-${s.id}`}>
                  <td className="p-3 font-mono text-xs text-[var(--color-text-muted)]">M{mod.module_number}.{s.order_index}</td>
                  <td className="p-3 text-[var(--color-text)]">{s.title}</td>
                  <td className="p-3">
                    {s.has_video ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-400 text-[11px] font-mono">
                        <Check size={11} /> Uploaded
                        <button onClick={() => setPreview(s.lecture_url)} className="ml-1 text-green-300 hover:text-green-100 flex items-center gap-1" data-testid={`admin-video-preview-${s.id}`}><Play size={10} /> Preview</button>
                      </span>
                    ) : (<span className="text-[11px] font-mono text-[var(--color-text-faint)]">No video</span>)}
                    {rowBusy === 'upload' && pct != null && (<div className="mt-1 h-1 w-32 bg-[var(--color-surface)] rounded-full overflow-hidden"><div className="h-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} /></div>)}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {rowBusy ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-muted)]"><Loader2 size={12} className="animate-spin" />{rowBusy === 'upload' ? `${pct ?? 0}%` : 'deleting…'}</span>
                      ) : (
                        <>
                          <button onClick={() => pickAndUpload(s.id)} className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 flex items-center gap-1" data-testid={`admin-video-upload-${s.id}`}>
                            <Upload size={11} /> {s.has_video ? 'Replace' : 'Upload'}
                          </button>
                          <button onClick={() => pasteUrlFor(s.id, s.title)} className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-[var(--color-accent-purple)]/40 bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] hover:bg-[var(--color-accent-purple)]/20 flex items-center gap-1" data-testid={`admin-video-url-${s.id}`} title="Paste external video URL">
                            <Link2 size={11} /> URL
                          </button>
                          {s.has_video && (
                            <button onClick={() => deleteVideo(s.id, s.title)} className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1" data-testid={`admin-video-delete-${s.id}`}>
                              <Trash2 size={11} /> Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sessions.length === 0 && (<tr><td colSpan={4} className="p-6 text-center text-[var(--color-text-muted)] text-sm">No sessions match this filter.</td></tr>)}
          </tbody>
        </table>
      </div>
      <VideoPreviewModal src={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
