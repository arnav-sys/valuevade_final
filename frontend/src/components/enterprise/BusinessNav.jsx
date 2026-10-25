import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { AudienceSwitch } from './AudienceContext';
import { useAuth } from '../../contexts/AuthContext';

export const BusinessNav = () => {
  const [open, setOpen] = useState(false); const { user } = useAuth();
  const links = [['Programme', '/enterprise/programme'], ['Resources', '/resources'], ['My downloads', '/resources/library']];
  return <header className="biz-nav" data-testid="business-navigation"><div className="biz-nav-inner">
    <Link to="/enterprise" className="biz-logo" data-testid="business-logo"><img src="/valuevade-logo.svg" alt="" width="30" height="30" />Valuevade<span>FOR BUSINESS</span></Link>
    <div className="biz-nav-desktop"><AudienceSwitch id="business" />{links.map(([name,to]) => <Link key={to} to={to} data-testid={`business-link-${name.toLowerCase().replaceAll(' ','-')}`}>{name}</Link>)}</div>
    <Link className="biz-nav-account" to={user ? '/dashboard' : '/login'} data-testid="business-account-link">{user ? 'Dashboard' : 'Log in'}<ArrowUpRight size={15} /></Link>
    <button className="biz-menu-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)} data-testid="business-menu-toggle">{open ? <X /> : <Menu />}</button>
  </div>{open && <nav className="biz-mobile-nav" data-testid="business-mobile-menu"><AudienceSwitch id="business-mobile" />{links.map(([name,to]) => <Link key={to} to={to} onClick={() => setOpen(false)} data-testid={`business-mobile-${name.toLowerCase().replaceAll(' ','-')}`}>{name}<ArrowUpRight size={16} /></Link>)}</nav>}</header>;
};
export const BusinessFooter = () => <footer className="biz-footer" data-testid="business-footer"><Link to="/enterprise" data-testid="business-footer-home">Valuevade®</Link><span>Human judgement. AI advantage.</span><div><Link to="/privacy" data-testid="business-privacy">Privacy</Link><Link to="/terms" data-testid="business-terms">Terms</Link><Link to="/refund-policy" data-testid="business-refunds">Refund policy</Link><a href="mailto:info@valuevade.com" data-testid="business-contact">Contact us</a></div></footer>;