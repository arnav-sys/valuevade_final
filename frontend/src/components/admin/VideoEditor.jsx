/**
 * Phase B.2 — Video editor for the Admin Curriculum tab.
 *
 * Uses TUS resumable uploads (tus-js-client) authenticated with the admin's
 * Supabase JWT — bypasses the 50 MB cap on anon/signed-URL uploads and lets
 * Pro-plan projects push files up to 50 GB (bucket + global-limit permitting).
 *
 * Fallback: paste an external URL (YouTube / Vimeo / Cloudflare Stream / Mux /
 * BunnyCDN) for cases where the project global upload cap has not been raised
 * from the 50 MB default.
 */
import { useEffect, useState, useRef } from 'react';
import * as tus from 'tus-js-client';
import { supabase } from '../../lib/supabase';
import { Upload, Trash2, Loader2, Play, Link2, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const VIDEO_BUCKET = 'session-videos';
const CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB — the TUS chunk size required by Supabase Storage

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

// Slugify a filename so Supabase Storage accepts the object key.
function safeKey(name) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
  return `${stem.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'video'}${ext || '.mp4'}`;
}

async function uploadTusResumable(file, objectPath, onProgress) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in as admin to upload.');

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: VIDEO_BUCKET,
        objectName: objectPath,
        contentType: file.type || 'video/mp4',
        cacheControl: '3600',
      },
      chunkSize: CHUNK_SIZE,
      allowedMetaFields: ['bucketName', 'objectName', 'contentType', 'cacheControl'],
      onError: (err) => {
        // Surface the Supabase 413 message clearly.
        const status = err?.originalResponse?.getStatus?.();
        if (status === 413) {
          reject(new Error(
            'File exceeds the Supabase Storage upload cap on this project. '
            + 'Even on the Pro plan the default is 50 MB — go to Supabase Dashboard → '
            + 'Storage → Settings → "Global upload file size limit" and raise it (up to '
            + '50 GB on Pro). Then reload this page and try again. As an alternative, use '
            + '"Use URL" below to attach a YouTube / Vimeo / Cloudflare Stream / Mux / BunnyCDN link.'
          ));
        } else {
          reject(new Error(err?.message || String(err)));
        }
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${objectPath}`;
        resolve(publicUrl);
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    });
  });
}

export default function VideoEditor({ sessionId, sessionTitle, lectureUrl, onChange }) {
  const [busy, setBusy] = useState(null);       // 'upload' | 'delete' | 'url' | null
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
    try {
      const objectPath = `${sessionId}/${Date.now()}-${safeKey(file.name)}`;
      const publicUrl = await uploadTusResumable(file, objectPath, setProgress);
      const saved = await req(`/api/admin/sessions/${sessionId}/video-url`, 'POST', {
        public_url: publicUrl,
      });
      const busted = `${saved.lecture_url}?t=${Date.now()}`;
      setCurrent(busted);
      onChange?.(saved.lecture_url);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); setProgress(0); }
  };

  const pickAndUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/quicktime';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      // 50 GB frontend guardrail (matches Supabase Pro-tier ceiling for TUS resumable uploads).
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
          title="Use for 30-min+ videos when you can't (or don't want to) upload to Supabase Storage."
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
        Uploads use TUS resumable transfer (auto-retries, chunked 6 MB) — up to 50 GB on Pro. If you hit a 413 error,
        raise the &ldquo;Global upload file size limit&rdquo; in Supabase Dashboard → Storage → Settings, then reload.
      </p>
    </div>
  );
}
