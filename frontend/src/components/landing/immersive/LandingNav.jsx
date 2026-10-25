import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { AudienceSwitch } from '../../enterprise/AudienceContext';

const LINKS = [['The experience', 'practice'], ['Your roadmap', 'how-it-works'], ['Pricing', 'pricing']];
export default function LandingNav({ theme, toggleTheme }) {
  const [open, setOpen] = useState(false);
  return <header className="vvi-nav" data-testid="navbar">
    <nav aria-label="Main navigation">
      <Link to="/" className="vvi-logo" data-testid="navbar-logo"><img src="/valuevade-logo.svg" width="28" height="28" alt="" />Valuevade<span>®</span></Link>
      <div className="vvi-nav-links"><AudienceSwitch id="landing" />{LINKS.map(([label, id]) => <a key={id} href={`#${id}`} data-testid={`nav-link-${id}`}>{label}</a>)}<Link to="/resources" data-testid="landing-resources-link">Resources</Link></div>
      <div className="vvi-nav-actions">
        <button onClick={toggleTheme} className="vvi-icon-button vvi-desktop-theme" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Change theme" data-testid="landing-theme-toggle">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <Link to="/login" className="vvi-login" data-testid="navbar-login-link">Log in</Link>
        <Link to="/signup" className="vvi-button vvi-button-primary vvi-nav-cta" data-testid="navbar-signup-link">Start free <ArrowUpRight size={15} /></Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><button className="vvi-icon-button vvi-menu-trigger" aria-label="Open menu" data-testid="mobile-menu-toggle"><Menu size={22} /></button></SheetTrigger>
          <SheetContent className="vvi-menu-panel" data-testid="mobile-menu-overlay">
            <SheetTitle>Valuevade</SheetTitle>
            <SheetDescription className="sr-only" data-testid="mobile-menu-description">Explore the course experience, roadmap, faculty, pricing, and frequently asked questions.</SheetDescription>
            <div className="vvi-menu-close"><SheetClose asChild><button aria-label="Close menu" data-testid="mobile-menu-close"><X size={20} /></button></SheetClose></div>
            <AudienceSwitch id="landing-mobile" />
            <Link to="/resources" data-testid="landing-mobile-resources-link" onClick={() => setOpen(false)}>Resources</Link>
            <nav aria-label="Mobile navigation">{LINKS.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)} data-testid={`mobile-nav-${id}`}>{label}<ArrowUpRight size={18} /></a>)}</nav>
            <button onClick={toggleTheme} className="vvi-mobile-theme" data-testid="mobile-theme-toggle">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'Light' : 'Dark'} mode</button>
            <Link to="/login" data-testid="mobile-nav-login" onClick={() => setOpen(false)}>Log in to your account <ArrowUpRight size={16} /></Link>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  </header>;
}