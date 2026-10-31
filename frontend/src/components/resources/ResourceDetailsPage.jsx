import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, ShieldCheck, Unlock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { businessApi, money } from '../enterprise/api';
import { loadRazorpayCheckout } from '../../utils/razorpay';
import { ResourcePreview, SAMPLE_RESOURCES } from './ResourcePreview';
import { ResourceShell } from './ResourceShell';
import { ResourceDownloadButton, downloadResource } from './ResourceDownloadButton';

export default function ResourceDetailsPage() {
  const { resourceId } = useParams(); const navigate = useNavigate(); const location = useLocation();
  const { user, session, is_enrolled: enrolled, enrollmentLoading, enrollmentError, refreshEnrollment } = useAuth();
  const [item, setItem] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [ownership, setOwnership] = useState(null); const [retry, setRetry] = useState(0);
  const token = session?.access_token;
  useEffect(() => {
    let alive = true; setItem(null); setError('');
    const sample = SAMPLE_RESOURCES.find(x => x.id === resourceId);
    if (sample) { setItem(sample); return; }
    businessApi(`/resources/${resourceId}`).then(d => { if (alive) setItem(d); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [resourceId, retry]);
  useEffect(() => {
    let alive = true; setOwnership(null);
    if (!token || enrolled !== false) return;
    businessApi('/resources/purchases', { token }).then(orders => {
      if (alive) setOwnership({ userId: user.id, resourceId, paid: orders.some(o => o.resource_id === resourceId && o.status === 'paid') });
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [token, user?.id, resourceId, enrolled, retry]);
  const paid = ownership?.userId === user?.id && ownership?.resourceId === resourceId && ownership?.paid;
  const [downloadingId, setDownloadingId] = useState('');
  const downloading = async fileId => {
    setDownloadingId(fileId); setError('');
    try { await downloadResource(resourceId, fileId, token); } catch (e) { setError(e.message); } finally { setDownloadingId(''); }
  };
  const markOwned = () => setOwnership({ userId: user.id, resourceId, paid: true });
  const buy = async () => {
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    setBusy(true); setError('');
    try {
      const order = await businessApi(`/resources/${resourceId}/order`, { method: 'POST', token });
      if (order.owned) { markOwned(); if (order.included_in_course) refreshEnrollment(); setBusy(false); return; }
      const Razorpay = await loadRazorpayCheckout();
      const checkout = new Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: 'Valuevade', description: item.title, prefill: { email: user.email }, theme: { color: '#246BFD' },
        handler: async response => {
          try { await businessApi('/resources/payment/verify', { method: 'POST', token, body: response }); markOwned(); }
          catch (e) { setError(`${e.message} Check My purchases for payment status.`); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => { setBusy(false); setError('Checkout closed. If charged, check the payment in My purchases.'); } },
      });
      checkout.on('payment.failed', () => { setBusy(false); setError('Payment was not completed. Please retry or check My purchases.'); });
      checkout.open();
    } catch (e) { setError(e.message); setBusy(false); }
  };
  const checking = enrollmentLoading || (!!user && enrolled === false && !ownership && !error);
  return <ResourceShell><section className="resource-detail" data-testid="resource-detail">
    <Link to="/resources" className="biz-text-link" data-testid="resource-back"><ArrowLeft size={16} />All resources</Link>
    {item ? <div className="resource-detail-grid"><ResourcePreview item={item} /><div>
      <p className="biz-eyebrow" data-testid="resource-category-name">{item.category}</p><h1 data-testid="resource-detail-title">{item.title}</h1><p data-testid="resource-description">{item.description}</p>
      <ul className="biz-checks">{(item.includes || []).map((x, i) => <li key={i} data-testid={`resource-includes-${i}`}><Check size={16} />{x}</li>)}</ul>
      {item.file_available && !(enrolled || paid) && <p className="biz-fine-print" data-testid="resource-file-meta">{item.files.length} file{item.files.length > 1 ? 's' : ''} included</p>}
      {item.sample ? <div className="biz-alert" data-testid="resource-sample-notice">Concept preview — not for sale.</div> : checking ? <p role="status" data-testid="enrollment-loading">Checking your access…</p> : enrollmentError && enrolled === null ? <p role="alert" className="biz-alert" data-testid="resource-enrollment-error">{enrollmentError}<button onClick={() => refreshEnrollment()} data-testid="resource-enrollment-retry">Retry</button></p> : enrolled || paid ? <div data-testid={enrolled ? 'resource-enrolled-access' : 'resource-purchased-access'}>
        <p className="resource-included-label" data-testid="resource-access-label"><Unlock size={16} />{enrolled ? 'Free · Included in course' : 'Purchased · Access unlocked'}</p>
        {item.file_available ? <ul className="resource-detail-files" data-testid="resource-file-list">{item.files.map(f => <li className="resource-detail-file-row" key={f.id} data-testid={`resource-file-${f.id}`}><span>{f.file_name}<small>{f.file_type} · {(f.file_size / 1024).toFixed(1)} KB</small></span><ResourceDownloadButton available busy={downloadingId === f.id} onClick={() => downloading(f.id)} testId={`resource-download-btn-${f.id}`} /></li>)}</ul> : <ResourceDownloadButton available={false} busy={false} onClick={() => {}} testId="resource-download-btn" />}
        <p className="biz-fine-print" data-testid="resource-download-notice"><ShieldCheck size={15} />{item.file_available ? 'Private download · Original uploaded files' : 'Your access is saved. Files will appear here once uploaded.'}</p>
      </div> : <>
        <strong className="resource-detail-price" data-testid="resource-detail-price">{item.price_paise ? money(item.price_paise / 100) : 'Included with enrolment'}</strong>
        {!item.file_available && <p className="resource-soon" data-testid="resource-file-coming-soon">File coming soon</p>}
        <p className="biz-fine-print">Free with your Valuevade course.</p>
        {item.price_paise > 0 ? <button className="biz-button biz-button-primary" disabled={busy || !item.file_available || (!!user && enrolled === false && ownership === null && !error)} onClick={buy} data-testid="resource-purchase-button">{busy ? 'Please wait…' : !item.file_available ? 'File coming soon' : user ? 'Buy resource' : 'Sign in to continue'}<ArrowUpRight size={16} /></button> : <Link to="/courses" className="biz-button biz-button-primary" data-testid="resource-purchase-button">Enrol to access for free<ArrowUpRight size={16} /></Link>}
        <Link to="/courses" className="biz-text-link" data-testid="resource-view-courses">View courses<ArrowUpRight size={16} /></Link>
      </>}
      <Link to="/purchases" className="biz-text-link" data-testid="resource-library-link">My purchases<ArrowUpRight size={16} /></Link>
    </div></div> : !error && <p data-testid="resource-loading">Loading resource…</p>}
    {error && <div className="biz-alert" role="alert" data-testid="resource-error">{error}<button onClick={() => setRetry(x => x + 1)} data-testid="resource-retry">Retry</button></div>}
  </section></ResourceShell>;
}