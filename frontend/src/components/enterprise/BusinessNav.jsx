import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, ArrowUpRight, Sun, Moon, LogOut } from 'lucide-react';
import { AudienceSwitch } from './AudienceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export const BusinessNav = ({ student = false }) => {
  const [open, setOpen] = useState(false); const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme(); const { pathname, hash } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = hash && document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView({ block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  const prefix = student ? 'student' : 'business';
  const base = student ? '' : '/enterprise';
  const links = [['All Courses', `${base}/courses`], ['AI Agents', `${base}/ai-agents`], ['Resources', '/resources'], ...(!student ? [['My downloads', '/resources/library']] : [])];
  const themeButton = <button className="catalog-nav-icon" aria-label="Toggle theme" title="Toggle theme" onClick={toggleTheme} data-testid={`${prefix}-theme-toggle`}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>;
  return <header className={`biz-nav ${student ? 'student-public-nav' : ''}`} data-testid={`${prefix}-navigation`}><div className="biz-nav-inner">
    <Link to={student ? '/' : '/enterprise'} className="biz-logo" data-testid={`${prefix}-logo`}><img src="/valuevade-logo.svg" alt="" width="30" height="30" />Valuevade<span>{student ? 'FOR STUDENTS' : 'FOR BUSINESS'}</span></Link>
    <nav className="biz-nav-desktop" aria-label="Main navigation"><AudienceSwitch id={prefix} />{links.map(([name,to]) => <NavLink key={to} to={to} end data-testid={`${prefix}-link-${name.toLowerCase().replaceAll(' ','-')}`}>{name}</NavLink>)}</nav>
    <div className="catalog-nav-actions">{student && themeButton}<Link className="biz-nav-account" to={user ? '/dashboard' : '/login'} data-testid={`${prefix}-account-link`}>{user ? 'Dashboard' : 'Log in'}<ArrowUpRight size={15} /></Link>{user && student && <button className="catalog-nav-icon catalog-desktop-signout" aria-label="Sign out" title="Sign out" onClick={signOut} data-testid="student-desktop-signout"><LogOut size={16}/></button>}
    <button className="biz-menu-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`${prefix}-menu-toggle`}>{open ? <X /> : <Menu />}</button></div>
  </div>{open && <nav className="biz-mobile-nav" aria-label="Mobile navigation" data-testid={`${prefix}-mobile-menu`}><AudienceSwitch id={`${prefix}-mobile`} />{links.map(([name,to]) => <NavLink key={to} to={to} end onClick={() => setOpen(false)} data-testid={`${prefix}-mobile-${name.toLowerCase().replaceAll(' ','-')}`}>{name}<ArrowUpRight size={16} /></NavLink>)}{user && <button onClick={() => { setOpen(false); signOut(); }} data-testid={`${prefix}-signout`}><LogOut size={16}/>Sign out</button>}</nav>}</header>;
};
export const BusinessFooter = () => <footer className="biz-footer" data-testid="business-footer"><Link to="/enterprise" data-testid="business-footer-home">Valuevade®</Link><span>Human judgement. AI advantage.</span><div><Link to="/privacy" data-testid="business-privacy">Privacy</Link><Link to="/terms" data-testid="business-terms">Terms</Link><Link to="/refund-policy" data-testid="business-refunds">Refund policy</Link><a href="mailto:info@valuevade.com" data-testid="business-contact">Contact us</a></div></footer>;