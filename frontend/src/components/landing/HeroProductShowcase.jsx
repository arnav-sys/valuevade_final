import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Mic, Table2, FileSearch } from 'lucide-react';
import MockInterviewUI from '@/components/landing/mocks/MockInterviewUI';
import ExcelModelUI from '@/components/landing/mocks/ExcelModelUI';
import DocSimUI from '@/components/landing/mocks/DocSimUI';
import '@/components/landing/hero-showcase.css';

const TABS = [
  { id: 'interview', label: 'AI mock interview', icon: Mic, url: 'valuevade.com/interview/live', Mock: MockInterviewUI },
  { id: 'model', label: 'Excel modelling', icon: Table2, url: 'valuevade.com/session/dcf-build', Mock: ExcelModelUI },
  { id: 'document', label: 'Document simulation', icon: FileSearch, url: 'valuevade.com/simulation/annual-report', Mock: DocSimUI },
];

export default function HeroProductShowcase() {
  const [active, setActive] = useState('interview');
  const [auto, setAuto] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!auto || reduceMotion) return;
    const t = setInterval(() => {
      setActive((cur) => TABS[(TABS.findIndex((x) => x.id === cur) + 1) % TABS.length].id);
    }, 6500);
    return () => clearInterval(t);
  }, [auto, reduceMotion]);

  const current = TABS.find((t) => t.id === active) || TABS[0];
  const Mock = current.Mock;

  return (
    <div className="vv-stage" data-testid="hero-showcase">
      <div className="vv-stage__glow" aria-hidden="true" />

      <div className="vv-tabs" role="tablist" aria-label="Explore the learning experience">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            id={`showcase-tab-${id}`}
            aria-controls="showcase-panel"
            aria-selected={active === id}
            onClick={() => { setActive(id); setAuto(false); }}
            className={`vv-tab${active === id ? ' vv-tab--on' : ''}`}
            data-testid={`hero-showcase-tab-${id}`}
          >
            <Icon size={11} strokeWidth={2.2} /> {label}
          </button>
        ))}
      </div>

      <div className="vv-app" data-testid="hero-showcase-window">
        <div className="vv-app__chrome">
          <span className="vv-app__dot" /><span className="vv-app__dot" /><span className="vv-app__dot" />
          <span className="vv-app__url" data-testid="hero-preview-label">Product preview · Illustrative data</span>
        </div>
        <div className="vv-app__body" role="tabpanel" id="showcase-panel" aria-labelledby={`showcase-tab-${active}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <Mock />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
