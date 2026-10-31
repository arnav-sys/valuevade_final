import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileText, ArrowUpRight } from 'lucide-react';
import { money } from '../enterprise/api';
import { ResourceDownloadButton } from '../resources/ResourceDownloadButton';

export const PurchaseResourceRow = ({ resource, included, amount, available, busyFileId, onDownload }) => {
  const id = resource.id; const files = resource.files || [];
  const Icon = files.some(f => /^XLS/.test(f.file_type || '')) ? FileSpreadsheet : FileText;
  return <article className="purchase-resource-row" data-testid={`purchase-resource-${id}`}>
    <div className={`purchase-file-icon ${Icon === FileSpreadsheet ? 'is-excel' : ''}`}><Icon size={23} /></div>
    <div className="purchase-resource-info"><Link to={`/resources/${id}`} data-testid={`purchase-resource-title-${id}`}>{resource.title}<ArrowUpRight size={14} /></Link>
      <p data-testid={`purchase-resource-meta-${id}`}>{resource.category}{files.length ? ` · ${files.length} file${files.length > 1 ? 's' : ''}` : ''}</p>
      {files.map(f => <small key={f.id} data-testid={`purchase-resource-filename-${id}-${f.id}`}>{f.file_name}</small>)}
    </div>
    <span className={included ? 'purchase-included' : 'purchase-price'} data-testid={`purchase-resource-price-${id}`}>{included ? <>Free <small>Included in course</small></> : money(amount / 100)}</span>
    {available && files.length ? <div className="purchase-download-group">{files.map(f => <ResourceDownloadButton key={f.id} available busy={busyFileId === f.id} onClick={() => onDownload(f.id)} testId={`purchase-download-${id}-${f.id}`} />)}</div> : <ResourceDownloadButton available={false} busy={false} onClick={() => {}} testId={`purchase-download-${id}`} />}
  </article>;
};