import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, ArrowUpRight, ArrowLeft, Download, Check, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BusinessNav, BusinessFooter } from '../enterprise/BusinessNav';
import { businessApi, money, CATEGORIES } from '../enterprise/api';
import { ResourcePreview, SAMPLE_RESOURCES } from './ResourcePreview';
import { loadRazorpayCheckout } from '../../utils/razorpay';
import '../enterprise/enterprise.css';

const Shell = ({ children }) => <div className="biz-page resource-page"><BusinessNav/><main>{children}</main><BusinessFooter/></div>;
export default function ResourcesPage() {
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [category,setCategory]=useState('All resources'); const [search,setSearch]=useState('');
  const load=()=>{setLoading(true);setError('');businessApi('/resources').then(d=>setItems(d.items)).catch(e=>setError(e.message)).finally(()=>setLoading(false));};
  useEffect(load,[]);
  const previews=!loading && !items.length; const list=previews?SAMPLE_RESOURCES:items;
  const visible=list.filter(x=>(category==='All resources'||x.category===category)&&`${x.title} ${x.description}`.toLowerCase().includes(search.toLowerCase()));
  return <Shell><Helmet><title>Finance Resources & Templates | Valuevade</title></Helmet><section className="resource-heading"><p className="biz-eyebrow">VALUEVADE / THE RESOURCE LIBRARY</p><h1>Less blank-page work.<br/><em>More thinking time.</em></h1><p>Financial models, research frameworks and practical tools<br/>for the work that comes next.</p><Link className="biz-text-link" to="/resources/library" data-testid="resources-my-downloads"><Download size={17}/>My downloads</Link></section>
    <section className="resource-catalog" data-testid="resources-catalog"><div className="resource-filter-bar"><label className="resource-search"><Search size={17}/><input aria-label="Search resources" placeholder="Find your next advantage…" value={search} onChange={e=>setSearch(e.target.value)} data-testid="resources-search"/></label><label className="resource-category-label">Category<select value={category} onChange={e=>setCategory(e.target.value)} data-testid="resources-category">{['All resources',...CATEGORIES].map(c=><option key={c}>{c}</option>)}</select></label></div>
      {error && <div className="biz-alert" role="status" data-testid="resources-status">The resource shop is being prepared. Preview our template categories below; no purchases are available yet.<button onClick={load} data-testid="resources-retry">Refresh</button></div>}
      {previews && !error && <p className="biz-fine-print" data-testid="resources-preview-note">Template concepts below are illustrative previews, not downloadable products. Published resources will appear here.</p>}
      {loading?<p data-testid="resources-loading">Loading resources…</p>:<><div className="resource-results" data-testid="resources-result-count">{visible.length} {previews?'previews':'resources'}<span>BUILT FOR FINANCE</span></div><div className="resource-grid">{visible.map(item=><article key={item.id} className="resource-card" data-testid={`resource-card-${item.id}`}><Link to={`/resources/${item.id}`} data-testid={`resource-cover-${item.id}`} aria-label={`View ${item.title}`}><ResourcePreview item={item}/></Link><div className="resource-card-body"><p className="biz-eyebrow">{item.category}</p><h2><Link to={`/resources/${item.id}`} data-testid={`resource-title-${item.id}`}>{item.title}</Link></h2><p>{item.description}</p><div className="resource-card-bottom"><strong data-testid={`resource-price-${item.id}`}>{item.sample?'Concept preview':item.price_paise===0?'Free':money(item.price_paise/100)}</strong><Link to={`/resources/${item.id}`} data-testid={`resource-open-${item.id}`}>{item.sample?'Preview':'View resource'}<ArrowUpRight size={16}/></Link></div></div></article>)}</div>{!visible.length&&<p className="biz-empty" data-testid="resources-empty">No resources match your search.</p>}</>}
    </section></Shell>;
}

export function ResourceDetailsPage() {
  const {resourceId}=useParams(); const [item,setItem]=useState(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [paid,setPaid]=useState(false);
  const {user,session}=useAuth(); const navigate=useNavigate(); const location=useLocation();
  useEffect(()=>{setItem(null);setError('');setPaid(false); const sample=SAMPLE_RESOURCES.find(x=>x.id===resourceId); if(sample){setItem(sample);return;} businessApi(`/resources/${resourceId}`).then(setItem).catch(e=>setError(e.message));},[resourceId]);
  const download=async()=>{setBusy(true);setError('');try {const d=await businessApi(`/resources/${resourceId}/download`,{method:'POST',token:session?.access_token});window.location.assign(d.url);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const buy=async()=>{
    if(!user){navigate('/login',{state:{from:location.pathname}});return;}
    setBusy(true);setError('');
    try{
      const order=await businessApi(`/resources/${resourceId}/order`,{method:'POST',token:session?.access_token});
      if(order.owned||order.free){setPaid(true);setBusy(false);return;}
      const Razorpay=await loadRazorpayCheckout();
      const checkout=new Razorpay({key:order.key_id,amount:order.amount,currency:order.currency,order_id:order.order_id,name:'Valuevade',description:item.title,prefill:{email:user.email},
        handler:async response=>{try{await businessApi('/resources/payment/verify',{method:'POST',token:session?.access_token,body:response});setPaid(true);}catch(e){setError(e.message+' You can also check the payment in My downloads.');}finally{setBusy(false);}},
        modal:{ondismiss:()=>{setBusy(false);setError('Checkout closed. No download unlocked. Check My downloads if a payment was made.');}},theme:{color:'#246BFD'}});
      checkout.on('payment.failed',()=>{setBusy(false);setError('Payment was not completed. Please retry or check My downloads.');});checkout.open();
    }catch(e){setError(e.message);setBusy(false);}
  };
  return <Shell><section className="resource-detail" data-testid="resource-detail"><Link to="/resources" className="biz-text-link" data-testid="resource-back"><ArrowLeft size={16}/>All resources</Link>{item?<><div className="resource-detail-grid"><ResourcePreview item={item}/><div><p className="biz-eyebrow">{item.category}</p><h1>{item.title}</h1><p>{item.description}</p><ul className="biz-checks">{item.includes.map((x,i)=><li key={i} data-testid={`resource-includes-${i}`}><Check size={16}/>{x}</li>)}</ul>
      {item.sample?<div className="biz-alert" data-testid="resource-sample-notice">Concept preview — not for sale. Final files and pricing will appear when this resource is published.</div>:<><strong className="resource-detail-price" data-testid="resource-detail-price">{item.price_paise===0?'Free':money(item.price_paise/100)}</strong><p className="biz-fine-print" data-testid="resource-file-meta">{item.file_type} · {Math.max(1,Math.round(item.file_size/1024))} KB · One-time purchase</p><button className="biz-button biz-button-primary" disabled={busy} onClick={paid?download:buy} data-testid="resource-purchase-button">{busy?'Please wait…':paid?'Download resource':!user?'Sign in to continue':item.price_paise===0?'Get free resource':'Buy resource'}<Download size={18}/></button><p className="biz-fine-print"><ShieldCheck size={15}/>Secure checkout via Razorpay. Access unlocks only after payment verification.</p>{paid&&<p className="biz-success" role="status" data-testid="resource-unlocked">Your resource is ready to download.</p>}</>}
      <Link to="/resources/library" className="biz-text-link" data-testid="resource-library-link">My downloads<ArrowUpRight size={16}/></Link></div></div></>:!error&&<p data-testid="resource-loading">Loading resource…</p>}{error&&<p className="biz-alert" role="alert" data-testid="resource-error">{error}</p>}</section></Shell>;
}

export function ResourceLibraryPage(){
  const {session}=useAuth();const [orders,setOrders]=useState([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState('');
  const load=()=>{if(!session?.access_token)return;setError('');setLoading(true);businessApi('/resources/purchases',{token:session.access_token}).then(setOrders).catch(e=>setError(e.message)).finally(()=>setLoading(false));};
  useEffect(load,[session?.access_token]);
  const act=async(order)=>{setBusy(order.id);setError('');try{if(order.status==='paid'){const d=await businessApi(`/resources/${order.resource_id}/download`,{method:'POST',token:session.access_token});window.location.assign(d.url);}else{await businessApi(`/resources/purchases/${order.id}/check`,{method:'POST',token:session.access_token});load();}}catch(e){setError(e.message);}finally{setBusy('');}};
  return <Shell><section className="resource-library" data-testid="resource-library"><p className="biz-eyebrow">YOUR VALUEVADE TOOLKIT</p><h1>My downloads.</h1><Link to="/resources" className="biz-text-link" data-testid="library-browse">Browse resources<ArrowUpRight size={16}/></Link>{error&&<div className="biz-alert" role="alert" data-testid="library-error">{error}<button onClick={load} data-testid="library-retry">Retry</button></div>}{loading?<p data-testid="library-loading">Loading purchases…</p>:orders.length?orders.map(o=><article className="resource-order" key={o.id} data-testid={`resource-order-${o.id}`}><div><h2>{o.marketplace_resources?.title||'Resource'}</h2><p>{money(o.amount_paise/100)} · {o.status==='created'?'Awaiting payment verification':o.status}</p></div><button className="biz-button biz-button-outline" disabled={!!busy||o.status==='refunded'} onClick={()=>act(o)} data-testid={`resource-order-action-${o.id}`}>{busy===o.id?'Checking…':o.status==='paid'?'Download':o.status==='refunded'?'Refunded':'Check payment'}<Download size={16}/></button></article>):!error&&<p className="biz-empty" data-testid="library-empty">Your purchased resources will appear here.</p>}</section></Shell>;
}