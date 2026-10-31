import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Upload, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { businessApi, money } from '../enterprise/api';
import { EnterpriseSetup } from './EnterpriseSetup';
import { ResourceEditor } from './ResourceEditor';
import '../enterprise/enterprise.css';

export default function ResourcesTab() {
  const { session } = useAuth(); const token = session?.access_token;
  const [ready, setReady] = useState(false); const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    setError(''); setLoading(true);
    return businessApi('/admin/resources', { token }).then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [token]);
  useEffect(() => { if (ready && token) load(); }, [ready, token, load]);
  return <div className="biz-admin" data-testid="resources-admin-tab"><EnterpriseSetup onReady={setReady} />
    <div className="biz-admin-status"><h2 data-testid="admin-resources-heading">Resources & templates</h2><button className="biz-button biz-button-primary" disabled={!ready} onClick={() => setEditing({})} data-testid="admin-resource-add"><Plus size={16} />Add resource</button></div>
    {error && <p className="biz-alert" role="alert" data-testid="admin-resources-error">{error}<button onClick={load} data-testid="admin-resources-retry"><RefreshCw size={16} />Retry</button></p>}
    {loading && <p role="status" data-testid="admin-resources-loading">Loading resources…</p>}
    {ready && !loading && !error && !items.length && <p data-testid="admin-resources-empty">No resources yet.</p>}
    {items.map(item => <article className="resource-order" key={item.id} data-testid={`admin-resource-${item.id}`}><div>
      <h3 data-testid={`admin-resource-title-${item.id}`}>{item.title}</h3><p data-testid={`admin-resource-status-${item.id}`}>{item.category} · {item.price_paise ? money(item.price_paise / 100) : 'Course inclusion'} · {item.is_published ? 'Published' : 'Draft'}</p>
      <small data-testid={`admin-resource-file-${item.id}`}>{(item.resource_files || []).length ? `${item.resource_files.length} file${item.resource_files.length > 1 ? 's' : ''} uploaded` : 'File coming soon'}</small>
    </div><div className="resource-admin-actions"><button className="biz-button biz-button-outline" onClick={() => setEditing(item)} data-testid={`admin-resource-upload-${item.id}`}><Upload size={16} />{(item.resource_files || []).length ? 'Manage files' : 'Upload files'}</button><button className="biz-button biz-button-outline" onClick={() => setEditing(item)} data-testid={`admin-resource-edit-${item.id}`} aria-label={`Edit ${item.title}`} title="Edit resource"><Pencil size={16} /></button></div></article>)}
    {editing && <ResourceEditor initial={editing.id ? editing : null} token={token} onSaved={load} onClose={() => setEditing(null)} />}
  </div>;
}