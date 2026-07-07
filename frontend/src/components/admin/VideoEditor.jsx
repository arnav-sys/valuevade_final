/**
 * Phase B.2 — Video editor for the Admin Curriculum tab.
 * Wraps the direct-to-Supabase upload flow (bypasses nginx 1 MB body cap)
 * for a single session. Also supports Delete and a small inline preview.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Trash2, Loader2, Play } from 'lucide-react';

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

export default function VideoEditor({ sessionId, sessionTitle, lectureUrl, onChange }) {
  const [busy, setBusy] = useState(null);       // 'upload' | 'delete' | null
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState(null);
  const [current, setCurrent] = useState(lectureUrl || null);

  useEffect(() => { setCurrent(lectureUrl || null); }, [lectureUrl]);

  const upload = async (file) => {
    setBusy('upload'); setProgress(0); setErr(null);
    try {
      const signed = await req(`/api/admin/sessions/${sessionId}/video-signed-url`, 'POST', {});
      if (!signed?.upload_url) throw new Error('missing signed upload URL');
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signed.upload_url);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`storage upload ${xhr.status}: ${xhr.responseText?.slice(0, 200)}`));
        };
        xhr.onerror = () => reject(new Error('network error during upload'));
        xhr.send(file);
      });
      const saved = await req(`/api/admin/sessions/${sessionId}/video-url`, 'POST', {
        public_url: signed.public_url,
      });
      // cache-bust for immediate preview
      const busted = `${saved.lecture_url}?t=${Date.now()}`;
      setCurrent(busted);
      onChange?.(saved.lecture_url);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); setProgress(0); }
  };

  const pickAndUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 500 * 1024 * 1024) {
        setErr(`File too large (${(f.size / 1048576).toFixed(1)} MB). Max 500 MB.`);
        return;
      }
      upload(f);
    };
    input.click();
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

      <div className="flex gap-2">
        <button
          onClick={pickAndUpload}
          disabled={busy !== null}
          data-testid="video-upload-btn"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110 disabled:opacity-50"
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

      {busy === 'upload' && (
        <div className="mt-2 h-1 bg-[var(--color-surface)] rounded overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${progress}%` }}
            data-testid="video-upload-progress"
          />
        </div>
      )}

      {err && <p className="text-xs text-red-500 mt-2" data-testid="video-editor-error">{err}</p>}

      <p className="text-[10px] text-[var(--color-text-muted)] mt-4">
        Uploads go directly to Supabase Storage. Max 500 MB · MP4 or WEBM.
      </p>
    </div>
  );
}
