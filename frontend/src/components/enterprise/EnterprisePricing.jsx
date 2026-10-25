import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Mail } from 'lucide-react';
import { businessApi, money } from './api';
import { Link } from 'react-router-dom';

export const EnterprisePricing = () => {
  const [config,setConfig] = useState(null); const [loadError,setLoadError] = useState('');
  const [seats,setSeats] = useState(10); const [sending,setSending] = useState(false); const [result,setResult] = useState(null); const [error,setError] = useState('');
  const [emailDraft,setEmailDraft] = useState('');
  const [form,setForm] = useState({name:'',email:'',company:'',interest:'both',requirements:'',consent:false,website:''});
  const [requestId] = useState(() => crypto.randomUUID());
  const load = () => {setLoadError(''); businessApi('/enterprise/config').then(setConfig).catch(e=>setLoadError(e.message));};
  useEffect(load,[]);
  useEffect(()=>setEmailDraft(''),[seats]);
  const slab = config?.pricing.slabs.find(s => seats <= s.max_seats);
  const set = (key,value) => {setEmailDraft('');setForm(f=>({...f,[key]:value}));};
  const send = async e => {
    e.preventDefault();setError('');
    if(!config?.enquiries_available){
      const text = `Enterprise enquiry\n\nName: ${form.name}\nWork email: ${form.email}\nCompany: ${form.company}\nTeam size: ${seats}\nInterest: ${form.interest}\nTraining estimate: ${money(slab.price_inr*seats)}${config.pricing.sample?' (sample pricing)':''}\n\nRequirements:\n${form.requirements}\n\nI agree to be contacted about this enquiry.`;
      setEmailDraft(`mailto:info@valuevade.com?subject=${encodeURIComponent('Valuevade enterprise enquiry')}&body=${encodeURIComponent(text)}`);
      return;
    }
    setSending(true);try {setResult(await businessApi('/enterprise/enquiries',{method:'POST',body:{...form,seats,id:requestId}}));} catch(e) {setError(e.message);} finally {setSending(false);}
  };
  return <section className="biz-pricing" id="enquire" data-testid="enterprise-pricing">
    <div className="biz-section-head"><div><p className="biz-eyebrow">YOUR TEAM. YOUR NEXT LEVEL.</p><h2>Make room for better work.</h2></div><p>Training sized to your team.<br />Agent implementations scoped to your needs.</p></div>
    {loadError && <div className="biz-alert" role="alert" data-testid="pricing-load-error">{loadError}<button data-testid="pricing-retry" onClick={load}>Retry</button></div>}
    <div className="biz-pricing-grid"><div className="biz-calculator">
      <p className="biz-eyebrow">TEAM TRAINING ESTIMATE · INR</p>
      <div className="biz-seat-heading"><label htmlFor="enterprise-seats">Team size</label><div><input id="enterprise-seats" type="number" min="1" max="1000" value={seats} onChange={e=>setSeats(Math.min(1000,Math.max(1,Number(e.target.value)||1)))} data-testid="enterprise-seat-number"/><span>people</span></div></div>
      <input type="range" min="1" max="1000" value={seats} onChange={e=>setSeats(Number(e.target.value))} aria-label="Team size" data-testid="enterprise-seat-slider" />
      <div className="biz-range-labels"><span>1 person</span><span>1,000 people</span></div>
      {slab ? <><div className="biz-total" data-testid="enterprise-total">{money(slab.price_inr*seats)}<span>one-time team training estimate</span></div><p data-testid="enterprise-unit-price">{money(slab.price_inr)} per person × {seats} people</p>
      <div className="biz-slab-list">{config.pricing.slabs.map((s,i)=><div className={s===slab?'active':''} key={s.max_seats} data-testid={`enterprise-slab-${i}`}><span>{i ? config.pricing.slabs[i-1].max_seats+1 : 1}–{s.max_seats} people</span><strong>{money(s.price_inr)}<small> / person</small></strong></div>)}</div>
      <p className="biz-fine-print" data-testid="enterprise-price-disclaimer">{config.pricing.sample ? 'Sample pricing — not a commercial offer. ' : 'Indicative pricing. '}The team’s size determines the rate for every seat. Taxes, programme scope and agent implementation are confirmed in your proposal. No payment is collected here.</p></> : <p data-testid="pricing-loading">Loading team prices…</p>}
      <ul className="biz-checks"><li><Check size={16}/>Hands-on finance workflows</li><li><Check size={16}/>AI capability built in-house</li><li><Check size={16}/>Human review and governance</li></ul>
    </div><div className="biz-enquiry">
      <h3>Let’s talk outcomes.</h3><p>Tell us what your team needs to do better.</p>
      {result ? <div className="biz-success" role="status" data-testid="enquiry-success"><Check size={30}/><h3>Enquiry saved.</h3><p>Your request is in our team’s inbox in Valuevade.</p><small data-testid="enquiry-reference">Reference: {result.reference}</small>{result.notification && result.notification!=='accepted' && <p data-testid="enquiry-notification-status">Email notification is pending; your enquiry is safely saved.</p>}</div> : <form onSubmit={send} data-testid="enterprise-enquiry-form">
        <div className="biz-form-row"><label>Your name<input required minLength={2} maxLength={100} value={form.name} onChange={e=>set('name',e.target.value)} autoComplete="name" data-testid="enquiry-name"/></label><label>Work email<input required type="email" maxLength={254} value={form.email} onChange={e=>set('email',e.target.value)} autoComplete="email" data-testid="enquiry-email"/></label></div>
        <label>Company<input required minLength={2} maxLength={160} value={form.company} onChange={e=>set('company',e.target.value)} autoComplete="organization" data-testid="enquiry-company"/></label>
        <label>I’m interested in<select value={form.interest} onChange={e=>set('interest',e.target.value)} data-testid="enquiry-interest"><option value="both">Team training + AI agents</option><option value="training">Team training</option><option value="agents">Valuevade-built AI agents</option></select></label>
        <label>What would you like to improve?<textarea required minLength={10} maxLength={3000} rows={3} placeholder="Your workflows, team goals and timelines…" value={form.requirements} onChange={e=>set('requirements',e.target.value)} data-testid="enquiry-requirements"/></label>
        <label className="biz-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>set('website',e.target.value)} data-testid="enquiry-website"/></label>
        <label className="biz-consent"><input type="checkbox" required checked={form.consent} onChange={e=>set('consent',e.target.checked)} data-testid="enquiry-consent"/><span>I agree to be contacted about this enquiry, under the <Link to="/privacy" data-testid="enquiry-privacy">Privacy Policy</Link>.</span></label>
        {config && !config.enquiries_available && <p className="biz-alert" data-testid="enquiry-unavailable">Online saving is being set up. Prepare your enquiry below, then send it to <a href="mailto:info@valuevade.com" data-testid="enquiry-email-fallback">info@valuevade.com</a> using your email app. Nothing is saved online.</p>}
        {error && <p className="biz-alert" role="alert" data-testid="enquiry-error">{error}</p>}
        <button className="biz-button biz-button-primary" disabled={sending || !config} data-testid="enquiry-submit">{sending?'Saving enquiry…':config?.enquiries_available?'Request a team proposal':'Prepare email enquiry'}<ArrowUpRight size={18}/></button>
        {emailDraft && <div className="biz-alert" role="status" data-testid="enquiry-draft-ready"><strong>Your email draft is ready — not sent.</strong><p>Open your email app and press Send to submit your enquiry. This draft has not been saved in Valuevade.</p><a className="biz-text-link" href={emailDraft} data-testid="enquiry-send-draft"><Mail size={16}/>Open email app to send</a></div>}
        <a className="biz-text-link" href="mailto:info@valuevade.com" data-testid="enquiry-direct-email"><Mail size={15}/> Prefer email? info@valuevade.com</a>
      </form>}
    </div></div>
  </section>;
};