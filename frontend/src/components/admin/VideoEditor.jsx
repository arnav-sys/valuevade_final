/**
 * Admin VideoEditor, upload / manage lecture videos for a session.
 * Now auto-extracts video_duration_minutes from picked files and
 * allows manual duration entry for external URLs.
 */
import { useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Trash2, ExternalLink, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

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

/** Extract video duration (minutes) from a File via a hidden <video> element. */
function extractDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const url = URL.createObjectURL(file);
    const cleanup = () => { try { URL.revokeObjectURL(url); } catch {} };
    v.onloadedmetadata = () => {
      const mins = v.duration > 0 ? Math.round((v.duration / 60) * 10) / 10 : null;
      cleanup();
      resolve(mins);
    };
    v.onerror = () => { cleanup(); resolve(null); };
    // Timeout guard (e.g. huge files where metadata loads slowly)
    setTimeout(() => { cleanup(); resolve(null); }, 10000);
    v.src = url;
  });
}

function fmt(mins) {
  if (!mins) return null;
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

const CHUNK = 2 * 1024 * 1024; // 2 MB

export default function VideoEditor({ sessionId, lectureUrl: initialUrl, initialDurationMins, onChangeUrl }) {
  const [lectureUrl, setLectureUrl] = useState(initialUrl || '');
  const [urlInput, setUrlInput]     = useState(initialUrl || '');
  const [urlDuration, setUrlDuration] = useState(''); // manual duration input for URL
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [status, setStatus]         = useState('');
  const [err, setErr]               = useState(null);
  const [durationMins, setDurationMins] = useState(initialDurationMins ?? null); // extracted from file or passed from parent
  const inputRef = useRef(null);
  const abortRef = useRef(false);

  // ── chunked file upload ────────────────────────────────────────────────────
  const upload = useCallback(async (file) => {
    if (!sessionId) { setErr('Select a session first'); return; }
    abortRef.current = false;
    setUploading(true);
    setProgress(0);
    setErr(null);
    setDurationMins(null);

    // 1. Extract duration from file (non-blocking race against upload)
    setStatus('Reading video metadata…');
    const duration = await extractDuration(file);
    setDurationMins(duration);

    // 2. Chunked upload
    setStatus('Uploading…');
    const total = Math.ceil(file.size / CHUNK);
    let publicUrl = null;

    try {
      for (let i = 0; i < total; i++) {
        if (abortRef.current) throw new Error('Upload cancelled');
        const chunk = file.slice(i * CHUNK, (i + 1) * CHUNK);
        const form  = new FormData();
        form.append('chunk', chunk, file.name);
        form.append('chunk_index', String(i));
        form.append('total_chunks', String(total));
        form.append('filename', file.name);

        const { data: { session: supa } } = await supabase.auth.getSession();
        const r = await fetch(`${API}/api/admin/sessions/${sessionId}/upload-chunk-proxy`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${supa?.access_token || ''}` },
          body: form,
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.detail || `Chunk ${i} failed`);
        setProgress(Math.round(((i + 1) / total) * 90));
        if (j.public_url) publicUrl = j.public_url;
      }
    } catch (e) {
      setErr(e.message);
      setUploading(false);
      setStatus('');
      return;
    }

    if (!publicUrl) { setErr('Upload finished but no URL returned.'); setUploading(false); return; }

    // 3. Save lecture_url + video_duration_minutes
    setStatus('Saving…');
    try {
      await req(`/api/admin/sessions/${sessionId}/video-url`, 'POST', {
        public_url: publicUrl,
        ...(duration != null ? { video_duration_minutes: duration } : {}),
      });
      setLectureUrl(publicUrl);
      setUrlInput(publicUrl);
      setProgress(100);
      setStatus('');
      onChangeUrl?.(publicUrl, duration);
    } catch (e) {
      setErr(`Saved video but couldn't record URL: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }, [sessionId, onChangeUrl]);

  // ── external URL save ──────────────────────────────────────────────────────
  const saveExternalUrl = async () => {
    if (!sessionId) { setErr('Select a session first'); return; }
    if (!urlInput.trim()) { setErr('Enter a URL'); return; }
    setErr(null);
    const durMins = urlDuration ? parseFloat(urlDuration) : null;
    try {
      await req(`/api/admin/sessions/${sessionId}/video-url`, 'POST', {
        public_url: urlInput.trim(),
        ...(durMins != null && durMins > 0 ? { video_duration_minutes: durMins } : {}),
      });
      setLectureUrl(urlInput.trim());
      setDurationMins(durMins);
      onChangeUrl?.(urlInput.trim(), durMins);
    } catch (e) { setErr(e.message); }
  };

  // ── delete video ──────────────────────────────────────────────────────────
  const del = async () => {
    if (!window.confirm('Remove this video? This also clears the stored duration.')) return;
    try {
      await req(`/api/admin/sessions/${sessionId}/video`, 'DELETE');
      setLectureUrl('');
      setUrlInput('');
      setDurationMins(null);
      setUrlDuration('');
      onChangeUrl?.(null, null);
    } catch (e) { setErr(e.message); }
  };

  if (!sessionId) return (
    <p className="text-sm text-[var(--color-text-muted)]">Select a session on the left.</p>
  );

  return (
    <div className="space-y-4" data-testid="video-editor">
      {/* Current video status */}
      {lectureUrl ? (
        <div className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={16} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text)] mb-1">Video attached</p>
              <a
                href={lectureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:underline break-all font-mono"
                data-testid="video-url-link"
              >
                <ExternalLink size={10} /> {lectureUrl.length > 60 ? `${lectureUrl.slice(0, 57)}…` : lectureUrl}
              </a>
              {/* Duration badge */}
              {durationMins != null ? (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)]">
                  <Clock size={9} /> {fmt(durationMins)} video
                </span>
              ) : (
                <p className="text-[9px] text-[var(--color-text-faint)] mt-1.5 font-mono">
                  Duration not set, re-upload file or enter below to enable dynamic timing
                </p>
              )}
            </div>
            <button
              onClick={del}
              className="text-[var(--color-text-muted)] hover:text-red-500 flex-shrink-0"
              data-testid="delete-video-btn"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Manual duration override when no duration was extracted */}
          {durationMins == null && (
            <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border)]">
              <Clock size={12} className="text-[var(--color-text-muted)] flex-shrink-0" />
              <input
                type="number"
                min="1"
                max="600"
                step="0.5"
                placeholder="Duration in minutes (e.g. 42)"
                value={urlDuration}
                onChange={(e) => setUrlDuration(e.target.value)}
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                data-testid="manual-duration-input"
              />
              <button
                onClick={async () => {
                  const d = parseFloat(urlDuration);
                  if (!d || d <= 0) { setErr('Enter a valid duration'); return; }
                  try {
                    await req(`/api/admin/sessions/${sessionId}/video-url`, 'POST', {
                      public_url: lectureUrl,
                      video_duration_minutes: d,
                    });
                    setDurationMins(d);
                    setErr(null);
                    onChangeUrl?.(lectureUrl, d);
                  } catch (e) { setErr(e.message); }
                }}
                disabled={!urlDuration}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:brightness-110 disabled:opacity-40"
                data-testid="save-duration-btn"
              >
                Save
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Upload new file */}
      {!lectureUrl && (
        <>
          <div
            onClick={() => !uploading && inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/50 bg-[var(--color-surface)]/30 hover:bg-[var(--color-primary)]/5 transition-all p-6 flex flex-col items-center gap-2 cursor-pointer ${uploading ? 'opacity-60 cursor-wait' : ''}`}
            data-testid="video-upload-dropzone"
          >
            {uploading ? (
              <>
                <Loader2 size={22} className="animate-spin text-[var(--color-primary)]" />
                <span className="text-xs text-[var(--color-text-muted)]">{status}</span>
                <div className="w-full max-w-xs h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{progress}%</span>
              </>
            ) : (
              <>
                <Upload size={22} className="text-[var(--color-text-muted)]" />
                <span className="text-xs font-semibold text-[var(--color-text)]">Upload video file</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">MP4 / MOV / WEBM · Duration extracted automatically</span>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            data-testid="video-file-input"
          />
        </>
      )}

      {/* External URL panel */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
          {lectureUrl ? 'Update URL' : 'Or paste external URL (YouTube, Vimeo, etc.)'}
        </p>
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…"
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
            data-testid="video-url-input"
          />
          <button
            onClick={saveExternalUrl}
            disabled={!urlInput.trim()}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:brightness-110 disabled:opacity-40"
            data-testid="save-url-btn"
          >
            Save
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-[var(--color-text-muted)]" />
          <input
            type="number"
            min="1"
            max="600"
            step="0.5"
            placeholder="Video duration in minutes (e.g. 42)"
            value={urlDuration}
            onChange={(e) => setUrlDuration(e.target.value)}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
            data-testid="url-duration-input"
          />
        </div>
        <p className="text-[9px] text-[var(--color-text-faint)] font-mono">
          For YouTube/Vimeo, duration can't be auto-extracted, enter it manually to enable accurate session timing.
        </p>
      </div>

      {/* Error */}
      {err && (
        <div className="flex items-center gap-2 text-xs text-red-500" data-testid="video-editor-error">
          <AlertCircle size={12} /> {err}
        </div>
      )}

      <p className="text-[10px] text-[var(--color-text-faint)] font-mono">
        Duration auto-extracted when uploading a file. Used in study planner and course timing calculations.
      </p>
    </div>
  );
}
