import { Instagram, Linkedin, Youtube } from 'lucide-react';

const footerLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'AI-Proof', id: 'ai-proof' },
  { label: 'Blog', href: '#' },
  { label: 'Contact', href: '#' },
];

const socialLinks = [
  { icon: Instagram, label: 'Instagram', href: '#' },
  { icon: Linkedin, label: 'LinkedIn', href: '#' },
  { icon: Youtube, label: 'YouTube', href: '#' },
];

export default function Footer() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer
      className="border-t border-white/5 py-12 lg:py-16"
      style={{ background: '#02073D' }}
      data-testid="footer"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-10">
          {/* Left: Logo + tagline */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img
                src="/valuevade-logo.svg"
                alt="Valuevade Logo"
                className="w-7 h-7 object-contain"
              />
              <span className="font-clash text-lg font-semibold logo-gradient">
                Valuevade
              </span>
            </div>
            <p className="text-white/40 text-sm font-bricolage">
              Your AI-powered path to a finance career.
            </p>
          </div>

          {/* Center: Links */}
          <div className="flex flex-wrap gap-6">
            {footerLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => link.id ? scrollTo(link.id) : undefined}
                className="text-sm text-white/40 hover:text-white transition-colors font-bricolage"
                data-testid={`footer-link-${link.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Right: Social */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  aria-label={social.label}
                  data-testid={`footer-social-${social.label.toLowerCase()}`}
                >
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/25 font-bricolage">
          <p>2025 Valuevade. Built for the finance students who want more.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white/50 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white/50 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
