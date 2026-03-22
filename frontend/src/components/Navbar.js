import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'AI-Proof', id: 'ai-proof' },
  { label: 'Roadmap', id: 'features' },
];

export default function Navbar({ onJoinWaitlist }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-navy/80 backdrop-blur-xl border-b border-white/10'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2"
          data-testid="navbar-logo"
        >
          <img
            src="/valuevade-logo.svg"
            alt="Valuevade Logo"
            className="w-8 h-8 object-contain"
          />
          <span className="font-clash text-xl font-semibold logo-gradient">
            Valuevade
          </span>
        </button>

        {/* Center links - desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.id)}
              className="text-sm text-white/60 hover:text-white transition-colors font-bricolage"
              data-testid={`nav-link-${link.id}`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* CTA - desktop */}
        <button
          onClick={onJoinWaitlist}
          className="hidden md:block px-5 py-2 bg-vblue text-white text-sm font-semibold rounded-full hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
          data-testid="nav-join-waitlist-btn"
        >
          Join Waitlist
        </button>

        {/* Hamburger - mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-white"
          data-testid="nav-hamburger"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 bg-navy/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center gap-8"
          data-testid="mobile-menu-overlay"
        >
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.id)}
              className="text-2xl text-white/80 hover:text-white font-clash transition-colors"
              data-testid={`mobile-nav-${link.id}`}
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => { setMenuOpen(false); onJoinWaitlist(); }}
            className="px-8 py-3 bg-vblue text-white font-semibold rounded-full text-lg"
            data-testid="mobile-join-waitlist-btn"
          >
            Join Waitlist
          </button>
        </div>
      )}
    </header>
  );
}
