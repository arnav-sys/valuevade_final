import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

export const EnterpriseCurriculum = ({ course }) => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    setLoading(true); setError('');
    supabase.from('master_modules').select('id,title,order_index,master_sessions(id,title,order_index)')
      .eq('path_id', course.id).order('order_index').abortSignal(controller.signal)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) throw loadError;
        setModules((data || []).map(m => ({ ...m, master_sessions: [...(m.master_sessions || [])].sort((a,b) => a.order_index - b.order_index) })));
      }).catch(() => { if (active) setError('The curriculum could not be loaded. Please try again.'); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [course.id, attempt]);
  return <section className="ec-section" id="enterprise-course-curriculum" data-testid="enterprise-course-curriculum">
    <div className="ec-section-heading"><p className="biz-eyebrow">THE PUBLISHED LEARNING PATH</p><h2>Explore the curriculum.</h2><p>The course curriculum is the starting point. Business priorities, selected modules and delivery arrangements are agreed in your team proposal.</p></div>
    {loading && <p role="status" data-testid="enterprise-curriculum-loading">Loading curriculum…</p>}
    {error && <div className="biz-alert" role="alert" data-testid="enterprise-curriculum-error"><p>{error}</p><button className="biz-text-link" data-testid="enterprise-curriculum-retry" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={16}/>Try again</button></div>}
    {!loading && !error && (modules.length ? <Accordion type="multiple" data-testid="enterprise-curriculum-modules">{modules.map((module,i) => <AccordionItem value={module.id} key={module.id}><AccordionTrigger data-testid={`enterprise-module-${module.id}`}><span className="ec-module-title"><span>{String(i + 1).padStart(2,'0')}</span>{module.title}</span><span className="ec-module-count">{module.master_sessions.length} sessions</span></AccordionTrigger><AccordionContent data-testid={`enterprise-module-content-${module.id}`}><ol className="ec-sessions">{module.master_sessions.map(session => <li key={session.id} data-testid={`enterprise-session-${session.id}`}>{session.title}</li>)}</ol>{!module.master_sessions.length && <p>Session details will be published when available.</p>}</AccordionContent></AccordionItem>)}</Accordion> : <p data-testid="enterprise-curriculum-empty">Detailed curriculum will be published when available.</p>)}
  </section>;
};