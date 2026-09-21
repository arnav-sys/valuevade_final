import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Mic, Table2, FileSearch } from 'lucide-react';
import '@/components/landing/hero-showcase.css';

const TABS = [
  {
    id: 'interview',
    label: 'AI mock interview',
    icon: Mic,
    url: 'valuevade.com/interview/live',
    image: 'https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?crop=entropy&cs=srgb&fm=jpg&q=80',
    alt: 'Student on a live AI-run mock interview video call',
  },
  {
    id: 'model',
    label: 'Excel modelling',
    icon: Table2,
    url: 'valuevade.com/session/dcf-build',
    image: 'https://images.unsplash.com/photo-1783115259399-3a5a3e0e4592?crop=entropy&cs=srgb&fm=jpg&q=80',
    alt: 'Building a DCF financial model in an Excel spreadsheet',
  },
  {
    id: 'document',
    label: 'Document simulation',
    icon: FileSearch,
    url: 'valuevade.com/simulation/annual-report',
    image: 'https://images.pexels.com/photos/7821674/pexels-photo-7821674.jpeg?auto=compress&cs=tinysrgb&h=800&w=1200',
    alt: 'Analysing an annual report with a magnifying glass',
  },
];

export default function HeroProductShowcase() {
  const [active, setActive] = useState('interview');
  const [auto, setAuto] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      setActive((cur) => TABS[(TABS.findIndex((x) => x.id === cur) + 1) % TABS.length].id);
    }, 6500);
    return () => clearInterval(t);
  }, [auto]);

  const current = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <div className="vv-stage" data-testid="hero-showcase">
      <div className="vv-stage__glow" aria-hidden="true" />

      <div className="vv-tabs" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
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
          <span className="vv-app__url">{current.url}</span>
        </div>
        <div className="vv-app__body">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <img
                src={current.image}
                alt={current.alt}
                className="vv-app__photo"
                data-testid={`hero-showcase-photo-${active}`}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = TABS[0].image; }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
