import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Trophy, Sparkles, Award, Share2, ArrowRight, Loader2, AlertCircle,
  RefreshCw, CheckCircle2, Clock, BookOpen, Layers, Briefcase, HelpCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Decorative layers                                                   */
/* ------------------------------------------------------------------ */

function Confetti() {
  const pieces = Array.from({ length: 140 });
  const colors = ['#246BFD', '#6A5CFF', '#FF6AC1', '#10B981', '#F59E0B', '#FFFFFF'];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.2;
        const duration = 3.2 + Math.random() * 2.6;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 10;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-10px',
              width: size,
              height: size * 1.4,
              background: color,
              borderRadius: 2,
              opacity: 0.95,
              animation: `vvCapstoneConfettiFall ${duration}s cubic-bezier(.2,.7,.3,1) ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvCapstoneConfettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function CosmicParticles() {
  const particles = Array.from({ length: 50 });
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((_, i) => {
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const size = 1.5 + Math.random() * 3;
        const duration = 4 + Math.random() * 6;
        const delay = Math.random() * 4;
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
              boxShadow: '0 0 8px rgba(255,255,255,0.6)',
              animation: `vvCapstoneTwinkle ${duration}s ease-in-out ${delay}s infinite`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvCapstoneTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

function CertificateBadge({ pathTitle, userName, completedAt }) {
  const dateStr = completedAt
    ? new Date(completedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

  return (
    <div className="relative w-full max-w-md mx-auto" data-testid="capstone-certificate">
      <svg viewBox="0 0 400 280" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vvCertBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a0a0f" />
            <stop offset="100%" stopColor="#1a0a2a" />
          </linearGradient>
          <linearGradient id="vvCertBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6AC1" />
            <stop offset="50%" stopColor="#6A5CFF" />
            <stop offset="100%" stopColor="#246BFD" />
          </linearGradient>
          <linearGradient id="vvCertTitle" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6AC1" />
            <stop offset="100%" stopColor="#6A5CFF" />
          </linearGradient>
          <radialGradient id="vvCertGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#6A5CFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6A5CFF" stopOpacity="0" />
          </radialGradient>
          <filter id="vvCertShadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Border frame */}
        <rect x="4" y="4" width="392" height="272" rx="18" fill="url(#vvCertBorder)" />
        <rect x="8" y="8" width="384" height="264" rx="15" fill="url(#vvCertBg)" />

        {/* Glow */}
        <rect x="8" y="8" width="384" height="264" rx="15" fill="url(#vvCertGlow)" />

        {/* Corner ornaments */}
        {[[28, 28], [372, 28], [28, 252], [372, 252]].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3" fill="#FF6AC1" opacity="0.8" />
            <circle cx={cx} cy={cy} r="6" fill="none" stroke="#6A5CFF" strokeWidth="0.8" opacity="0.5" />
          </g>
        ))}

        {/* Top label */}
        <text x="200" y="48" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="monospace" letterSpacing="3">
          VALUEVADE · CERTIFICATE OF COMPLETION
        </text>

        {/* Trophy icon */}
        <g transform="translate(186, 64)" filter="url(#vvCertShadow)">
          <path
            d="M14 4 L14 10 Q14 16 18 19 Q22 16 22 10 L22 4 Z M4 6 L4 10 Q4 14 10 16 M26 6 L26 10 Q26 14 20 16 M12 22 L12 26 L20 26 L20 22"
            fill="none"
            stroke="url(#vvCertTitle)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="11" r="2" fill="#FF6AC1" opacity="0.9" />
        </g>

        {/* "This certifies" */}
        <text x="200" y="130" textAnchor="middle" fill="#d1d5db" fontSize="10" fontFamily="serif" fontStyle="italic">
          This certifies that
        </text>

        {/* Name */}
        <text x="200" y="156" textAnchor="middle" fill="#ffffff" fontSize="20" fontFamily="'Clash Display', serif" fontWeight="700">
          {userName || 'Finance Professional'}
        </text>

        {/* Divider */}
        <line x1="120" y1="170" x2="280" y2="170" stroke="url(#vvCertBorder)" strokeWidth="1" opacity="0.6" />

        <text x="200" y="190" textAnchor="middle" fill="#d1d5db" fontSize="10" fontFamily="serif" fontStyle="italic">
          has successfully completed
        </text>

        {/* Path title */}
        <text x="200" y="214" textAnchor="middle" fill="url(#vvCertTitle)" fontSize="14" fontFamily="'Clash Display', sans-serif" fontWeight="600">
          {(pathTitle || 'Finance Career Path').length > 40
            ? (pathTitle || 'Finance Career Path').slice(0, 38) + '…'
            : pathTitle || 'Finance Career Path'}
        </text>

        {/* Date */}
        <text x="200" y="246" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="monospace" letterSpacing="2">
          {dateStr.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, accent = 'primary', testid }) {
  const colorMap = {
    primary: { bg: 'rgba(36,107,253,0.12)', border: 'rgba(36,107,253,0.3)', color: '#246BFD' },
    purple: { bg: 'rgba(106,92,255,0.12)', border: 'rgba(106,92,255,0.3)', color: '#6A5CFF' },
    pink: { bg: 'rgba(255,106,193,0.12)', border: 'rgba(255,106,193,0.3)', color: '#FF6AC1' },
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', color: '#10B981' },
    amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#F59E0B' },
  };
  const c = colorMap[accent] || colorMap.primary;
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      data-testid={testid}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: c.color + '22', color: c.color, border: `1px solid ${c.color}55` }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
          {label}
        </div>
        <div className="font-clash text-lg font-bold text-[var(--color-text)] truncate">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function CapstoneCompletePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [capstone, setCapstone] = useState(null);
  const [stats, setStats] = useState(null);
  const [modules, setModules] = useState([]);
  const [moduleProjects, setModuleProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // Auto-redirect to /course-complete when ALL capstone projects are done —
  // the CapstoneComplete screen celebrates ONE capstone; the CourseComplete
  // screen celebrates the whole programme (all capstones).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      try {
        const { data: enrs } = await supabase.from('user_enrollments').select('id').eq('user_id', user.id).limit(1);
        const enrId = enrs && enrs[0] ? enrs[0].id : null;
        if (!enrId) return;
        const [{ data: masterList }, { data: userList }] = await Promise.all([
          supabase.from('master_capstone_projects').select('id'),
          supabase.from('user_capstone_projects').select('capstone_id,is_completed').eq('enrollment_id', enrId).eq('is_completed', true),
        ]);
        if (cancelled) return;
        const total = (masterList || []).length;
        const done = new Set((userList || []).map((r) => r.capstone_id)).size;
        if (total > 0 && done >= total) navigate('/course-complete', { replace: true });
      } catch { /* silent — stay on CapstoneComplete */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id, navigate]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        // Find completed enrollment first (since we flip status on submit)
        const { data: enrList, error: enrErr } = await supabase
          .from('user_enrollments')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['completed', 'active'])
          .order('enrolled_at', { ascending: false });
        if (enrErr) throw enrErr;
        if (!mounted) return;

        const enr =
          (enrList || []).find((e) => e.status === 'completed') ||
          (enrList || [])[0] ||
          null;
        setEnrollment(enr);
        if (!enr) {
          setLoading(false);
          return;
        }

        const [capRes, statsRes, modsRes, projRes] = await Promise.all([
          supabase
            .from('user_capstone_projects')
            .select('*, master_capstone_projects(*)')
            .eq('enrollment_id', enr.id)
            .maybeSingle(),
          supabase.from('user_stats').select('*').eq('enrollment_id', enr.id).maybeSingle().then(
            (r) => r,
            () => ({ data: null })
          ),
          supabase
            .from('user_modules')
            .select('id, title, order_index, is_completed, is_removed')
            .eq('enrollment_id', enr.id)
            .eq('is_removed', false)
            .order('order_index'),
          supabase
            .from('user_module_projects')
            .select('user_module_id, is_completed'),
        ]);

        if (!mounted) return;
        setCapstone(capRes.data || null);
        setStats(statsRes.data || null);
        const activeModules = modsRes.data || [];
        setModules(activeModules);

        // Filter projects to this enrollment's modules
        const moduleIds = new Set(activeModules.map((m) => m.id));
        const filteredProjects = (projRes.data || []).filter((p) => moduleIds.has(p.user_module_id));
        setModuleProjects(filteredProjects);

        // Sessions for quiz average
        if (activeModules.length) {
          const { data: sess } = await supabase
            .from('user_sessions')
            .select('id, is_completed, quiz_score, quiz_completed, is_removed')
            .in('user_module_id', activeModules.map((m) => m.id))
            .eq('is_removed', false);
          if (mounted) setSessions(sess || []);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load completion');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const journey = useMemo(() => {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.is_completed).length;
    const completedModules = modules.filter((m) => m.is_completed).length;
    const completedProjects = moduleProjects.filter((p) => p.is_completed).length;
    const quizScores = sessions
      .filter((s) => s.quiz_completed && typeof s.quiz_score === 'number')
      .map((s) => s.quiz_score);
    const quizAvg = quizScores.length
      ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
      : null;

    const timeMin = stats?.total_time_minutes || 0;
    let timeLabel = `${timeMin} min`;
    if (timeMin >= 60) {
      const hrs = Math.floor(timeMin / 60);
      const rem = timeMin % 60;
      timeLabel = rem ? `${hrs}h ${rem}m` : `${hrs}h`;
    }

    return {
      totalSessions,
      completedSessions,
      completedModules,
      totalModules: modules.length,
      completedProjects,
      totalProjects: moduleProjects.length,
      quizAvg,
      timeLabel,
    };
  }, [sessions, modules, moduleProjects, stats]);

  const userName = profile?.full_name || profile?.email?.split('@')[0] || 'Finance Professional';

  const handleShare = async () => {
    const shareData = {
      title: `I completed ${enrollment?.title || 'my Valuevade career path'}!`,
      text: `Just finished my capstone project on Valuevade — ${enrollment?.title || ''}.`,
      url: window.location.origin,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast.success('Achievement copied to clipboard');
      } else {
        toast.info('Sharing not supported on this device');
      }
    } catch {
      // user cancelled or error
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="capstone-complete-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-accent-pink)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="capstone-complete-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load completion</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden px-4 py-10 sm:py-14"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(255,106,193,0.12) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(106,92,255,0.12) 0%, transparent 50%), var(--bg-primary)',
      }}
      data-testid="capstone-complete-page"
    >
      <CosmicParticles />
      {showConfetti && <Confetti />}

      <div className="relative z-10 max-w-2xl mx-auto" data-testid="capstone-complete-content">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-6">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-60"
              style={{
                background: 'linear-gradient(135deg, #FF6AC1, #6A5CFF, #246BFD)',
              }}
            />
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #FF6AC1 0%, #6A5CFF 50%, #246BFD 100%)',
                boxShadow: '0 0 40px rgba(255,106,193,0.5)',
                animation: 'vvTrophyBounce 2.4s ease-in-out infinite',
              }}
            >
              <Trophy size={44} className="text-white" strokeWidth={2.2} />
            </div>
            <style>{`
              @keyframes vvTrophyBounce {
                0%, 100% { transform: scale(1) translateY(0); }
                50% { transform: scale(1.06) translateY(-6px); }
              }
            `}</style>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-accent-pink)]/10 border border-[var(--color-accent-pink)]/25 text-[var(--color-accent-pink)] text-xs font-mono uppercase tracking-[0.2em] mb-5" data-testid="capstone-complete-badge">
            <Sparkles size={12} /> Journey complete
          </div>

          <h1 className="font-clash text-4xl sm:text-6xl font-bold text-[var(--color-text)] mb-4 leading-tight" data-testid="capstone-complete-title">
            Congratulations!
          </h1>
          <p className="text-[var(--color-text)] font-bricolage text-lg sm:text-xl mb-3 leading-relaxed" data-testid="capstone-complete-subtitle">
            You've completed{' '}
            <span
              className="font-semibold bg-gradient-to-r from-[var(--color-accent-pink)] to-[var(--color-accent-purple)] bg-clip-text text-transparent"
              data-testid="capstone-complete-path-title"
            >
              {enrollment?.title || 'your career path'}
            </span>.
          </p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage max-w-md mx-auto leading-relaxed">
            You went from concepts to interviews to real simulations — and finished with a capstone that ties it all together. This is analyst-level discipline.
          </p>
        </div>

        {/* Certificate */}
        <div className="mb-10" data-testid="capstone-certificate-wrap">
          <CertificateBadge
            pathTitle={enrollment?.title}
            userName={userName}
            completedAt={capstone?.completed_at || enrollment?.completed_at}
          />
        </div>

        {/* Journey summary */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8" data-testid="capstone-journey-summary">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[var(--color-border)]">
            <Award size={14} className="text-[var(--color-accent-pink)]" />
            <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
              Your journey
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatPill
              icon={BookOpen}
              label="Sessions"
              value={`${journey.completedSessions}/${journey.totalSessions}`}
              accent="primary"
              testid="capstone-stat-sessions"
            />
            <StatPill
              icon={Clock}
              label="Time invested"
              value={journey.timeLabel}
              accent="success"
              testid="capstone-stat-time"
            />
            <StatPill
              icon={Layers}
              label="Modules"
              value={`${journey.completedModules}/${journey.totalModules}`}
              accent="purple"
              testid="capstone-stat-modules"
            />
            <StatPill
              icon={Briefcase}
              label="Projects"
              value={`${journey.completedProjects}/${journey.totalProjects}`}
              accent="pink"
              testid="capstone-stat-projects"
            />
            {journey.quizAvg != null && (
              <StatPill
                icon={HelpCircle}
                label="Quiz average"
                value={`${journey.quizAvg}%`}
                accent="amber"
                testid="capstone-stat-quiz-avg"
              />
            )}
            <StatPill
              icon={CheckCircle2}
              label="Capstone"
              value="Complete"
              accent="success"
              testid="capstone-stat-capstone"
            />
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3" data-testid="capstone-complete-ctas">
          <button
            onClick={handleShare}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-accent-pink)] via-[var(--color-accent-purple)] to-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_28px_rgba(255,106,193,0.4)] hover:brightness-110 transition-all"
            data-testid="capstone-share-btn"
          >
            <Share2 size={16} />
            Share Achievement
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="capstone-complete-dashboard-btn"
          >
            Back to Dashboard
          </button>

          <Link
            to="/courses"
            className="text-center text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] font-mono mt-2"
            data-testid="capstone-explore-courses"
          >
            Explore more career paths →
          </Link>
        </div>
      </div>
    </div>
  );
}
