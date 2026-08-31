import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Gift, Linkedin, CheckCircle2, Download, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

// Must match backend regex in wave_endpoints.py (_LINKEDIN_POST_RE).
// Accepts /posts/, /feed/update/, /pulse/, /embed/feed/update/ on linkedin.com,
// plus LinkedIn's own shortened lnkd.in share links.
const LINKEDIN_POST_RE =
  /^https?:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/(?:posts\/|feed\/update\/|pulse\/|embed\/feed\/update\/)[^\s]+$|^https?:\/\/(?:www\.)?lnkd\.in\/[^\s]+$/i;

/**
 * RewardCard — shown on ModuleProjectCompletePage + CapstoneCompletePage
 * whenever the user has just unlocked a "share on LinkedIn → free resource"
 * reward.
 *
 * Feb 2026 UX flow:
 *   1) Card shows the reward title + description + a preview of the standard
 *      LinkedIn post text (no AI).
 *   2) User clicks "Share on LinkedIn" → opens LinkedIn's share intent in a
 *      new tab with the pre-composed text.
 *   3) After posting, the learner copies the URL of that LinkedIn post (⋯ →
 *      "Copy link to post") and pastes it into the required input field.
 *   4) The "I've shared — unlock my resource" button unlocks ONLY after (a)
 *      the share intent was opened AND (b) a valid LinkedIn post URL is
 *      pasted. Backend re-validates the URL before granting the reward.
 *   5) On success we call /api/rewards/claim → server verifies eligibility,
 *      persists the LinkedIn URL, upserts the claim row, and returns a signed
 *      download URL that immediately triggers the download.
 *   6) Once claimed, the card stays visible with a "Downloaded" state and a
 *      Re-download button (fresh signed URL each time).
 */
export default function RewardCard({ trigger, refId, testidPrefix = 'reward' }) {
  const [reward, setReward] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const fetchRewards = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setLoading(false); return; }
      const res = await fetch(`${BACKEND}/api/rewards/eligible`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!data.table_ready) { setLoading(false); return; }
      // Find the reward whose trigger matches the current page's trigger.
      const match = (data.rewards || []).find(
        (r) => r.eligible && r.trigger_type === trigger && r.trigger_ref_id === refId
      );
      setReward(match || null);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [trigger, refId]);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  if (loading) return null;
  if (!reward) return null;

  const linkedinText = (reward.linkedin_message && reward.linkedin_message.trim()) ||
    // Standard fallback template — no AI.
    `I just finished a major milestone in my equity research journey on Valuevade — the "${reward.title}" milestone. Excited to keep building analyst-grade skills. #EquityResearch #InvestmentBanking #Finance #LearningJourney`;

  const shareUrl = 'https://www.linkedin.com/feed/';
  const composeUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(linkedinText)}`;

  const openShare = () => {
    window.open(composeUrl, '_blank', 'noopener,noreferrer,width=650,height=650');
    setShared(true);
  };

  const trimmedUrl = postUrl.trim();
  const urlLooksValid = LINKEDIN_POST_RE.test(trimmedUrl);
  const canClaim = shared && urlLooksValid && !claiming;

  const claim = async () => {
    // Client-side guard; backend also re-validates.
    if (!urlLooksValid) {
      setUrlError('Paste the URL of your LinkedIn post (⋯ menu → "Copy link to post").');
      return;
    }
    setUrlError('');
    setClaiming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sign in first');
      const res = await fetch(`${BACKEND}/api/rewards/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reward_id: reward.id, linkedin_post_url: trimmedUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.detail?.message || data?.detail || 'Failed to unlock';
        // Backend surface for URL validation errors → highlight the input.
        const reason = data?.detail?.reason;
        if (reason === 'linkedin_post_url_invalid' || reason === 'linkedin_post_url_required') {
          setUrlError(typeof msg === 'string' ? msg : 'Invalid LinkedIn post URL.');
        }
        throw new Error(typeof msg === 'string' ? msg : 'Failed to unlock');
      }
      if (data.download_url) {
        const a = document.createElement('a');
        a.href = data.download_url;
        a.download = data.resource_file_name || 'reward';
        a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
      toast.success('Reward unlocked! Your download has started.');
      fetchRewards();
    } catch (e) {
      toast.error(e.message || 'Failed to unlock reward');
    } finally {
      setClaiming(false);
    }
  };

  const redownload = async () => {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${BACKEND}/api/rewards/${reward.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.download_url) throw new Error(data?.detail || 'Download failed');
      const a = document.createElement('a');
      a.href = data.download_url;
      a.download = data.resource_file_name || 'reward';
      a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      toast.error(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const alreadyClaimed = reward.claimed;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-6 bg-gradient-to-br from-[#f59e0b]/12 via-[var(--color-accent-pink)]/8 to-[var(--color-accent-purple)]/12 border border-[#f59e0b]/40 shadow-[0_0_24px_rgba(245,158,11,0.15)]"
      data-testid={`${testidPrefix}-card`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-[#f59e0b]/25 border border-[#f59e0b]/50 text-[#f59e0b] flex items-center justify-center shrink-0">
          <Gift size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#f59e0b] mb-1">
            Free resource unlocked
          </div>
          <h3 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] leading-tight" data-testid={`${testidPrefix}-title`}>
            {reward.title}
          </h3>
          {reward.description && (
            <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed mt-1.5" data-testid={`${testidPrefix}-desc`}>
              {reward.description}
            </p>
          )}
        </div>
      </div>

      {!alreadyClaimed && (
        <>
          <div className="rounded-lg bg-[var(--color-surface)]/60 border border-[var(--color-border)] p-3 mb-4 font-bricolage text-xs text-[var(--color-text-muted)] leading-relaxed" data-testid={`${testidPrefix}-linkedin-preview`}>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] mb-1.5">
              Your LinkedIn post
            </div>
            {linkedinText}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <button
              onClick={openShare}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-bricolage transition-all ${
                shared
                  ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/40'
                  : 'bg-[#0A66C2] text-white hover:bg-[#0855A6] hover:shadow-[0_0_18px_rgba(10,102,194,0.4)]'
              }`}
              data-testid={`${testidPrefix}-share-btn`}
            >
              {shared ? (
                <><CheckCircle2 size={16} /> Shared · Open post again</>
              ) : (
                <><Linkedin size={16} /> Share on LinkedIn <ExternalLink size={13} /></>
              )}
            </button>
          </div>

          {/* Mandatory LinkedIn post URL input */}
          <div className="mb-3">
            <label
              htmlFor={`${testidPrefix}-post-url-input`}
              className="block text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] mb-1.5"
            >
              Paste your LinkedIn post URL <span className="text-[#f59e0b]">*</span>
            </label>
            <input
              id={`${testidPrefix}-post-url-input`}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://www.linkedin.com/posts/your-name-activity-…"
              value={postUrl}
              onChange={(e) => {
                setPostUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              disabled={!shared || claiming}
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
              className={`w-full px-3 py-2.5 rounded-xl border font-bricolage text-sm placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                urlError
                  ? 'border-[var(--color-danger)]/60 focus:ring-[var(--color-danger)]/40'
                  : urlLooksValid
                  ? 'border-[var(--color-success)]/50 focus:ring-[var(--color-success)]/40'
                  : 'border-[var(--color-border)] focus:ring-[#f59e0b]/40 focus:border-[#f59e0b]/50'
              }`}
              data-testid={`${testidPrefix}-post-url-input`}
            />
            {urlError ? (
              <p className="text-[11px] font-mono text-[var(--color-danger)] mt-1.5" data-testid={`${testidPrefix}-post-url-error`}>
                {urlError}
              </p>
            ) : (
              <p className="text-[11px] font-mono text-[var(--color-text-faint)] mt-1.5">
                Open your post → click the <span className="text-[var(--color-text-muted)]">⋯</span> menu →
                &ldquo;Copy link to post&rdquo; → paste here.
              </p>
            )}
          </div>

          <button
            onClick={claim}
            disabled={!canClaim}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-bricolage bg-gradient-to-r from-[#f59e0b] to-[var(--color-accent-pink)] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            data-testid={`${testidPrefix}-claim-btn`}
          >
            {claiming ? (
              <><Loader2 size={14} className="animate-spin" /> Unlocking…</>
            ) : (
              <><Download size={16} /> I&apos;ve shared — unlock my resource</>
            )}
          </button>

          {!shared && (
            <p className="text-[11px] font-mono text-[var(--color-text-faint)] mt-2" data-testid={`${testidPrefix}-hint`}>
              Step 1: click &ldquo;Share on LinkedIn&rdquo;. Step 2: paste the post URL above. Step 3: unlock the resource.
            </p>
          )}
        </>
      )}

      {alreadyClaimed && (
        <div className="flex flex-col gap-2" data-testid={`${testidPrefix}-claimed`}>
          <div className="flex items-center gap-3">
            <div className="flex-1 inline-flex items-center gap-2 text-sm font-bricolage text-[var(--color-success)]">
              <CheckCircle2 size={16} /> You&apos;ve already claimed this resource.
            </div>
            <button
              onClick={redownload}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-bricolage bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 disabled:opacity-40 transition-all"
              data-testid={`${testidPrefix}-redownload-btn`}
            >
              {downloading ? <><Loader2 size={14} className="animate-spin" /> Downloading…</> : <><Download size={16} /> Re-download</>}
            </button>
          </div>
          {reward.linkedin_post_url && (
            <a
              href={reward.linkedin_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-faint)] hover:text-[#0A66C2] transition-colors truncate"
              data-testid={`${testidPrefix}-view-shared-post`}
            >
              <Linkedin size={12} /> View your shared post
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
