import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter } from 'lucide-react';

const footerLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'AI-Proof', id: 'ai-proof' },
];

// Social links — Prompt 2 (Aug 2026) provided real LinkedIn + X URLs.
// YouTube icon was previously an `#` placeholder — removed entirely per
// Prompt 2 ("remove any icon that still has no real URL").
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
      className="border-t border-[var(--color-border)] py-12 lg:py-16 bg-[var(--bg-primary)]"
      data-testid="footer"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src="/valuevade-logo.svg" alt="Valuevade Logo" className="w-7 h-7 object-contain" />
              <span className="font-clash text-lg font-semibold logo-gradient">Valuevade</span>
            </div>
            <p className="text-[var(--color-text-faint)] text-sm font-bricolage">Your AI-powered path to a finance career.</p>
          </div>

          <div className="flex flex-wrap gap-6">
            {footerLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => (link.id ? scrollTo(link.id) : undefined)}
                className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors font-bricolage"
                data-testid={`footer-link-${link.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
                  aria-label={social.label}
                  data-testid={`footer-social-${social.label.toLowerCase()}`}
                >
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-faint)] font-bricolage">
          <p>© 2026 Valuevade. Built for the finance students who want more.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-[var(--color-text-muted)] transition-colors" data-testid="footer-privacy">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-[var(--color-text-muted)] transition-colors" data-testid="footer-terms">
              Terms
            </Link>
            <Link to="/refund-policy" className="hover:text-[var(--color-text-muted)] transition-colors" data-testid="footer-refund">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
