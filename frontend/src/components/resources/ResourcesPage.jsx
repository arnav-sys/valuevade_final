import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Search, ArrowUpRight, ArrowLeft, Download, Check, ShieldCheck,
  Unlock, Lock, FileText, Sparkles, BookOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BusinessNav, BusinessFooter } from '../enterprise/BusinessNav';
import { businessApi, money, CATEGORIES } from '../enterprise/api';
import { ResourcePreview, SAMPLE_RESOURCES } from './ResourcePreview';
import { loadRazorpayCheckout } from '../../utils/razorpay';
import '../enterprise/enterprise.css';

const Shell = ({ children }) => (
  <div className="biz-page resource-page">
    <BusinessNav />
    <main>{children}</main>
    <BusinessFooter />
  </div>
);

// ─── Enrollment banner ────────────────────────────────────────────────────────
function EnrollmentBanner() {
  return (
    <div
      className="resource-enrolled-banner"
      data-testid="enrolled-access-banner"
      style={{
        background: 'linear-gradient(135deg, rgba(36,107,253,0.10) 0%, rgba(124,58,237,0.10) 100%)',
        border: '1px solid rgba(36,107,253,0.25)',
        borderRadius: '14px',
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '28px',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'rgba(36,107,253,0.15)',
        border: '1px solid rgba(36,107,253,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#246BFD', flexShrink: 0,
      }}>
        <Unlock size={18} />
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem' }}>
          All resources unlocked — included in your enrolment
        </p>
        <p style={{ margin: '2px 0 0', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
          Download any resource below for free. Your enrolment covers all current and future templates.
        </p>
      </div>
    </div>
  );
}

// ─── Catalog page ─────────────────────────────────────────────────────────────
export default function ResourcesPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All resources');
  const [search, setSearch] = useState('');
  const [enrolled, setEnrolled] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    businessApi('/resources')
      .then(d => setItems(d.items))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Check enrollment status for the logged-in user.
  useEffect(() => {
    if (!session?.access_token) return;
    businessApi('/resources/my-library', { token: session.access_token })
      .then(d => setEnrolled(d.has_access === true))
      .catch(() => setEnrolled(false));
  }, [session?.access_token]);

  const previews = !loading && !items.length;
  const list = previews ? SAMPLE_RESOURCES : items;
  const visible = list.filter(x =>
    (category === 'All resources' || x.category === category) &&
    `${x.title} ${x.description}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Shell>
      <Helmet><title>Finance Resources &amp; Templates | Valuevade</title></Helmet>

      <section className="resource-heading">
        <p className="biz-eyebrow">VALUEVADE / THE RESOURCE LIBRARY</p>
        <h1>Less blank-page work.<br /><em>More thinking time.</em></h1>
        <p>
          Financial models, research frameworks and practical tools
          <br />for the work that comes next.
        </p>
        <Link className="biz-text-link" to="/resources/library" data-testid="resources-my-downloads">
          <Download size={17} /> {enrolled ? 'My resource library' : 'My downloads'}
        </Link>
      </section>

      <section className="resource-catalog" data-testid="resources-catalog">
        {enrolled && <EnrollmentBanner />}

        <div className="resource-filter-bar">
          <label className="resource-search">
            <Search size={17} />
            <input
              aria-label="Search resources"
              placeholder="Find your next advantage…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="resources-search"
            />
          </label>
          <label className="resource-category-label">
            Category
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              data-testid="resources-category"
            >
              {['All resources', ...CATEGORIES].map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>

        {error && (
          <div className="biz-alert" role="status" data-testid="resources-status">
            The resource library is being prepared.
            <button onClick={load} data-testid="resources-retry">Refresh</button>
          </div>
        )}
        {previews && !error && (
          <p className="biz-fine-print" data-testid="resources-preview-note">
            Template concepts below are illustrative. Published resources will appear here.
          </p>
        )}

        {loading ? (
          <p data-testid="resources-loading">Loading resources…</p>
        ) : (
          <>
            <div className="resource-results" data-testid="resources-result-count">
              {visible.length} {previews ? 'previews' : 'resources'}
              <span>BUILT FOR FINANCE</span>
            </div>
            <div className="resource-grid">
              {visible.map(item => (
                <article key={item.id} className="resource-card" data-testid={`resource-card-${item.id}`}>
                  <Link
                    to={`/resources/${item.id}`}
                    data-testid={`resource-cover-${item.id}`}
                    aria-label={`View ${item.title}`}
                  >
                    <ResourcePreview item={item} />
                  </Link>
                  <div className="resource-card-body">
                    <p className="biz-eyebrow">{item.category}</p>
                    <h2>
                      <Link to={`/resources/${item.id}`} data-testid={`resource-title-${item.id}`}>
                        {item.title}
                      </Link>
                    </h2>
                    <p>{item.description}</p>
                    <div className="resource-card-bottom">
                      {enrolled ? (
                        <span
                          style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                          data-testid={`resource-enrolled-badge-${item.id}`}
                        >
                          <Unlock size={12} /> Included
                        </span>
                      ) : (
                        <strong data-testid={`resource-price-${item.id}`}>
                          {item.sample ? 'Concept preview' : item.price_paise === 0 ? 'Free' : money(item.price_paise / 100)}
                        </strong>
                      )}
                      <Link
                        to={`/resources/${item.id}`}
                        data-testid={`resource-open-${item.id}`}
                      >
                        {enrolled ? 'Download' : item.sample ? 'Preview' : 'View resource'}
                        <ArrowUpRight size={16} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!visible.length && (
              <p className="biz-empty" data-testid="resources-empty">No resources match your search.</p>
            )}
          </>
        )}
      </section>
    </Shell>
  );
}

// ─── Resource detail page ─────────────────────────────────────────────────────
export function ResourceDetailsPage() {
  const { resourceId } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(true);
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setItem(null); setError(''); setPaid(false);
    const sample = SAMPLE_RESOURCES.find(x => x.id === resourceId);
    if (sample) { setItem(sample); return; }
    businessApi(`/resources/${resourceId}`).then(setItem).catch(e => setError(e.message));
  }, [resourceId]);

  // Check enrollment
  useEffect(() => {
    if (!session?.access_token) { setEnrollmentLoading(false); return; }
    businessApi('/resources/my-library', { token: session.access_token })
      .then(d => setEnrolled(d.has_access === true))
      .catch(() => setEnrolled(false))
      .finally(() => setEnrollmentLoading(false));
  }, [session?.access_token]);

  const download = async () => {
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    setBusy(true); setError('');
    try {
      const d = await businessApi(`/resources/${resourceId}/download`, {
        method: 'POST',
        token: session?.access_token,
      });
      // For sample CSV endpoint, do a GET with auth header
      if (d.is_sample) {
        const resp = await fetch(d.url, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!resp.ok) throw new Error('Sample generation failed. Please retry.');
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const cd = resp.headers.get('Content-Disposition') || '';
        a.download = cd.match(/filename="([^"]+)"/)?.[1] || `${item?.title || 'resource'}_sample.csv`;
        a.click();
      } else {
        window.location.assign(d.url);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const buy = async () => {
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    setBusy(true); setError('');
    try {
      const order = await businessApi(`/resources/${resourceId}/order`, { method: 'POST', token: session?.access_token });
      if (order.owned || order.free) { setPaid(true); setBusy(false); return; }
      const Razorpay = await loadRazorpayCheckout();
      const checkout = new Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency,
        order_id: order.order_id, name: 'Valuevade', description: item.title,
        prefill: { email: user.email },
        handler: async response => {
          try {
            await businessApi('/resources/payment/verify', { method: 'POST', token: session?.access_token, body: response });
            setPaid(true);
          } catch (e) { setError(e.message + ' You can also check the payment in My downloads.'); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => { setBusy(false); setError('Checkout closed. No download unlocked. Check My downloads if a payment was made.'); } },
        theme: { color: '#246BFD' },
      });
      checkout.on('payment.failed', () => { setBusy(false); setError('Payment was not completed. Please retry or check My downloads.'); });
      checkout.open();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  // Enrolled users can download any resource (sample CSV if no file uploaded).
  // Non-enrolled users can download if they individually purchased.
  const canDownload = enrolled || paid;
  const isFree = item?.price_paise === 0;

  return (
    <Shell>
      <section className="resource-detail" data-testid="resource-detail">
        <Link to="/resources" className="biz-text-link" data-testid="resource-back">
          <ArrowLeft size={16} /> All resources
        </Link>

        {item ? (
          <div className="resource-detail-grid">
            <ResourcePreview item={item} />
            <div>
              <p className="biz-eyebrow">{item.category}</p>
              <h1>{item.title}</h1>
              <p>{item.description}</p>
              <ul className="biz-checks">
                {item.includes.map((x, i) => (
                  <li key={i} data-testid={`resource-includes-${i}`}><Check size={16} />{x}</li>
                ))}
              </ul>

              {item.sample ? (
                <div className="biz-alert" data-testid="resource-sample-notice">
                  Concept preview — not for sale. Final files and pricing will appear when this resource is published.
                </div>
              ) : enrollmentLoading ? (
                /* Loading skeleton while enrollment check is in-flight */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="enrollment-loading">
                  <div style={{ height: 42, borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 42, borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', textAlign: 'center' }}>Checking your access…</p>
                </div>
              ) : enrolled ? (
                /* ── Enrolled user: free instant download ── */
                <div data-testid="resource-enrolled-access">
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                  }}>
                    <Unlock size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontWeight: 600 }}>
                      Included in your enrolment — download free
                    </span>
                  </div>
                  <button
                    className="biz-button biz-button-primary"
                    disabled={busy}
                    onClick={download}
                    data-testid="resource-download-btn"
                  >
                    {busy ? 'Preparing…' : 'Download resource'} <Download size={18} />
                  </button>
                  <p className="biz-fine-print" style={{ marginTop: 8 }}>
                    <ShieldCheck size={15} /> Secure access via your Valuevade enrolment.
                    {' '}Your download will be ready immediately.
                  </p>
                </div>
              ) : (
                /* ── Non-enrolled: enrol prompt or buy ── */
                <>
                  <strong className="resource-detail-price" data-testid="resource-detail-price">
                    {item.price_paise === 0 ? 'Included with enrolment' : money(item.price_paise / 100)}
                  </strong>
                  {item.file_type && (
                    <p className="biz-fine-print" data-testid="resource-file-meta">
                      {item.file_type} · {Math.max(1, Math.round((item.file_size || 1024) / 1024))} KB
                    </p>
                  )}
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(36,107,253,0.06)', border: '1px solid rgba(36,107,253,0.15)', marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      <Sparkles size={13} style={{ display: 'inline', marginRight: 4 }} />
                      Enrol in a Valuevade course to unlock all resources for free.{' '}
                      <Link to="/courses" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>View courses →</Link>
                    </p>
                  </div>
                  {isFree ? (
                    // Free resource: prompt enrollment rather than showing a broken download
                    <Link
                      to="/courses"
                      className="biz-button biz-button-primary"
                      style={{ display: 'inline-flex', textDecoration: 'none' }}
                      data-testid="resource-purchase-button"
                    >
                      Enrol to access for free <ArrowUpRight size={18} />
                    </Link>
                  ) : (
                    // Paid resource: Razorpay buy flow
                    <button
                      className="biz-button biz-button-primary"
                      disabled={busy}
                      onClick={canDownload ? download : buy}
                      data-testid="resource-purchase-button"
                    >
                      {busy ? 'Please wait…' : canDownload ? 'Download resource' : !user ? 'Sign in to continue' : 'Buy resource'}
                      <Download size={18} />
                    </button>
                  )}
                  <p className="biz-fine-print">
                    <ShieldCheck size={15} /> Access unlocks immediately after payment or enrolment.
                  </p>
                  {paid && (
                    <p className="biz-success" role="status" data-testid="resource-unlocked">
                      Your resource is ready to download.
                    </p>
                  )}
                </>
              )}
              <Link to="/resources/library" className="biz-text-link" data-testid="resource-library-link">
                My downloads <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        ) : !error ? (
          <p data-testid="resource-loading">Loading resource…</p>
        ) : null}
        {error && <p className="biz-alert" role="alert" data-testid="resource-error">{error}</p>}
      </section>
    </Shell>
  );
}

// ─── Resource library page (enrolled = all resources; others = purchases) ─────
export function ResourceLibraryPage() {
  const { session } = useAuth();
  const [library, setLibrary] = useState({ resources: [], orders: [], access_type: null, has_access: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    if (!session?.access_token) { setLoading(false); return; }
    setError(''); setLoading(true);
    businessApi('/resources/my-library', { token: session.access_token })
      .then(setLibrary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  useEffect(() => { load(); }, [load]);

  const downloadResource = async (resourceId, title) => {
    setBusy(resourceId); setError('');
    try {
      const d = await businessApi(`/resources/${resourceId}/download`, {
        method: 'POST', token: session?.access_token,
      });
      if (d.is_sample) {
        const resp = await fetch(d.url, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!resp.ok) throw new Error('Sample generation failed. Please retry.');
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const cd = resp.headers.get('Content-Disposition') || '';
        a.download = cd.match(/filename="([^"]+)"/)?.[1] || `${title || 'resource'}_sample.csv`;
        a.click();
      } else {
        window.location.assign(d.url);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const downloadOrder = async (order) => {
    setBusy(order.id); setError('');
    try {
      if (order.status === 'paid') {
        const d = await businessApi(`/resources/${order.resource_id}/download`, {
          method: 'POST', token: session?.access_token,
        });
        window.location.assign(d.url);
      } else {
        await businessApi(`/resources/purchases/${order.id}/check`, { method: 'POST', token: session?.access_token });
        load();
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const isEnrolled = library.has_access;

  return (
    <Shell>
      <section className="resource-library" data-testid="resource-library">
        <p className="biz-eyebrow">YOUR VALUEVADE TOOLKIT</p>
        <h1>{isEnrolled ? 'Your resource library.' : 'My downloads.'}</h1>

        {isEnrolled && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', borderRadius: 12, marginBottom: 24,
            background: 'rgba(36,107,253,0.07)', border: '1px solid rgba(36,107,253,0.2)',
          }}
            data-testid="library-enrolled-banner"
          >
            <Unlock size={18} style={{ color: '#246BFD', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.93rem', color: 'var(--color-text)' }}>
                All {library.resources.length} resources unlocked via enrolment
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Download any template below — they're all included in your course.
              </p>
            </div>
          </div>
        )}

        <Link to="/resources" className="biz-text-link" data-testid="library-browse">
          Browse resources <ArrowUpRight size={16} />
        </Link>

        {error && (
          <div className="biz-alert" role="alert" data-testid="library-error">
            {error}
            <button onClick={load} data-testid="library-retry">Retry</button>
          </div>
        )}

        {loading ? (
          <p data-testid="library-loading">Loading your library…</p>
        ) : isEnrolled ? (
          /* ── Enrolled: show all resources ── */
          library.resources.length > 0 ? (
            <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
              {library.resources.map(r => (
                <article
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 16, padding: '14px 18px', borderRadius: 12,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  }}
                  data-testid={`library-resource-${r.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'rgba(36,107,253,0.10)', border: '1px solid rgba(36,107,253,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#246BFD', flexShrink: 0,
                    }}>
                      <FileText size={16} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.93rem', color: 'var(--color-text)' }}>
                        {r.title}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {r.category}
                        {r.file_type ? ` · ${r.file_type}` : ' · CSV sample'}
                      </p>
                    </div>
                  </div>
                  <button
                    className="biz-button biz-button-outline"
                    disabled={!!busy}
                    onClick={() => downloadResource(r.id, r.title)}
                    data-testid={`library-download-${r.id}`}
                    style={{ flexShrink: 0 }}
                  >
                    {busy === r.id ? 'Preparing…' : 'Download'} <Download size={15} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="biz-empty" data-testid="library-empty">No resources published yet. Check back soon.</p>
          )
        ) : (
          /* ── Non-enrolled: show purchases ── */
          library.orders && library.orders.length > 0 ? (
            library.orders.map(o => (
              <article className="resource-order" key={o.id} data-testid={`resource-order-${o.id}`}>
                <div>
                  <h2>{o.marketplace_resources?.title || 'Resource'}</h2>
                  <p>
                    {money(o.amount_paise / 100)} · {o.status === 'created' ? 'Awaiting payment verification' : o.status}
                  </p>
                </div>
                <button
                  className="biz-button biz-button-outline"
                  disabled={!!busy || o.status === 'refunded'}
                  onClick={() => downloadOrder(o)}
                  data-testid={`resource-order-action-${o.id}`}
                >
                  {busy === o.id ? 'Checking…' : o.status === 'paid' ? 'Download' : o.status === 'refunded' ? 'Refunded' : 'Check payment'}
                  <Download size={16} />
                </button>
              </article>
            ))
          ) : !error ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }} data-testid="library-empty">
              <div style={{
                width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
                background: 'rgba(36,107,253,0.08)', border: '1px solid rgba(36,107,253,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#246BFD',
              }}>
                <BookOpen size={22} />
              </div>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
                Enrol in a Valuevade course to unlock all resources for free.
              </p>
              <Link to="/courses" className="biz-button biz-button-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                View courses <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : null
        )}
      </section>
    </Shell>
  );
}
