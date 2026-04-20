import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const STEPS = [
  'Cloning course structure...',
  'Applying your customizations...',
  'Preparing your dashboard...',
];

export default function LoadingPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { courseTitle = 'Course', enrollmentId } = location.state || {};
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!enrollmentId) {
      navigate(`/course/${courseId}`, { replace: true });
      return;
    }

    const timers = [
      setTimeout(() => setStep(1), 1200),
      setTimeout(() => setStep(2), 2400),
      setTimeout(() => {
        navigate(`/course/${courseId}/enrolled`, {
          state: { courseTitle, enrollmentId },
          replace: true,
        });
      }, 3600),
    ];

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)] flex flex-col items-center justify-center" data-testid="loading-page">
      {/* Ambient */}
      <div className="absolute top-[20%] left-[30%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[30%] w-[300px] h-[300px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.06] blur-[120px] pointer-events-none" />

      {/* Logo */}
      <img src="/valuevade-logo.svg" alt="Valuevade" className="w-16 h-16 mb-8 animate-pulse" />

      {/* Course title */}
      <p className="text-xs font-mono text-[var(--color-accent-purple)] mb-6" data-testid="loading-course-title">{courseTitle}</p>

      {/* Steps */}
      <div className="space-y-4 mb-10">
        {STEPS.map((text, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-500 ${
              i <= step ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
            }`}
            data-testid={`loading-step-${i}`}
          >
            {i < step ? (
              <div className="w-5 h-5 rounded-full bg-[var(--color-success)] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : i === step ? (
              <div className="w-5 h-5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-[var(--color-border)]" />
            )}
            <span className={`text-sm font-bricolage ${
              i <= step ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'
            }`}>
              {text}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-56 h-1.5 rounded-full overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] transition-all duration-700"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
