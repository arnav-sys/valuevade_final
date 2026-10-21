const ARTWORK = {
  ai: { file: 'claude', alt: 'An annual report connected to an AI copilot and a rising price chart' },
  research: { file: 'er-certs', alt: 'A research chart under a magnifying glass beside a certification medal' },
  roadmap: { file: 'roadmap', alt: 'Five milestones on a rising path towards becoming an equity research analyst' },
  career: { file: 'career', alt: 'A finance career card examined through a magnifying glass' },
  certification: { file: 'certs', alt: 'Certification milestones along an upward career path' },
};

/** Original artwork extracted losslessly in composition from the supplied brand PDFs. */
export const BrandArtwork = ({ variant = 'ai', className = '', testId, eager = false }) => {
  const art = ARTWORK[variant] || ARTWORK.ai;
  return (
    <figure className={`vv-brand-art ${className}`} data-testid={testId}>
      <img src={`/brand/${art.file}-art.webp`} alt={art.alt} width="1520" height="756"
        loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} />
    </figure>
  );
};

export const AuthBrandPanel = ({ testId }) => (
  <aside className="vv-auth-story" data-testid={testId}>
    <p className="vv-eyebrow">VALUEVADE · YOUR NEXT CHAPTER</p>
    <h2>Don’t just learn finance.<br /><span>Become the analyst.</span></h2>
    <p className="vv-editorial-note">Real skills. Original thinking. An unfair advantage in the age of AI.</p>
    <BrandArtwork variant="research" testId={`${testId}-artwork`} eager />
    <div className="vv-auth-folio"><span>LEARN · BUILD · BECOME</span><span>YOUR FUTURE, FORWARD ↗</span></div>
  </aside>
);