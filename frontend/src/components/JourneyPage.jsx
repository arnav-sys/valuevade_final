import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import ModuleConstellationMap from './gamification/ModuleConstellationMap';
import AvatarPersona from './tutor/AvatarPersona';
import { resolveTutorPhase } from '../contexts/TutorContext';

export default function JourneyPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8" data-testid="journey-page">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4"
          data-testid="journey-back"
        >
          <ArrowLeft size={12} /> Dashboard
        </button>
        <header className="mb-4">
          <h1 className="font-clash text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--color-text)]">
            Your learning journey
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Every star is a module. Light them up.
          </p>
        </header>
        <ModuleConstellationMap fullscreen />
      </main>
      {(() => {
        const t = resolveTutorPhase('journey');
        return <AvatarPersona pose={t?.pose || 'idle'} size="sm" position="bottom-right" message={t?.message} />;
      })()}
    </div>
  );
}
