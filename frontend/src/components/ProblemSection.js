import { Compass, Layers, Cpu } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const problems = [
  {
    icon: Compass,
    title: 'No Clear Roadmap',
    body: "You know you want IB or AM — but no one tells you exactly what skills, credentials, and timeline gets you there.",
    color: '#246BFD',
  },
  {
    icon: Layers,
    title: 'Generic Resources, Zero Personalisation',
    body: "YouTube videos, random courses, LinkedIn posts. None of it is built around your specific gaps and target role.",
    color: '#6A5CFF',
  },
  {
    icon: Cpu,
    title: 'AI Is Coming for Finance Jobs',
    body: "Junior analysts, screeners, report writers — AI is replacing entry-level finance roles fast. Students who don't adapt won't get hired.",
    color: '#FF6AC1',
  },
];

export default function ProblemSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      className="relative py-24 lg:py-32 bg-[var(--bg-primary)]"
      data-testid="problem-section"
    >
      <div ref={sectionRef} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE GAP NO ONE TALKS ABOUT
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight max-w-3xl mx-auto ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.1s' }}
          >
            Your college prepared you for exams.
            <br />
            Not for a finance career.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((problem, i) => {
            const Icon = problem.icon;
            return (
              <div
                key={problem.title}
                className={`glass-card glass-card-hover rounded-2xl p-8 transition-all duration-300 ${
                  isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
                }`}
                style={{
                  animationDelay: `${0.2 + i * 0.1}s`,
                  borderColor: `${problem.color}20`,
                }}
                data-testid={`problem-card-${i}`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${problem.color}15` }}
                >
                  <Icon size={24} style={{ color: problem.color }} />
                </div>
                <h3 className="font-clash text-xl text-[var(--color-text)] mb-3">
                  {problem.title}
                </h3>
                <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed text-sm">
                  {problem.body}
                </p>
              </div>
            );
          })}
        </div>

        <p
          className={`text-center mt-12 text-[var(--color-accent-pink)] italic font-bricolage text-base lg:text-lg ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
          style={{ animationDelay: '0.5s' }}
          data-testid="problem-transition-line"
        >
          Valuevade was built to close every one of these gaps.
        </p>
      </div>
    </section>
  );
}
