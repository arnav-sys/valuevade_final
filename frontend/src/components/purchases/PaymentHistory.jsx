import { RefreshCw } from 'lucide-react';
import { money } from '../enterprise/api';
export const purchaseDate = value => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';
const labels = { created: 'Pending', attempted: 'Pending', paid: 'Paid', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded' };

export const PaymentHistory = ({ orders, busy, onCheck }) => <section className="purchase-history" data-testid="purchase-payment-history">
  {!orders.length && <p className="purchase-empty" data-testid="purchase-history-empty">No payment records yet.</p>}
  {orders.map(order => <article className="purchase-history-row" key={order.id} data-testid={`purchase-history-${order.id}`}>
    <div><h2 data-testid={`purchase-history-title-${order.id}`}>{order.title}</h2><p data-testid={`purchase-history-date-${order.id}`}>{purchaseDate(order.created_at)} · {order.kind === 'course' ? 'Course' : 'Resource'}{order.pricing_tier ? ` · ${order.pricing_tier.replaceAll('_', ' ')}` : ''}</p><small data-testid={`purchase-history-reference-${order.id}`}>{order.razorpay_order_id || 'Order reference pending'}</small></div>
    <strong data-testid={`purchase-history-amount-${order.id}`}>{money(order.amount_paise / 100)}</strong>
    <span className={`purchase-payment-status status-${order.status}`} data-testid={`purchase-history-status-${order.id}`}>{labels[order.status] || order.status}{order.mock_mode ? ' · MOCKED' : ''}</span>
    {order.kind === 'resource' && ['created', 'attempted'].includes(order.status) && <button className="biz-button biz-button-outline" disabled={!!busy} onClick={() => onCheck(order.order_id)} data-testid={`purchase-check-${order.id}`}><RefreshCw size={15} />{busy === order.order_id ? 'Checking…' : 'Check payment'}</button>}
  </article>)}
</section>;