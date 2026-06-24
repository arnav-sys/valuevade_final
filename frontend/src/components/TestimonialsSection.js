import { Star } from 'lucide-react';
import { useScrollAnimation, useCountUp } from '@/hooks/useScrollAnimation';
import { TestimonialsCarousel3D } from '@/components/landing/CinematicSections';

const testimonials = [
  { quote: "Finally a platform that doesn't just dump content at me. The roadmap showed me exactly what I was missing for my AM interviews.", name: 'Priya S.', role: 'CFA L1 Candidate, Delhi' },
  { quote: "The job simulation for equity research was the closest thing to actual work I'd done before my internship. My interviewer was genuinely impressed.", name: 'Arjun M.', role: 'MBA Finance, Mumbai' },
  { quote: 'I wasted 6 months on random YouTube courses. Valuevade gave me a clear path in 10 minutes.', name: 'Tanvi R.', role: 'B.Com Final Year, Pune' },
];

const stats = [
  { value: 500, suffix: '+', label: 'Students on Waitlist' },
  { value: 12, suffix: '', label: 'Target Roles' },
  { value: 40, suffix: '+', label: 'Hours of Content' },
  { value: 100, suffix: '%', label: 'Personalised' },
];

function StatItem({ value, suffix, label }) {
  const [count, ref] = useCountUp(value);
  return (
    <div ref={ref} className="text-center px-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <p className="font-clash text-3xl lg:text-4xl text-[var(--color-text)]">{count}{suffix}</p>
      <p className="text-[var(--color-text-faint)] text-sm font-jetbrains mt-1">{label}</p>
    </div>
  );
}

export default function TestimonialsSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      className="relative py-24 lg:py-32 bg-[var(--bg-secondary)]"
      data-testid="testimonials-section"
    >
      <div ref={sectionRef} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>FROM STUDENTS IN THE GRIND</p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s' }}
          >
            Built by a finance student. For finance students.
          </h2>
        </div>

        <div className="mb-16" data-testid="testimonials-carousel-wrap">
          <TestimonialsCarousel3D items={testimonials} />
        </div>

        <div
          className={`glass-card rounded-2xl py-8 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-[var(--color-border)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.5s' }}
          data-testid="stats-bar"
        >
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
