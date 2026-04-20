import { useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

export default function EnrolledPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { courseTitle = 'Course' } = location.state || {};

  // Confetti pieces
  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        color: ['#246BFD', '#6A5CFF', '#FF6AC1', '#00D68F', '#F5ECFF'][i % 5],
        delay: `${Math.random() * 0.8}s`,
        duration: `${1.5 + Math.random() * 2}s`,
        width: `${4 + Math.random() * 8}px`,
        height: `${4 + Math.random() * 8}px`,
      })),
    []
  );

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden" data-testid="enrolled-page">
      {/* Ambient */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-pink)] opacity-[0.05] blur-[120px] pointer-events-none" />

      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((piece, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              background: piece.color,
              animation: `confetti-fall ${piece.duration} ease-out ${piece.delay} forwards`,
              borderRadius: i % 2 === 0 ? '50%' : '2px',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-lg mx-auto px-6" data-testid="enrolled-content">
        {/* Animated check */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-[var(--color-success)]/10 border-2 border-[var(--color-success)]/30 flex items-center justify-center">
            <svg className="w-14 h-14" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" fill="none" stroke="var(--color-success)" strokeWidth="1.5" opacity="0.3" />
              <path
                d="M15 27l7 7 15-15"
                fill="none"
                stroke="var(--color-success)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ strokeDasharray: 50, strokeDashoffset: 0, animation: 'draw-check 0.8s ease-out forwards' }}
              />
            </svg>
          </div>
        </div>

        <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-3" data-testid="enrolled-heading">
          You're all set!
        </h1>

        <p className="text-[var(--color-text-muted)] font-bricolage mb-2" data-testid="enrolled-subtitle">
          {profile?.full_name ? `${profile.full_name}, your` : 'Your'} personalized <span className="text-[var(--color-text)] font-medium">{courseTitle}</span> path is ready.
        </p>

        <p className="text-sm text-[var(--color-text-faint)] font-bricolage mb-8">
          Your AI-customized curriculum has been created. Start learning at your own pace.
        </p>

        {/* Course badge */}
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-card mb-8" data-testid="enrolled-badge">
          <Sparkles size={16} className="text-[var(--color-accent-purple)]" />
          <span className="text-sm font-mono text-[var(--color-accent-purple)]">{courseTitle}</span>
          <CheckCircle2 size={16} className="text-[var(--color-success)]" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3.5 rounded-xl text-sm font-semibold font-bricolage bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all flex items-center justify-center gap-2"
            data-testid="enrolled-start-learning"
          >
            Start Learning <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/courses')}
            className="px-6 py-3.5 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-all"
            data-testid="enrolled-browse-courses"
          >
            Browse Courses
          </button>
        </div>
      </div>
    </div>
  );
}
