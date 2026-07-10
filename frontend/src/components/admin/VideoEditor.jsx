/**
 * VideoEditor — TUS proxy upload flow.
 *
 * We can't use tus-js-client directly against Supabase because RLS on
 * storage.objects blocks admin JWTs on TUS PATCH. Instead:
 *   1. Backend pre-creates a TUS session with service_role → Location URL.
 *   2. FE splits file into ≤8 MB chunks and POSTs each via
 *      /api/admin/tus-patch-chunk (multipart). Backend forwards each chunk
 *      to the Location URL with service_role → 204 → returns new offset.
 * This bypasses RLS entirely without exposing service_role to the browser.
 */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Trash2, Loader2, Play, Link2, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per chunk — well under the ingress body cap.

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
  let j = null; try { j = text ? JSON.parse(text) : null; } catch (_e) { /* noop */ }
  if (!r.ok) throw new Error((j && (j.detail || j.message)) || text || `${r.status}`);
  return j;
}

async function patchChunkViaProxy(location, offset, chunkBlob, accessToken, signal) {
  const fd = new FormData();
  fd.append('location', location);
  fd.append('offset', String(offset));
  fd.append('chunk', chunkBlob, 'chunk.bin');
  const r = await fetch(`${API}/api/admin/tus-patch-chunk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: fd,
    signal,
  });
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch (_e) { /* noop */ }
  if (!r.ok) throw new Error((j && (j.detail || j.message)) || text || `${r.status}`);
  return j.upload_offset;
}

async function uploadWithChunkProxy(sessionId, file, onProgress, abortSignal) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in as admin to upload.');

  // 1) Pre-create the TUS session (backend, service_role, bypasses RLS).
  const created = await req(`/api/admin/sessions/${sessionId}/tus-create-upload`, 'POST', {
    upload_length: file.size,
    content_type: file.type || 'video/mp4',
  });
  if (!created?.location) throw new Error('Backend did not return a TUS upload location.');

  // 2) Stream chunks through the backend proxy until the whole file is uploaded.
  let offset = 0;
  while (offset < file.size) {
    if (abortSignal?.aborted) throw new Error('Upload cancelled.');
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const blob = file.slice(offset, end);
    let attempt = 0;
    // Retry each chunk up to 3 times on transient failures.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const newOffset = await patchChunkViaProxy(created.location, offset, blob, session.access_token, abortSignal);
        offset = typeof newOffset === 'number' && newOffset > offset ? newOffset : end;
        onProgress(Math.round((offset / file.size) * 100));
        break;
      } catch (e) {
        attempt += 1;
        if (attempt > 3) throw e;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }
  return created.public_url;
}

export default function VideoEditor({ sessionId, sessionTitle, lectureUrl, onChange }) {
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState(null);
  const [current, setCurrent] = useState(lectureUrl || null);
  const [urlPanelOpen, setUrlPanelOpen] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const abortRef = useRef(null);

  useEffect(() => { setCurrent(lectureUrl || null); }, [lectureUrl]);

  const upload = async (file) => {
    setBusy('upload'); setProgress(0); setErr(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const publicUrl = await uploadWithChunkProxy(sessionId, file, setProgress, controller.signal);
      const saved = await req(`/api/admin/sessions/${sessionId}/video-url`, 'POST', {
        public_url: publicUrl,
      });
      const busted = `${saved.lecture_url}?t=${Date.now()}`;
      setCurrent(busted);
      onChange?.(saved.lecture_url);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); setProgress(0); abortRef.current = null; }
  };

  const pickAndUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/quicktime';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 50 * 1024 * 1024 * 1024) {
        setErr(`File too large (${(f.size / 1073741824).toFixed(2)} GB). Max 50 GB.`);
        return;
      }
      upload(f);
    };
    input.click();
  };

  const saveExternalUrl = async () => {
    const u = externalUrl.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      setErr('URL must start with http:// or https://');
      return;
    }
    setBusy('url'); setErr(null);
    try {
      const saved = await req(`/api/admin/sessions/${sessionId}/video-url`, 'POST', {
        public_url: u,
      });
      const busted = `${saved.lecture_url}?t=${Date.now()}`;
      setCurrent(busted);
      onChange?.(saved.lecture_url);
      setUrlPanelOpen(false);
      setExternalUrl('');
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const del = async () => {
    if (!window.confirm('Delete the video for this session?')) return;
    setBusy('delete'); setErr(null);
    try {
      await req(`/api/admin/sessions/${sessionId}/video`, 'DELETE');
      setCurrent(null);
      onChange?.(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  if (!sessionId) return <p className="text-sm text-[var(--color-text-muted)]">Select a session on the left.</p>;

  return (
    <div className="flex flex-col h-full" data-testid="video-editor">
      <div className="mb-3">
        <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Lecture video</p>
        <p className="text-sm text-[var(--color-text)] truncate" title={sessionTitle}>{sessionTitle}</p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] p-3 mb-3" data-testid="video-status">
        <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] mb-1">Current</p>
        {current ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-success)]" />
              <span className="text-xs text-[var(--color-text)]">Video attached</span>
              <button
                onClick={() => setPreview((v) => !v)}
                data-testid="video-preview-toggle"
                className="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:underline"
              >
                <Play size={11} /> {preview ? 'Hide' : 'Preview'}
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono break-all">{current}</p>
            {preview && (
              <video
                src={current}
                controls
                data-testid="video-preview-player"
                className="w-full rounded-md border border-[var(--color-border)]"
              >
                <track kind="captions" />
              </video>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />
            <span className="text-xs text-[var(--color-text-muted)]">No video attached</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={pickAndUpload}
          disabled={busy !== null}
          data-testid="video-upload-btn"
          className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110 disabled:opacity-50"
        >
          {busy === 'upload' ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Uploading… {progress}%
            </>
          ) : (
            <>
              <Upload size={13} />
              {current ? 'Replace' : 'Upload'} video
            </>
          )}
        </button>
        <button
          onClick={() => { setUrlPanelOpen((v) => !v); setErr(null); }}
          disabled={busy !== null}
          data-testid="video-url-btn"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--color-border)] text-[var(--color-text)] text-xs hover:bg-[var(--color-surface)] disabled:opacity-50"
          title="For videos hosted externally (YouTube/Vimeo/Cloudflare Stream/Mux/BunnyCDN)."
        >
          <Link2 size={13} /> Use URL
        </button>
        {current && (
          <button
            onClick={del}
            disabled={busy !== null}
            data-testid="video-delete-btn"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-red-500/50 text-red-500 text-xs hover:bg-red-500/10 disabled:opacity-50"
          >
            {busy === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete
          </button>
        )}
      </div>

      {urlPanelOpen && (
        <div className="mt-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40" data-testid="video-url-panel">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Paste external video URL</p>
            <button onClick={() => setUrlPanelOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="video-url-close">
              <X size={12} />
            </button>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-2 font-bricolage leading-relaxed">
            Host the video on YouTube, Vimeo, Cloudflare Stream, Mux, or BunnyCDN and paste the direct/embed URL below.
          </p>
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://your-cdn.example.com/lecture.mp4  or  https://youtu.be/…"
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-mono outline-none focus:border-[var(--color-primary)]"
            data-testid="video-url-input"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={saveExternalUrl}
              disabled={busy !== null || !externalUrl.trim()}
              data-testid="video-url-save"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs hover:brightness-110 disabled:opacity-50"
            >
              {busy === 'url' ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              Save URL
            </button>
          </div>
        </div>
      )}

      {busy === 'upload' && (
        <div className="mt-2 h-1 bg-[var(--color-surface)] rounded overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${progress}%` }}
            data-testid="video-upload-progress"
          />
        </div>
      )}

      {err && <p className="text-xs text-red-500 mt-2 font-bricolage leading-relaxed" data-testid="video-editor-error">{err}</p>}

      <p className="text-[10px] text-[var(--color-text-muted)] mt-4 font-bricolage leading-relaxed">
        Uploads are chunked (8 MB) through the backend so they bypass Supabase RLS and support the full 50 GB Pro ceiling.
        Long videos may take several minutes — the tab must stay open while uploading.
      </p>
    </div>
  );
}
