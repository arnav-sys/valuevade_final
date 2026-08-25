import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter } from 'lucide-react';

const footerLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'AI-Proof', id: 'ai-proof' },
];

const socialLinks = [
  { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/valuevade/' },
  { icon: Linkedin,  label: 'LinkedIn',  href: 'https://www.linkedin.com/company/valuevade' },
  { icon: Twitter,   label: 'X',         href: 'https://x.com/valuevade' },
];

export default function Footer() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer
      className="relative border-t border-[var(--color-border)] pt-14 pb-8 bg-[var(--bg-primary)]"
      data-testid="footer"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-25" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Chapter rail */}
        <div className="flex items-center gap-3 mb-10">
          <span className="lv-chapter">§∞ // FOOTER</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">VALUEVADE · IND · EQUITY RESEARCH SW</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-[var(--color-border)]">
          {/* Logo + tagline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/valuevade-logo.svg" alt="Valuevade Logo" className="w-7 h-7 object-contain" />
              <span className="font-clash text-lg font-semibold logo-gradient">Valuevade</span>
            </div>
            <p className="text-[var(--color-text-muted)] text-[13.5px] font-bricolage leading-relaxed max-w-xs">
              Your AI-powered path to a finance career.
            </p>
            <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center gap-4">
              <span className="lv-live-dot" aria-hidden="true" />
              <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                ENROLMENT · OPEN
              </span>
            </div>
          </div>

          {/* Nav column */}
          <div>
            <p className="font-jetbrains text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-faint)] mb-4">
              EXPLORE
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/courses"
                  className="lv-nav-link"
                  data-testid="footer-link-courses"
                >
                  Courses
                </Link>
              </li>
              <li>
                <Link
                  to="/free-mock-interview"
                  className="lv-nav-link"
                  data-testid="footer-link-free-mock"
                >
                  Free Mock
                </Link>
              </li>
              {footerLinks.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => (link.id ? scrollTo(link.id) : undefined)}
                    className="lv-nav-link"
                    data-testid={`footer-link-${link.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <p className="font-jetbrains text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-faint)] mb-4">
              CHANNELS
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-9 h-9 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)] transition-colors"
                    style={{ borderRadius: 2 }}
                    aria-label={social.label}
                    data-testid={`footer-social-${social.label.toLowerCase()}`}
                  >
                    <Icon size={14} strokeWidth={2} />
                  </a>
                );
              })}
            </div>
            <p className="mt-5 font-jetbrains text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
              REACH · @VALUEVADE
            </p>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="font-jetbrains text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
            © 2026 VALUEVADE · BUILT FOR FINANCE STUDENTS WHO WANT MORE
          </p>
          <div className="flex gap-5">
            <Link to="/privacy" className="lv-nav-link" data-testid="footer-privacy">
              Privacy
            </Link>
            <Link to="/terms" className="lv-nav-link" data-testid="footer-terms">
              Terms
            </Link>
            <Link to="/refund-policy" className="lv-nav-link" data-testid="footer-refund">
              Refund
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
