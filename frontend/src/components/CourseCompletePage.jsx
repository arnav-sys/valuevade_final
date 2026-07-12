/**
 * CourseCompletePage — Premium congratulations screen shown when a user
 * finishes ALL capstone projects in Valuevade. Lets them download a PDF
 * certificate with their full name and today's date.
 *
 * Route: /course-complete
 *
 * Detection: we count master_capstone_projects vs the user's
 * user_capstone_projects with is_completed=true. If they don't match, we
 * gently redirect back to /capstones.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import {
  Award, Sparkles, Download, ArrowRight, Loader2, CheckCircle2,
  TrendingUp, Layers, FileSpreadsheet, GitBranch, BookOpen, Trophy,
} from 'lucide-react';

// Small cosmic-dots background (same visual DNA as CapstoneCompletePage).
function Cosmic() {
  const particles = Array.from({ length: 60 });
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((_, i) => {
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const size = 1 + Math.random() * 3;
        const duration = 5 + Math.random() * 6;
        const delay = Math.random() * 5;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              background: 'white',
              borderRadius: '50%',
              opacity: 0,
              boxShadow: '0 0 6px rgba(255,255,255,0.4)',
              animation: `vvCourseTwinkle ${duration}s ease-in-out ${delay}s infinite`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvCourseTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes vvCourseFade {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes vvCourseGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(36,107,253,0.25); }
          50% { box-shadow: 0 0 60px rgba(106,92,255,0.45); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Certificate PDF generation (client-side jsPDF, landscape A4).
// ---------------------------------------------------------------------------
function generateCertificatePdf({ recipientName, issueDate, certId }) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297; const H = 210;

  // Background — cream/off-white for premium feel
  pdf.setFillColor(250, 249, 246); pdf.rect(0, 0, W, H, 'F');

  // Outer border — thin, in the Valuevade primary blue
  pdf.setDrawColor(36, 107, 253); pdf.setLineWidth(0.6);
  pdf.rect(10, 10, W - 20, H - 20);

  // Inner accent border (very thin)
  pdf.setDrawColor(190, 195, 210); pdf.setLineWidth(0.15);
  pdf.rect(13, 13, W - 26, H - 26);

  // Top-left monogram — "VV" mark
  pdf.setFillColor(36, 107, 253);
  pdf.rect(22, 22, 12, 12, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('VV', 28, 30, { align: 'center' });

  // Wordmark
  pdf.setTextColor(20, 24, 34);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('VALUEVADE', 40, 30);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 128, 145);
  pdf.text('EQUITY RESEARCH · FINANCIAL MODELLING · VALUATION', 40, 34.5);

  // Small "CERTIFICATE" eyebrow — top-right
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(120, 128, 145);
  pdf.text('CERTIFICATE OF COMPLETION', W - 22, 30, { align: 'right' });

  // Center headline
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(120, 128, 145);
  pdf.text('This is to certify that', W / 2, 68, { align: 'center' });

  // Recipient name — bold serif-y (we approximate with helvetica bold, large)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(38);
  pdf.setTextColor(20, 24, 34);
  pdf.text(recipientName || 'Recipient Name', W / 2, 88, { align: 'center' });

  // Divider line under name
  pdf.setDrawColor(36, 107, 253); pdf.setLineWidth(0.4);
  pdf.line(W / 2 - 55, 94, W / 2 + 55, 94);

  // Body — congratulatory copy
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(60, 66, 78);
  const body1 = 'has successfully completed the';
  pdf.text(body1, W / 2, 108, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(36, 107, 253);
  pdf.text('Equity Research, Financial Modelling & Valuation Programme', W / 2, 118, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(60, 66, 78);
  const line3 = 'including 22 modules, 246 sessions, 246 interactive simulations, and all 3 capstone projects.';
  pdf.text(line3, W / 2, 128, { align: 'center' });
  const line4 = 'They have demonstrated analyst-grade judgement in financial modelling, valuation, and equity research.';
  pdf.text(line4, W / 2, 135, { align: 'center' });

  // Footer — date left, signature/verification right
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(20, 24, 34);
  pdf.text('DATE OF ISSUE', 40, 176);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(issueDate, 40, 183);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('CERTIFICATE ID', W - 40, 176, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(certId, W - 40, 183, { align: 'right' });

  // Center seal — simple
  pdf.setDrawColor(36, 107, 253); pdf.setLineWidth(0.4);
  pdf.circle(W / 2, 178, 8);
  pdf.setFillColor(36, 107, 253);
  pdf.circle(W / 2, 178, 3.5, 'F');

  return pdf;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CourseCompletePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, allDone: false });
  const [fullName, setFullName] = useState('');
  const [askName, setAskName] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      try {
        // Fetch user's enrollment first — user_capstone_projects is scoped by enrollment_id.
        const { data: enrs } = await supabase.from('user_enrollments').select('id').eq('user_id', user.id).limit(1);
        const enrId = enrs && enrs[0] ? enrs[0].id : null;
        const [{ data: masterList }, userListRes, { data: profile }] = await Promise.all([
          supabase.from('master_capstone_projects').select('id'),
          enrId
            ? supabase.from('user_capstone_projects').select('capstone_id,is_completed').eq('enrollment_id', enrId).eq('is_completed', true)
            : Promise.resolve({ data: [] }),
          supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        ]);
        if (cancelled) return;
        const userList = userListRes.data || [];
        const totalCap = (masterList || []).length;
        const doneCap = new Set(userList.map((r) => r.capstone_id)).size;
        const allDone = totalCap > 0 && doneCap >= totalCap;
        setFullName(profile?.full_name || '');
        setState({ loading: false, allDone, totalCap, doneCap });
      } catch (e) {
        setState({ loading: false, allDone: false, error: e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleDownload = async () => {
    let name = (fullName || '').trim();
    if (!name) { setAskName(true); setTimeout(() => nameInputRef.current?.focus(), 50); return; }
    setDownloading(true);
    try {
      // Persist full_name for next time (best-effort)
      try { await supabase.from('profiles').update({ full_name: name }).eq('id', user.id); } catch { /* noop */ }
      const today = new Date();
      const issueDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const certId = `VV-${today.getFullYear()}-${String(user.id).slice(0, 8).toUpperCase()}`;
      const pdf = generateCertificatePdf({ recipientName: name, issueDate, certId });
      pdf.save(`Valuevade-Certificate-${name.replace(/\s+/g, '-')}.pdf`);
      setDownloaded(true);
    } finally {
      setDownloading(false);
    }
  };

  if (state.loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (!state.allDone) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6" data-testid="course-complete-not-yet">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center mx-auto mb-5">
            <Trophy size={26} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="font-clash text-2xl font-bold text-[var(--color-text)] mb-2">Almost there.</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-6">
            The certificate unlocks once you complete all capstone projects.
            {' '}You&apos;ve completed {state.doneCap ?? 0} of {state.totalCap ?? 0}.
          </p>
          <button
            type="button"
            onClick={() => navigate('/capstones')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
            data-testid="course-complete-cta-capstones"
          >
            Go to capstones <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden" data-testid="course-complete-page">
      <Cosmic />

      {/* Soft radial highlight */}
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[140px] pointer-events-none" />

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-16 sm:py-24">
        {/* Eyebrow */}
        <div className="text-center mb-6" style={{ animation: 'vvCourseFade 700ms ease-out both' }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-primary)]">
            <Sparkles size={11} /> Programme complete
          </div>
        </div>

        {/* Headline */}
        <h1
          className="font-clash text-center text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--color-text)] leading-[1.05] mb-5"
          style={{ animation: 'vvCourseFade 800ms ease-out 100ms both' }}
          data-testid="course-complete-headline"
        >
          You&apos;re now an
          <br />
          <span className="bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] bg-clip-text text-transparent">
            Equity Research Analyst.
          </span>
        </h1>

        <p
          className="text-center text-base sm:text-lg font-bricolage text-[var(--color-text-muted)] max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ animation: 'vvCourseFade 800ms ease-out 200ms both' }}
        >
          You&apos;ve finished the full Valuevade programme — 22 modules, 246 sessions,
          246 hands-on simulations, and 3 capstone projects. That&apos;s not a
          badge you claim; it&apos;s a workflow you own.
        </p>

        {/* Highlight stats */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
          style={{ animation: 'vvCourseFade 800ms ease-out 300ms both' }}
        >
          {[
            { icon: Layers, label: 'Modules', value: '22' },
            { icon: BookOpen, label: 'Sessions', value: '246' },
            { icon: FileSpreadsheet, label: 'Simulations', value: '246' },
            { icon: Trophy, label: 'Capstones', value: `${state.doneCap}/${state.totalCap}` },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/70 backdrop-blur-sm px-4 py-4 text-center">
              <s.icon size={16} className="text-[var(--color-primary)] mx-auto mb-1.5" />
              <div className="font-clash text-xl font-bold text-[var(--color-text)]">{s.value}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* What you can now do (the "edge" panel) */}
        <div
          className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/70 backdrop-blur-sm p-6 sm:p-8 mb-10"
          style={{ animation: 'vvCourseFade 800ms ease-out 400ms both' }}
          data-testid="course-complete-edge-panel"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[var(--color-accent-purple)]" />
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)]">Your edge</p>
          </div>
          <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-4">
            What separates you from a fresh analyst.
          </h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {[
              ['Build 3-statement models from scratch — not from a template.', GitBranch],
              ['Value any business with DCF, multiples, and cross-checks — with Indian-market context.', FileSpreadsheet],
              ['Pitch a stock end-to-end: thesis, drivers, valuation, risks.', BookOpen],
              ['Read industry structure, unit economics, and management quality.', Layers],
              ['Judgement under uncertainty — sector rotation, bias checks, position sizing.', Trophy],
              ['AI-fluent workflow: automate the mechanical, own the thesis.', Sparkles],
            ].map(([txt, Icon], i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={12} className="text-[var(--color-primary)]" />
                </div>
                <span className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{txt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Certificate CTA */}
        <div
          className="rounded-3xl border border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-primary)]/8 to-[var(--color-accent-purple)]/8 p-6 sm:p-8"
          style={{ animation: 'vvCourseFade 800ms ease-out 500ms both, vvCourseGlow 4s ease-in-out infinite' }}
          data-testid="course-complete-cert-panel"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center shrink-0">
              <Award size={22} className="text-[var(--color-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-1">
                Your Certificate of Completion
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-4">
                Downloadable PDF · issued to {fullName || 'your name'} · dated {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>

              {askName && (
                <div className="mb-4" data-testid="course-complete-name-panel">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
                    Recipient name (as it should appear on the certificate)
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Arnav Sharma"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-primary)] text-[var(--color-text)] text-sm font-bricolage outline-none"
                    data-testid="course-complete-name-input"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 font-bricolage">This gets saved to your profile.</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-bricolage text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] hover:brightness-110 disabled:opacity-60 transition-all"
                  data-testid="course-complete-download-btn"
                >
                  {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {downloaded ? 'Download again' : 'Download certificate'}
                </button>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
                  data-testid="course-complete-back-dashboard"
                >
                  Back to dashboard
                </Link>
                {downloaded && (
                  <span className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-mono text-[var(--color-success)]" data-testid="course-complete-downloaded-badge">
                    <CheckCircle2 size={12} /> Downloaded
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-faint)] mt-10">
          Valuevade · Equity Research · Financial Modelling · Valuation
        </p>
      </main>
    </div>
  );
}
