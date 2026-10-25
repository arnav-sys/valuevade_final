import { createContext, useCallback, useContext, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Building2, GraduationCap, ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import './enterprise.css';

const Audience = createContext(null);
const readChoice = () => { try { const value = localStorage.getItem('valuevade-audience'); return ['student', 'enterprise'].includes(value) ? value : null; } catch { return null; } };
export const AudienceProvider = ({ children }) => {
  const [audience, setAudience] = useState(readChoice);
  const choose = useCallback(value => { setAudience(value); try { localStorage.setItem('valuevade-audience', value); } catch {} }, []);
  return <Audience.Provider value={{ audience, choose }}>{children}</Audience.Provider>;
};
export const useAudience = () => useContext(Audience);
const audiencePath = (pathname, value) => {
  const base = pathname.replace(/^\/enterprise(?=\/|$)/, '') || '/';
  const shared = base === '/courses' || base === '/ai-agents' || /^\/course\/[^/]+$/.test(base);
  return value === 'enterprise' ? `/enterprise${shared ? base : ''}` : shared ? base : '/';
};
export const AudienceSwitch = ({ id = 'header' }) => {
  const { audience, choose } = useAudience();
  const navigate = useNavigate(); const { pathname } = useLocation();
  return <div className="vv-audience-switch" aria-label="Audience" data-testid={`${id}-audience-switch`}>
    {['student', 'enterprise'].map(value => <button key={value} type="button" aria-pressed={(audience || (pathname.startsWith('/enterprise') ? 'enterprise' : 'student')) === value}
      data-testid={`${id}-switch-${value}`} onClick={() => { choose(value); navigate(audiencePath(pathname, value)); }}>
      {value === 'student' ? <GraduationCap size={14} /> : <Building2 size={14} />}{value === 'student' ? 'Students' : 'Enterprise'}
    </button>)}
  </div>;
};
export const AudienceGate = ({ children, course = false }) => {
  const { audience, choose } = useAudience();
  const { pathname } = useLocation();
  if (audience === 'enterprise') return <Navigate to={audiencePath(pathname, 'enterprise')} replace />;
  return <>{children}<Dialog open={!audience} onOpenChange={open => { if (!open) choose('student'); }}>
    <DialogContent className="vv-audience-dialog" data-testid="audience-gateway">
      <img src="/valuevade-logo.svg" width="40" height="40" alt="Valuevade" />
      <p className="biz-eyebrow">VALUEVADE · YOUR NEXT CHAPTER</p>
      <DialogTitle>Finance moves forward.<br />Where are you headed?</DialogTitle>
      <DialogDescription>Choose your Valuevade experience.</DialogDescription>
      <div className="vv-audience-choices">
        <button data-testid="choose-student" onClick={() => choose('student')}><GraduationCap size={28} /><strong>Build my career</strong><span>Finance courses, real-world practice and interview preparation.</span><b>For students <ArrowUpRight size={17} /></b></button>
        <button data-testid="choose-enterprise" onClick={() => choose('enterprise')}><Building2 size={28} /><strong>Transform my team</strong><span>AI-powered finance training and purpose-built automation agents.</span><b>For enterprises <ArrowUpRight size={17} /></b></button>
      </div>
    </DialogContent>
  </Dialog></>;
};