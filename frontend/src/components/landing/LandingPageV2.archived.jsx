import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight, Check, X as XIcon, Play, Sparkles, BookOpen, Brain, Activity,
  Mic, FileText, Award, Hammer, Lightbulb, ChevronDown, Star, Linkedin, Twitter, Youtube,
} from 'lucide-react';
import { courseJsonLd, orgJsonLd } from './jsonLd';
import './landing.css';

/* ===========================================================================
 * Premium landing, v2
 * Anchors: #features, #compare, #pricing, #faq, #how-it-works, #curriculum
 * ======================================================================== */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 },
  }),
};

function SectionFadeIn({ children, className, id, label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.section
      ref={ref} id={id} aria-label={label}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* --- NAV ------------------------------------------------------------ */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav
      data-testid="landing-nav"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'backdrop-blur-xl bg-[#06092e]/80 border-b border-white/10' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" data-testid="landing-nav-logo">
          <img src="/valuevade-logo.svg" alt="Valuevade" className="w-7 h-7" />
          <span className="text-white font-bold tracking-tight text-lg">Valuevade</span>
        </Link>
        <div className="hidden md:flex items-center gap-7 lv-nav-scroll text-sm text-white/70">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#compare" className="hover:text-white transition-colors">Compare</a>
          <a href="#curriculum" className="hover:text-white transition-colors">Course</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline-block text-sm text-white/80 hover:text-white px-3 py-2">
            Login
          </Link>
          <Link to="/start" className="lv-btn lv-btn-primary" data-testid="landing-nav-cta" style={{ padding: '10px 18px', fontSize: 14 }}>
            Start Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* --- HERO ----------------------------------------------------------- */
function HeroSection() {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      setParallax({ x, y });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <header className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32" data-testid="landing-hero">
      <div className="lv-mesh" aria-hidden="true">
        <div className="lv-orb" style={{ top: '60%', left: '20%', width: 360, height: 360, background: 'radial-gradient(circle, #818cf8 0%, transparent 60%)' }} />
        <div className="lv-orb" style={{ top: '15%', right: '15%', width: 420, height: 420, background: 'radial-gradient(circle, #ffd768 0%, transparent 60%)', animationDuration: '38s' }} />
      </div>
      <div className="lv-grain" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <motion.span
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
            className="lv-eyebrow mb-7" data-testid="hero-eyebrow"
          >
            🇮🇳 Made for Indian finance students · CFA/FRM/Equity Research
          </motion.span>
          <motion.h1
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
            className="lv-h1 text-white mb-6" data-testid="hero-h1"
          >
            Land your first equity-research job in 12&nbsp;weeks ,{' '}
            <span style={{ background: 'linear-gradient(135deg,#ffd768,#f5b800)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              built by AI, certified for credibility.
            </span>
          </motion.h1>
          <motion.p
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
            className="text-lg md:text-xl text-white/70 mb-9 max-w-2xl"
          >
            Skills + certification, the only finance program that hands you both. Personalised by
            AI, simulated on real Indian-market data, validated by NISM and CFI.
          </motion.p>
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
            className="flex flex-wrap items-center gap-3 mb-5"
          >
            <Link to="/start" className="lv-btn lv-btn-primary" data-testid="hero-cta-primary">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how-it-works" className="lv-btn lv-btn-ghost" data-testid="hero-cta-secondary">
              <Play className="w-4 h-4" /> Watch how it works
            </a>
          </motion.div>
          <motion.p
            variants={fadeUp} initial="hidden" animate="visible" custom={4}
            className="text-xs text-white/45"
          >
            ₹999 lifetime · No subscription · NISM + CFI certifications included
          </motion.p>
        </div>

        {/* Constellation artwork, hand-authored SVG */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-5 relative"
          style={{ transform: `translate(${parallax.x}px, ${parallax.y}px)`, transition: 'transform 400ms ease-out' }}
        >
          <HeroConstellationSVG />
        </motion.div>
      </div>
    </header>
  );
}

function HeroConstellationSVG() {
  const nodes = [
    { x: 60, y: 80, r: 8,  l: 'Foundations' },
    { x: 160, y: 140, r: 6, l: '' },
    { x: 240, y: 80, r: 10, l: 'Modeling' },
    { x: 320, y: 160, r: 7, l: '' },
    { x: 180, y: 240, r: 9, l: 'Valuation' },
    { x: 280, y: 300, r: 6, l: '' },
    { x: 360, y: 240, r: 8, l: 'Research' },
    { x: 100, y: 320, r: 7, l: '' },
    { x: 220, y: 380, r: 11, l: 'AI Capstone' },
  ];
  const edges = [
    [0,1],[1,2],[2,3],[1,4],[3,6],[4,5],[5,6],[4,7],[5,8],[7,8],
  ];
  return (
    <svg viewBox="0 0 420 460" className="w-full max-w-md mx-auto" aria-hidden="true">
      <defs>
        <radialGradient id="vv-node" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffd768" />
          <stop offset="55%" stopColor="#f5b800" />
          <stop offset="100%" stopColor="#9d6900" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vv-edge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f5b800" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {edges.map(([a, b], i) => (
        <motion.line
          key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="url(#vv-edge)" strokeWidth="1.2" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 + i * 0.08 }}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <motion.circle
            cx={n.x} cy={n.y} r={n.r * 3}
            fill="url(#vv-node)" opacity="0.18"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
          <motion.circle
            cx={n.x} cy={n.y} r={n.r}
            fill="#fff"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9 + i * 0.07, type: 'spring', stiffness: 200, damping: 20 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
          {n.l && (
            <text x={n.x + n.r + 8} y={n.y + 4} fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="500">
              {n.l}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* --- WHY NOW STRIP -------------------------------------------------- */
function WhyNowStrip() {
  const items = [
    { icon: Brain,    text: 'Generic analyst skills are being commoditised by AI in real-time.' },
    { icon: Hammer,   text: 'The premium goes to people who use AI as leverage, not those who fear it.' },
    { icon: Lightbulb,text: 'Valuevade is the only program built from day one for the post-AI analyst.' },
  ];
  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" id="why-now" label="Why now">
      <h2 className="lv-h3 text-white max-w-3xl mb-12">
        Finance is changing. AI will replace generic analysts.{' '}
        <span className="text-white/55">Become the one who uses AI.</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(({ icon: Icon, text }, i) => (
          <div key={i} className="lv-card p-6">
            <div className="w-10 h-10 rounded-lg bg-[#4f46e5]/15 border border-[#4f46e5]/30 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-[#a5b4fc]" />
            </div>
            <p className="text-white/85 text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </SectionFadeIn>
  );
}

/* --- FEATURE GRID --------------------------------------------------- */
function FeatureGrid() {
  const features = [
    { icon: Brain,   title: 'AI-personalised course path',     body: 'Pari shapes your curriculum based on your target role, equity research, IB, FP&A, or research analyst.' },
    { icon: Sparkles,title: 'Pari, your AI tutor, 24/7',       body: 'Ask anything in plain English. Pari sees your notes, your sim, your exact question, and answers contextually.' },
    { icon: Activity,title: 'Real Indian-market simulations',  body: 'Build a DCF on Reliance. Ratio-analyse HDFC. Model an LBO on Tata Steel. 68 hands-on sims, not toy problems.' },
    { icon: Mic,     title: 'AI mock interviews',              body: '3-round equity-research interviewer with voice or text. You speak, it grills, you get verdict + feedback.' },
    { icon: FileText,title: 'Resume + LinkedIn networking',     body: 'Get hired, not just qualified. Recruiter-tuned resume reviewer + outreach playbook.' },
    { icon: Award,   title: 'Skills + Certifications',          body: 'Only program that bundles both. NISM + CFI certificates issued on completion, recognised across India.' },
    { icon: Hammer,  title: 'AI capstone project',              body: 'Build a real finance tool with AI, ship it to your portfolio. Recruiters want builders now, not just learners.' },
    { icon: Lightbulb, title: 'Top-analyst mindset',            body: 'Frameworks, soft skills, and thinking habits AI can\u2019t replace. Taught with case studies, not lectures.' },
  ];
  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" id="features" label="Features">
      <div className="mb-14">
        <span className="lv-eyebrow mb-4">The Valuevade edge</span>
        <h2 className="lv-h2 text-white mt-5 max-w-3xl">Eight things every other course is missing.</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {features.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: (i % 4) * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="lv-card p-7 group cursor-default"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4f46e5]/25 to-[#818cf8]/15 border border-[#4f46e5]/40 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[#a5b4fc]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1.5 tracking-tight">{title}</h3>
                <p className="text-white/65 text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionFadeIn>
  );
}

/* --- COMPARISON TABLE ---------------------------------------------- */
function ComparisonTable() {
  const cols = ['Valuevade', 'WallStreet School', 'IFMC Institute', 'Coursera Finance', 'Upgrad/Imarticus'];
  const rows = [
    ['Price',                          { vv: '₹999 lifetime', vals: ['₹50k-80k','₹25k-40k','₹4k-15k/yr','₹50k-2L'] }],
    ['Duration',                       { vv: '4-12 weeks self-paced', vals: ['3-6 months','3-4 months','6-12 months','6-18 months'] }],
    ['AI personalised path',           { vv: 'yes', vals: ['no','no','no','no'] }],
    ['Live AI tutor (24/7)',           { vv: 'yes', vals: ['no','no','no','no'] }],
    ['Real Indian-market sims',        { vv: 'yes', vals: ['partial','partial','no','partial'] }],
    ['Mock interviews with feedback',  { vv: 'AI-powered', vals: ['manual','manual','no','manual'] }],
    ['Job-ready portfolio',            { vv: 'yes', vals: ['partial','no','no','partial'] }],
    ['Certifications (NISM + CFI)',    { vv: 'yes', vals: ['partial','extra cost','no','partial'] }],
    ['Resume + LinkedIn guide',        { vv: 'yes', vals: ['no','no','no','partial'] }],
    ['AI-proofing curriculum',         { vv: 'yes', vals: ['no','no','no','no'] }],
  ];
  const renderCell = (v) => {
    if (v === 'yes') return <Check className="w-5 h-5 lv-check" aria-label="yes" />;
    if (v === 'no')  return <XIcon  className="w-4 h-4 lv-cross" aria-label="no" />;
    return <span className="text-white/55 text-sm">{v}</span>;
  };
  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" id="compare" label="Comparison table">
      <div className="mb-12">
        <span className="lv-eyebrow mb-4">Side-by-side</span>
        <h2 className="lv-h2 text-white mt-5 max-w-3xl">Why pay 30× more for less?</h2>
        <p className="text-white/65 mt-4 max-w-2xl">
          We benchmarked Valuevade against the four programs most Indian finance students actually
          consider. Here&apos;s how it stacks up.
        </p>
      </div>
      <div className="overflow-x-auto" data-testid="comparison-table-wrap">
        <table className="lv-comp-table w-full min-w-[820px]" data-testid="comparison-table">
          <thead>
            <tr>
              <th>Feature</th>
              {cols.map((c, i) => (
                <th key={c} className={i === 0 ? 'lv-comp-col-vv-head' : ''}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, payload]) => (
              <tr key={label}>
                <td className="text-white/75 font-medium">{label}</td>
                <td className="lv-comp-col-vv">{renderCell(payload.vv)}</td>
                {payload.vals.map((v, i) => (
                  <td key={i}>{renderCell(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionFadeIn>
  );
}

/* --- HOW IT WORKS --------------------------------------------------- */
function HowItWorks() {
  const steps = [
    { n: '01', title: 'Sign up',                body: 'Tell Pari your target role: equity research, IB, FP&A, or analyst.' },
    { n: '02', title: 'Customise your path',    body: 'AI tailors the modules + sessions to skip what you know and double-down on what you don\u2019t.' },
    { n: '03', title: 'Learn, practise, simulate',body: 'Video lectures, structured notes, scored quizzes, and 68 real-world Excel sims.' },
    { n: '04', title: 'Land the job',           body: 'Mock interviews, recruiter-tuned resume, portfolio project, and NISM + CFI certifications.' },
  ];
  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" id="how-it-works" label="How it works">
      <div className="mb-14">
        <span className="lv-eyebrow mb-4">From signup to offer</span>
        <h2 className="lv-h2 text-white mt-5 max-w-3xl">A four-step path, designed end-to-end.</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
        <div className="hidden md:block absolute top-12 left-0 right-0 lv-step-line" aria-hidden="true" />
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#818cf8] flex items-center justify-center text-white font-bold text-sm mb-5 relative z-10 shadow-lg shadow-indigo-500/30">
              {s.n}
            </div>
            <h3 className="text-white font-semibold text-lg mb-2 tracking-tight">{s.title}</h3>
            <p className="text-white/65 text-sm leading-relaxed">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </SectionFadeIn>
  );
}

function Counter({ to, suffix = '' }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now(), dur = 1600;
    let raf;
    const tick = (t) => {
      const p = Math.min((t - start) / dur, 1);
      setN(Math.floor((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

/* --- CURRICULUM PREVIEW (constellation) ---------------------------- */
function CurriculumPreview() {  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" id="curriculum" label="Curriculum">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="lv-eyebrow mb-4">Module Constellation</span>
          <h2 className="lv-h2 text-white mt-5 mb-5">15 modules. 161 sessions. One map.</h2>
          <p className="text-white/65 mb-6 max-w-xl">
            From Module 1 (Foundations) to Module 15 (AI Capstone), each session is a discrete
            milestone with notes, a scored quiz, an AI interview check-in, and a hands-on Excel
            simulation. Navigate the constellation like a learning galaxy.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-sm">
            <div className="lv-card p-4 text-center">
              <div className="text-3xl font-bold text-white tracking-tight font-bricolage"><Counter to={15} /></div>
              <div className="text-xs text-white/55 mt-1">Modules</div>
            </div>
            <div className="lv-card p-4 text-center">
              <div className="text-3xl font-bold text-white tracking-tight font-bricolage"><Counter to={161} /></div>
              <div className="text-xs text-white/55 mt-1">Sessions</div>
            </div>
            <div className="lv-card p-4 text-center">
              <div className="text-3xl font-bold text-white tracking-tight font-bricolage"><Counter to={68} /></div>
              <div className="text-xs text-white/55 mt-1">Excel Sims</div>
            </div>
          </div>
        </div>
        <div className="relative">
          <CurriculumConstellation />
        </div>
      </div>
    </SectionFadeIn>
  );
}

function CurriculumConstellation() {
  // Render a 15-node serpentine
  const cols = 5;
  const cell = 90;
  const padX = 50, padY = 50;
  const nodes = [...Array(15)].map((_, i) => {
    const row = Math.floor(i / cols);
    const colIdx = row % 2 === 0 ? i % cols : (cols - 1) - (i % cols);
    return { x: padX + colIdx * cell, y: padY + row * cell, n: i + 1 };
  });
  const lines = nodes.slice(1).map((n, i) => ({ a: nodes[i], b: n }));
  return (
    <svg viewBox={`0 0 ${cell * cols + padX * 2} ${cell * 3 + padY * 2}`} className="w-full">
      <defs>
        <radialGradient id="vv-mod" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#fff" />
          <stop offset="55%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
        </radialGradient>
      </defs>
      {lines.map((l, i) => (
        <motion.path
          key={i}
          d={`M ${l.a.x} ${l.a.y} C ${l.a.x} ${(l.a.y + l.b.y)/2}, ${l.b.x} ${(l.a.y + l.b.y)/2}, ${l.b.x} ${l.b.y}`}
          stroke="rgba(129,140,248,0.4)" strokeWidth="1.2" fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: i * 0.06 }}
          viewport={{ once: true }}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <motion.circle
            cx={n.x} cy={n.y} r="22" fill="url(#vv-mod)" opacity="0.25"
            initial={{ scale: 0 }} whileInView={{ scale: 1 }}
            transition={{ delay: i * 0.05, type: 'spring' }}
            viewport={{ once: true }}
          />
          <circle cx={n.x} cy={n.y} r="14" fill="#06092e" stroke="#818cf8" strokeWidth="1.5" />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
            M{n.n}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* --- SOCIAL PROOF ---------------------------------------------------- */
function SocialProof() {
  const quotes = [
    { name: 'Ananya R.',  role: 'Aspiring Equity Analyst',    initials: 'AR', color: '#f5b800', quote: 'The Reliance DCF sim was the most "real" thing I\u2019ve built in any course. I shipped a working model in 90 minutes.' },
    { name: 'Karthik N.', role: 'CFA Level II Candidate',     initials: 'KN', color: '#818cf8', quote: 'Pari caught a conceptual gap in my WACC computation that my prep book never even hinted at.' },
    { name: 'Riya S.',    role: 'BCom 3rd year · Mumbai',     initials: 'RS', color: '#4ade80', quote: 'I never thought I\u2019d enjoy ratio analysis. The mock interview round at the end is unreasonably good.' },
    { name: 'Aditya P.',  role: 'IB intern transition',       initials: 'AP', color: '#f87171', quote: 'For ₹999, this is a steal. The certification + portfolio combo is the actual moat.' },
  ];
  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" id="testimonials" label="Beta tester quotes">
      <div className="mb-10">
        <span className="lv-eyebrow mb-4">Beta tester quotes</span>
        <h2 className="lv-h2 text-white mt-5 max-w-3xl">Early students, early signal.</h2>
        <p className="text-white/55 mt-3 text-sm italic">Quotes are from beta cohort; quantitative outcome data will follow public launch.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {quotes.map((q, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="lv-card p-5 flex flex-col"
          >
            <div className="flex gap-1 mb-3">
              {[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-[#f5b800] fill-[#f5b800]" />)}
            </div>
            <p className="text-white/80 text-sm leading-relaxed flex-1 mb-4">&ldquo;{q.quote}&rdquo;</p>
            <div className="flex items-center gap-3 pt-3 border-t border-white/10">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#06092e]" style={{ background: q.color }}>
                {q.initials}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{q.name}</div>
                <div className="text-white/50 text-xs">{q.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionFadeIn>
  );
}

/* --- PRICING --------------------------------------------------------- */
function PricingSection() {
  const benefits = [
    'Lifetime access to all 15 modules',
    '68 hands-on Excel finance simulations',
    'AI tutor "Pari", unlimited questions',
    '3-round AI mock interview capstone',
    'NISM + CFI certifications included',
    '20% commission on every referral',
  ];
  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" id="pricing" label="Pricing">
      <div className="text-center mb-12">
        <span className="lv-eyebrow mb-4">Pricing, one-time, lifetime</span>
        <h2 className="lv-h2 text-white mt-5">Pay once. Own it forever.</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
        <div className="lv-card p-7 relative" style={{ borderColor: 'rgba(245,184,0,0.55)' }} data-testid="landing-price-upfront">
          <span className="absolute -top-3 right-5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f5b800] text-[#1a1208]">Save ₹200</span>
          <h3 className="text-white font-bold text-xl tracking-tight mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#f5b800]" /> Pay Upfront</h3>
          <p className="text-white/55 text-sm mb-5">Locked in before sampling.</p>
          <div className="mb-6">
            <span className="text-5xl font-bold text-white tracking-tight font-bricolage">₹999</span>
            <span className="text-sm text-white/55 ml-2">one-time</span>
          </div>
          <ul className="space-y-2.5 mb-7">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/85"><Check className="w-4 h-4 mt-0.5 text-[#f5b800] flex-shrink-0" /> {b}</li>
            ))}
          </ul>
          <Link to="/start" className="lv-btn lv-btn-gold w-full justify-center">
            Pay ₹999, Lock In <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="lv-card p-7" data-testid="landing-price-trial">
          <h3 className="text-white font-bold text-xl tracking-tight mb-1">Try Free First</h3>
          <p className="text-white/55 text-sm mb-5">Session 1 fully free, then ₹999.</p>
          <div className="mb-6">
            <span className="text-5xl font-bold text-white tracking-tight font-bricolage">Free</span>
            <span className="text-sm text-white/55 ml-2">to start</span>
          </div>
          <ul className="space-y-2.5 mb-7">
            <li className="flex items-start gap-2 text-sm text-white/85"><Check className="w-4 h-4 mt-0.5 text-[#4ade80] flex-shrink-0" /> Full session #1, notes, quiz, AI interview, simulation</li>
            <li className="flex items-start gap-2 text-sm text-white/85"><Check className="w-4 h-4 mt-0.5 text-[#4ade80] flex-shrink-0" /> No card required</li>
            <li className="flex items-start gap-2 text-sm text-white/85"><Check className="w-4 h-4 mt-0.5 text-[#4ade80] flex-shrink-0" /> Upgrade anytime to unlock the rest</li>
            <li className="flex items-start gap-2 text-sm text-white/55 italic">Sessions 2+ require ₹999 lifetime upgrade</li>
          </ul>
          <Link to="/start" className="lv-btn lv-btn-ghost w-full justify-center">
            Start Free Session <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      <p className="text-center text-xs text-white/45 mt-8">
        WallStreet School: ₹50,000 · Imarticus: ₹1,20,000 · <span className="text-[#f5b800] font-semibold">Valuevade: ₹999</span>
      </p>
    </SectionFadeIn>
  );
}

/* --- FAQ ------------------------------------------------------------- */
function FAQ() {
  const items = [
    { q: 'Is this a real certificate?',
      a: 'Yes. On completion you receive NISM (SEBI-recognised) and CFI partner certificates, both verifiable, both genuinely respected by Indian recruiters. We bundle them so you don\u2019t pay separately.' },
    { q: 'How does the AI tutor work?',
      a: 'Pari sits inside every notes page, every quiz, every simulation. It has context about exactly what you\u2019re working on, your current cell in a DCF, your last quiz answer, your specific question, and answers like a senior analyst pair-debugging with you.' },
    { q: 'What if I don\u2019t get a job?',
      a: 'We can\u2019t promise placements, anyone who does is lying. What we can promise: every artefact a recruiter actually asks for (resume, portfolio, certification, mock-interview verdict) is delivered by week 12. Past that, it\u2019s on your shoulders and ours together.' },
    { q: 'Can I use this if I\u2019m a CFA candidate?',
      a: 'Yes. We map our modules to CFA Level I & II curriculum. Most CFA candidates use Valuevade to supplement the dry prep books with practical, hands-on application.' },
    { q: 'Refund policy?',
      a: 'Full refund within 7 days, no questions asked. After 7 days we don\u2019t refund, but you get lifetime access regardless, so there\u2019s no real downside.' },
    { q: 'Why is it so cheap?',
      a: 'Two reasons. (1) AI infrastructure scales better than human instructors, so we don\u2019t need to charge ₹50k to break even. (2) We\u2019re explicitly trying to undercut the offline-coaching cartel that\u2019s been gatekeeping finance careers in India. ₹999 is the price of a textbook, not a course.' },
    { q: 'Who teaches the course?',
      a: 'The curriculum was authored by a team with backgrounds at top equity-research desks in Mumbai. Day-to-day, your "teacher" is Pari, the AI tutor, who can answer at any depth, any hour, in any language.' },
    { q: 'How long does it actually take?',
      a: 'Self-paced. Median student finishes the core in 8 weeks at ~6 hours/week. Heaviest users hit 4 weeks. Slowest take ~12 weeks. There\u2019s no expiry, go at your pace.' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <SectionFadeIn className="relative max-w-3xl mx-auto px-6 py-24" id="faq" label="FAQ">
      <div className="mb-10 text-center">
        <span className="lv-eyebrow mb-4">Frequently asked</span>
        <h2 className="lv-h2 text-white mt-5">Honest answers to honest questions.</h2>
      </div>
      <div className="space-y-3">
        {items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="lv-card overflow-hidden" data-testid={`faq-item-${i}`}>
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full px-5 py-4 flex items-center justify-between text-left text-white font-medium hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-base">{it.q}</span>
                <ChevronDown className={`w-4 h-4 text-white/55 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className="lv-accordion-body" style={{ maxHeight: isOpen ? 500 : 0, opacity: isOpen ? 1 : 0 }}>
                <div className="px-5 pb-5 text-white/65 text-sm leading-relaxed border-t border-white/5 pt-3">
                  {it.a}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionFadeIn>
  );
}

/* --- FINAL CTA ------------------------------------------------------- */
function FinalCTA() {
  return (
    <SectionFadeIn className="relative max-w-7xl mx-auto px-6 py-24" label="Final call to action">
      <div className="relative overflow-hidden rounded-3xl px-8 py-16 md:px-16 md:py-24 text-center" style={{ background: 'linear-gradient(135deg, #0a1156 0%, #4f46e5 60%, #f5b800 200%)' }}>
        <div className="lv-mesh" aria-hidden="true" style={{ opacity: 0.6 }} />
        <div className="relative">
          <h2 className="lv-h2 text-white mb-5">Stop watching tutorials.<br className="hidden md:block" /> Start landing offers.</h2>
          <p className="text-white/80 max-w-xl mx-auto mb-9 text-lg">
            Join the cohort that will sit on the other side of the interview desk in 12 weeks.
          </p>
          <Link to="/start" className="lv-btn lv-btn-gold inline-flex" style={{ padding: '16px 28px', fontSize: 16 }} data-testid="final-cta">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-white/55 text-xs mt-4">₹999 lifetime · 7-day refund · No subscription</p>
        </div>
      </div>
    </SectionFadeIn>
  );
}

/* --- FOOTER ---------------------------------------------------------- */
function LandingFooter() {
  return (
    <footer className="relative max-w-7xl mx-auto px-6 py-14 border-t border-white/10" data-testid="landing-footer">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
        <div className="col-span-2">
          <Link to="/" className="flex items-center gap-2 mb-3">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-7 h-7" />
            <span className="text-white font-bold tracking-tight text-lg">Valuevade</span>
          </Link>
          <p className="text-white/55 text-sm max-w-md leading-relaxed">
            AI-personalised finance career platform. Built in India, for Indian students.
            CFA/FRM-aligned. NISM + CFI certified.
          </p>
        </div>
        <div>
          <div className="text-white text-sm font-semibold mb-3">Product</div>
          <ul className="space-y-2 text-sm text-white/60">
            <li><a href="#features" className="hover:text-white">Features</a></li>
            <li><a href="#curriculum" className="hover:text-white">Curriculum</a></li>
            <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
            <li><Link to="/start" className="hover:text-white">Start Free</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-white text-sm font-semibold mb-3">Legal</div>
          <ul className="space-y-2 text-sm text-white/60">
            <li><a href="/privacy" className="hover:text-white">Privacy Policy</a></li>
            <li><a href="/terms" className="hover:text-white">Terms of Use</a></li>
            <li><a href="/refund" className="hover:text-white">Refund Policy</a></li>
            <li><a href="mailto:info@valuevade.com" className="hover:text-white">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
        <div className="text-xs text-white/45">
          © {new Date().getFullYear()} Valuevade · Made in India 🇮🇳
        </div>
        <div className="flex items-center gap-3">
          <a href="https://linkedin.com/company/valuevade" aria-label="LinkedIn" className="text-white/55 hover:text-white"><Linkedin className="w-4 h-4" /></a>
          <a href="https://twitter.com/valuevade" aria-label="Twitter" className="text-white/55 hover:text-white"><Twitter className="w-4 h-4" /></a>
          <a href="https://youtube.com/@valuevade" aria-label="YouTube" className="text-white/55 hover:text-white"><Youtube className="w-4 h-4" /></a>
        </div>
      </div>
    </footer>
  );
}

/* === MAIN =========================================================== */
export default function LandingPageV2() {
  return (
    <div className="lv-root min-h-screen" data-testid="landing-page-v2">
      <Helmet>
        <html lang="en" />
        <title>Valuevade, Land your equity research job with AI · ₹999 lifetime course</title>
        <meta name="description" content="India's first AI-personalised finance career program. CFA/FRM prep, real-Indian-market simulations, 24/7 AI tutor, mock interviews, NISM + CFI certifications. ₹999 lifetime." />
        <meta name="keywords" content="equity research course India, CFA FRM prep, AI finance tutor, NISM certification, finance career India, equity analyst training, financial modeling course, AI for finance students" />
        <link rel="canonical" href="https://valuevade.com/" />
        <meta name="theme-color" content="#06092e" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://valuevade.com/" />
        <meta property="og:title" content="Valuevade, Land your equity research job with AI · ₹999 lifetime" />
        <meta property="og:description" content="AI-personalised finance career program. CFA/FRM prep, real-Indian-market sims, NISM + CFI certs. ₹999 lifetime." />
        <meta property="og:image" content="https://valuevade.com/valuevade-logo.png" />
        <meta property="og:site_name" content="Valuevade" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Valuevade, AI-personalised finance career platform" />
        <meta name="twitter:description" content="₹999 lifetime · CFA/FRM prep · AI tutor · NISM + CFI certifications · Mock interviews · 68 finance simulations." />
        <meta name="twitter:image" content="https://valuevade.com/valuevade-logo.png" />
        {/* Structured data */}
        <script type="application/ld+json">{JSON.stringify(courseJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
      </Helmet>

      <LandingNav />
      <HeroSection />
      <WhyNowStrip />
      <FeatureGrid />
      <ComparisonTable />
      <HowItWorks />
      <CurriculumPreview />
      <SocialProof />
      <PricingSection />
      <FAQ />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
