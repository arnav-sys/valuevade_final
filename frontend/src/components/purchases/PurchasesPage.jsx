import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Receipt, BookOpen, ArrowUpRight, RefreshCw, PackageCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../Sidebar';
import { businessApi, money } from '../enterprise/api';
import { downloadResource } from '../resources/ResourceDownloadButton';
import { PurchaseResourceRow } from './PurchaseResourceRow';
import { PaymentHistory, purchaseDate } from './PaymentHistory';
import '../enterprise/enterprise.css';
import './purchases.css';

export default function PurchasesPage() {
  const { session, user, refreshEnrollment } = useAuth(); const token = session?.access_token;
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const [params, setParams] = useSearchParams(); const history = params.get('tab') === 'history';
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!token) return;
    let alive = true; setLoading(true); setError('');
    businessApi('/purchases', { token }).then(data => { if (alive) setResult({ userId: user.id, data }); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, user?.id, retry]);
  const reload = useCallback(() => { setRetry(x => x + 1); refreshEnrollment(); }, [refreshEnrollment]);
  const data = result?.userId === user?.id ? result.data : null;
  const access = data?.course_access;
  const includedIds = new Set((data?.included_resources || []).map(r => r.id));
  const individual = (data?.resource_purchases || []).filter(p => !includedIds.has(p.resource_id));
  const download = async id => {
    setBusy(id); setError('');
    try { await downloadResource(id, token); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const checkPayment = async id => {
    setBusy(id); setError('');
    try { await businessApi(`/resources/purchases/${id}/check`, { method: 'POST', token }); reload(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  return <div className="purchases-layout"><Helmet><title>My purchases | Valuevade</title></Helmet><Sidebar />
    <main className="purchases-main biz-page" data-testid="purchases-page"><div className="purchases-content">
      <header className="purchases-header"><div><p className="biz-eyebrow" data-testid="purchases-eyebrow"><Receipt size={15} />YOUR VALUEVADE COLLECTION</p><h1 data-testid="purchases-title">My purchases.</h1><p data-testid="purchases-description">Your courses. Your templates. All in one place.</p></div><button className="biz-button biz-button-outline" onClick={reload} disabled={loading} data-testid="purchases-refresh"><RefreshCw size={16} />Refresh</button></header>
      <div className="purchases-tabs" role="tablist" aria-label="Purchases views"><button role="tab" id="purchases-tab" aria-controls="purchases-panel" aria-selected={!history} onClick={() => setParams({})} data-testid="purchases-tab">Purchases</button><button role="tab" id="purchase-history-tab" aria-controls="purchases-panel" aria-selected={history} onClick={() => setParams({ tab: 'history' })} data-testid="purchase-history-tab">Payment history{data ? ` (${data.history.length})` : ''}</button></div>
      {error && <div className="biz-alert" role="alert" data-testid="purchases-error">{error}<button onClick={reload} data-testid="purchases-retry">Retry</button></div>}
      {loading && !data && <p role="status" className="purchase-empty" data-testid="purchases-loading">Loading your purchases…</p>}
      {data && <div id="purchases-panel" role="tabpanel" aria-labelledby={history ? 'purchase-history-tab' : 'purchases-tab'} data-testid="purchases-panel">{history ? <PaymentHistory orders={data.history} busy={busy} onCheck={checkPayment} /> : <>
        {access && <><section className="purchase-course" data-testid="purchased-course"><div className="purchase-course-label"><BookOpen size={24} /><span data-testid="purchase-course-status">COURSE ACCESS · ACTIVE</span></div><div className="purchase-course-summary"><div><h2 data-testid="purchase-course-title">{access.enrollments.length === 1 ? access.enrollments[0].title : 'Valuevade course access'}</h2><p data-testid="purchase-course-date">{access.paid_at ? `Purchased ${purchaseDate(access.paid_at)}` : 'Enrolment active'}{access.pricing_tier ? ` · ${access.pricing_tier.replaceAll('_', ' ')}` : ''}</p></div>{access.paid_amount_inr > 0 && <strong data-testid="purchase-course-amount">{money(access.paid_amount_inr)}<small>Course payment</small></strong>}</div>
          <div className="purchase-course-links">{access.enrollments.map(e => <Link className="biz-text-link" to={`/course/${e.master_path_id}`} key={e.id} data-testid={`purchase-course-link-${e.id}`}>{access.enrollments.length === 1 ? 'View course' : e.title}<ArrowUpRight size={16} /></Link>)}<Link className="biz-button biz-button-primary" to={access.enrollments.length ? '/dashboard' : '/courses'} data-testid="purchase-continue-learning">{access.enrollments.length ? 'Continue learning' : 'Choose your course'}<ArrowUpRight size={16} /></Link></div>
        </section><section className="purchase-inclusions" data-testid="purchase-included-templates"><div className="purchase-section-heading"><h2 data-testid="purchase-inclusions-title"><PackageCheck size={20} />Included in your course</h2><span data-testid="purchase-inclusions-count">{data.included_resources.length} resources · No extra charge</span></div>
          {data.included_resources.map(r => <PurchaseResourceRow key={r.id} resource={r} included available={r.file_available} busy={!!busy} onDownload={() => download(r.id)} />)}
          {!data.included_resources.length && <p data-testid="purchase-inclusions-empty">Included resources will appear here when published.</p>}
        </section></>}
        {individual.length > 0 && <section className="purchase-individual" data-testid="purchase-individual-resources"><h2>Resource purchases</h2>{individual.map(p => <PurchaseResourceRow key={p.id} resource={p.resource || { id: p.resource_id, title: 'Resource unavailable' }} amount={p.amount_paise} available={p.available} busy={!!busy} onDownload={() => download(p.resource_id)} />)}</section>}
        {!access && !individual.length && <section className="purchase-empty" data-testid="purchases-empty"><Receipt size={32} /><h2>No completed purchases yet.</h2><p>Your courses and templates will appear here after payment.</p><Link className="biz-button biz-button-primary" to="/courses" data-testid="purchases-browse-courses">Browse courses<ArrowUpRight size={16} /></Link></section>}
        <Link className="biz-text-link purchase-browse" to="/resources" data-testid="purchases-browse-resources">Browse resources<ArrowUpRight size={16} /></Link>
      </>}</div>}
    </div></main></div>;
}