import { useState } from 'react';
import { Upload, Save, FileCheck2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { businessApi, CATEGORIES } from '../enterprise/api';

const EMPTY = { title: '', description: '', category: CATEGORIES[0], price_paise: 0, includes: [], is_published: false };
export const ResourceEditor = ({ initial, token, onSaved, onClose }) => {
  const [item, setItem] = useState(initial || EMPTY);
  const [price, setPrice] = useState((initial?.price_paise || 0) / 100);
  const [includes, setIncludes] = useState((initial?.includes || []).join('\n'));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => setItem(x => ({ ...x, [key]: value }));
  const chooseFile = e => {
    const selected = e.target.files?.[0]; setError(''); setFile(null);
    if (!selected) return;
    if (!/\.(pdf|xlsx|xls|docx|zip|csv|txt|md)$/i.test(selected.name)) { setError('Choose an Excel workbook, PDF, DOCX, ZIP or text file.'); e.target.value = ''; return; }
    if (!selected.size || selected.size > 25 * 1024 * 1024) { setError('Choose a non-empty file up to 25 MB.'); e.target.value = ''; return; }
    setFile(selected);
  };
  const save = async e => {
    e.preventDefault(); setBusy('Saving details…'); setError('');
    try {
      const body = { title: item.title, description: item.description, category: item.category, price_paise: Math.round(Number(price) * 100), includes: includes.split('\n').filter(Boolean), is_published: item.is_published };
      let saved = await businessApi(item.id ? `/admin/resources/${item.id}` : '/admin/resources', { method: item.id ? 'PUT' : 'POST', token, body });
      setItem(saved);
      if (file) {
        setBusy('Uploading file…');
        const form = new FormData(); form.append('file', file);
        saved = await businessApi(`/admin/resources/${saved.id}/file`, { method: 'POST', token, body: form, signal: AbortSignal.timeout(120000) });
        setItem(saved); setFile(null);
      }
      onSaved(); onClose();
    } catch (err) { setError(err.message); onSaved(); }
    finally { setBusy(''); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="biz-resource-editor" data-testid="resource-editor" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
    <DialogTitle data-testid="admin-resource-editor-title">{item.id ? 'Edit resource' : 'New resource'}</DialogTitle>
    <DialogDescription data-testid="admin-resource-editor-description">Excel workbooks, PDFs and supporting files · Private student downloads</DialogDescription>
    <form onSubmit={save} className="biz-admin"><fieldset disabled={!!busy} className="resource-editor-fields">
      <label>Title<input required minLength={3} maxLength={140} value={item.title} onChange={e => set('title', e.target.value)} data-testid="admin-resource-title" /></label>
      <label>Description<textarea required minLength={10} maxLength={6000} rows={3} value={item.description} onChange={e => set('description', e.target.value)} data-testid="admin-resource-description" /></label>
      <div className="biz-form-row"><label>Category<select value={item.category} onChange={e => set('category', e.target.value)} data-testid="admin-resource-category">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>Standalone price (INR)<input type="number" min="0" max="1000000" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} data-testid="admin-resource-price" /></label></div>
      <label>Included items · one per line<textarea rows={3} maxLength={6000} value={includes} onChange={e => setIncludes(e.target.value)} data-testid="admin-resource-includes" /></label>
      <div className="resource-file-panel" data-testid="admin-resource-file-panel">
        {item.file_name ? <p data-testid="admin-resource-current-file"><FileCheck2 size={18} /><span>{item.file_name}<small>{item.file_type} · {(item.file_size / 1024).toFixed(1)} KB</small></span></p> : <p data-testid="admin-resource-no-file">File coming soon · No file uploaded</p>}
        <label className="biz-upload-label"><Upload size={16} />{item.file_name ? 'Replace downloadable file' : 'Upload downloadable file'} · up to 25 MB<input type="file" accept=".pdf,.xlsx,.xls,.docx,.zip,.csv,.txt,.md" onChange={chooseFile} data-testid="admin-resource-file" /></label>
        {file && <div className="resource-file-selected" data-testid="admin-resource-selected-file"><span>{file.name} · {(file.size / 1024).toFixed(1)} KB</span><button type="button" title="Remove selected file" aria-label="Remove selected file" onClick={() => setFile(null)} data-testid="admin-resource-clear-file"><X size={16} /></button></div>}
      </div>
      <label className="biz-consent"><input type="checkbox" checked={item.is_published} onChange={e => set('is_published', e.target.checked)} data-testid="admin-resource-published" />Published in the resource shop</label>
      <p className="biz-fine-print" data-testid="admin-resource-inclusion-note">Free for course students. Without a file, students see “File coming soon”.</p>
    </fieldset>{error && <p className="biz-alert" role="alert" data-testid="admin-resource-error">{error}</p>}
      <button className="biz-button biz-button-primary" disabled={!!busy} data-testid="admin-resource-save"><Save size={16} />{busy || (file ? 'Save resource & upload file' : 'Save resource')}</button>
    </form>
  </DialogContent></Dialog>;
};