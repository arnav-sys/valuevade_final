import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileText, ArrowUpRight } from 'lucide-react';
import { money } from '../enterprise/api';
import { ResourceDownloadButton } from '../resources/ResourceDownloadButton';

export const PurchaseResourceRow = ({ resource, included, amount, available, busy, onDownload }) => {
  const id = resource.id; const Icon = /^XLS/.test(resource.file_type || '') ? FileSpreadsheet : FileText;
  return <article className="purchase-resource-row" data-testid={`purchase-resource-${id}`}>
    <div className={`purchase-file-icon ${Icon === FileSpreadsheet ? 'is-excel' : ''}`}><Icon size={23} /></div>
    <div className="purchase-resource-info"><Link to={`/resources/${id}`} data-testid={`purchase-resource-title-${id}`}>{resource.title}<ArrowUpRight size={14} /></Link>
      <p data-testid={`purchase-resource-meta-${id}`}>{resource.category}{resource.file_name ? ` · ${resource.file_type} · ${(resource.file_size / 1024).toFixed(1)} KB` : ''}</p>
      {resource.file_name && <small data-testid={`purchase-resource-filename-${id}`}>{resource.file_name}</small>}
    </div>
    <span className={included ? 'purchase-included' : 'purchase-price'} data-testid={`purchase-resource-price-${id}`}>{included ? <>Free <small>Included in course</small></> : money(amount / 100)}</span>
    <ResourceDownloadButton available={available} busy={busy} onClick={onDownload} testId={`purchase-download-${id}`} />
  </article>;
};