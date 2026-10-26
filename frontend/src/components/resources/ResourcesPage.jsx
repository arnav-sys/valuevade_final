import { useEffect, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, ArrowUpRight, Receipt, Unlock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { businessApi, money, CATEGORIES } from '../enterprise/api';
import { ResourcePreview, SAMPLE_RESOURCES } from './ResourcePreview';
import { ResourceShell } from './ResourceShell';
import '../enterprise/enterprise.css';
export { default as ResourceDetailsPage } from './ResourceDetailsPage';
export const ResourceLibraryPage = () => <Navigate to="/purchases" replace />;

export default function ResourcesPage() {
  const { is_enrolled: enrolled, enrollmentLoading, enrollmentError, refreshEnrollment } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [category, setCategory] = useState('All resources'); const [search, setSearch] = useState('');
  const load = useCallback(() => {
    setLoading(true); setError(''); businessApi('/resources').then(d => setItems(d.items)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const previews = !loading && !error && !items.length;
  const visible = (previews ? SAMPLE_RESOURCES : items).filter(x => (category === 'All resources' || x.category === category) && `${x.title} ${x.description}`.toLowerCase().includes(search.toLowerCase()));
  return <ResourceShell><Helmet><title>Finance Resources &amp; Templates | Valuevade</title></Helmet>
    <section className="resource-heading"><p className="biz-eyebrow">VALUEVADE / THE RESOURCE LIBRARY</p><h1 data-testid="resources-heading">Less blank-page work.<br /><em>More thinking time.</em></h1><p>Financial models, research frameworks and practical tools<br />for the work that comes next.</p><Link className="biz-text-link" to="/purchases" data-testid="resources-my-downloads"><Receipt size={17} />My purchases</Link></section>
    <section className="resource-catalog" data-testid="resources-catalog">
      {enrolled && <div className="resource-access-banner" data-testid="enrolled-access-banner"><Unlock size={22} /><div><strong>Free · Included in your course</strong><p>All published resources are part of your enrolment.</p></div></div>}
      {enrollmentError && <p className="biz-alert" role="alert" data-testid="resources-enrollment-error">{enrollmentError}<button onClick={() => refreshEnrollment()} data-testid="resources-enrollment-retry">Retry</button></p>}
      <div className="resource-filter-bar"><label className="resource-search"><Search size={17} /><input aria-label="Search resources" placeholder="Find your next advantage…" value={search} onChange={e => setSearch(e.target.value)} data-testid="resources-search" /></label><label className="resource-category-label">Category<select value={category} onChange={e => setCategory(e.target.value)} data-testid="resources-category">{['All resources', ...CATEGORIES].map(c => <option key={c}>{c}</option>)}</select></label></div>
      {error && <div className="biz-alert" role="alert" data-testid="resources-status">{error}<button onClick={load} data-testid="resources-retry">Retry</button></div>}
      {previews && <p className="biz-fine-print" data-testid="resources-preview-note">Template concepts below are illustrative. Published resources will appear here.</p>}
      {loading ? <p data-testid="resources-loading">Loading resources…</p> : !error && <><div className="resource-results" data-testid="resources-result-count">{visible.length} {previews ? 'previews' : 'resources'}<span>BUILT FOR FINANCE</span></div>
        <div className="resource-grid">{visible.map(item => <article key={item.id} className="resource-card" data-testid={`resource-card-${item.id}`}>
          <Link to={`/resources/${item.id}`} data-testid={`resource-cover-${item.id}`} aria-label={`View ${item.title}`}><ResourcePreview item={item} /></Link>
          <div className="resource-card-body"><p className="biz-eyebrow">{item.category}</p><h2><Link to={`/resources/${item.id}`} data-testid={`resource-title-${item.id}`}>{item.title}</Link></h2><p>{item.description}</p>
            {!item.sample && !item.file_available && <p className="biz-fine-print" data-testid={`resource-availability-${item.id}`}>File coming soon</p>}
            <div className="resource-card-bottom">{enrollmentLoading ? <span data-testid={`resource-access-loading-${item.id}`}>Checking access…</span> : enrolled ? <span className="resource-included-label" data-testid={`resource-enrolled-badge-${item.id}`}><Unlock size={12} />Free · Included</span> : <strong data-testid={`resource-price-${item.id}`}>{item.sample ? 'Concept preview' : item.price_paise === 0 ? 'Course inclusion' : money(item.price_paise / 100)}</strong>}
              <Link to={`/resources/${item.id}`} data-testid={`resource-open-${item.id}`}>{item.sample ? 'Preview' : enrolled && item.file_available ? 'Download' : 'View resource'}<ArrowUpRight size={16} /></Link></div>
          </div></article>)}</div>{!visible.length && <p className="biz-empty" data-testid="resources-empty">No resources match your search.</p>}</>}
    </section></ResourceShell>;
}