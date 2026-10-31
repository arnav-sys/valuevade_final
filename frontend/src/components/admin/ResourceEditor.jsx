import { useState } from 'react';
import { Upload, Save, FileCheck2, X, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { businessApi, CATEGORIES } from '../enterprise/api';

const MAX_FILE_MB = 50;
const EMPTY = { title: '', description: '', category: CATEGORIES[0], price_paise: 0, includes: [], is_published: false };
export const ResourceEditor = ({ initial, token, onSaved, onClose }) => {
  const [item, setItem] = useState(initial || EMPTY);
  const [price, setPrice] = useState((initial?.price_paise || 0) / 100);
  const [includes, setIncludes] = useState((initial?.includes || []).join('\n'));
  const [existingFiles, setExistingFiles] = useState(initial?.resource_files || []);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [removingId, setRemovingId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => setItem(x => ({ ...x, [key]: value }));
  const chooseFiles = e => {
    const selected = Array.from(e.target.files || []); setError('');
    const valid = [];
    for (const f of selected) {
      if (!/\.(pdf|xlsx|xls|docx|zip|csv|txt|md)$/i.test(f.name)) { setError(`${f.name}: choose an Excel workbook, PDF, DOCX, ZIP or text file.`); continue; }
      if (!f.size || f.size > MAX_FILE_MB * 1024 * 1024) { setError(`${f.name}: choose a non-empty file up to ${MAX_FILE_MB} MB.`); continue; }
      valid.push(f);
    }
    setPendingFiles(x => [...x, ...valid]);
    e.target.value = '';
  };
  const dropPending = name => setPendingFiles(x => x.filter(f => f.name !== name));
  const removeExisting = async fileId => {
    if (!item.id) return;
    setRemovingId(fileId); setError('');
    try {
      await businessApi(`/admin/resources/${item.id}/files/${fileId}`, { method: 'DELETE', token });
      setExistingFiles(x => x.filter(f => f.id !== fileId));
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setRemovingId(''); }
  };
  const save = async e => {
    e.preventDefault(); setBusy('Saving details…'); setError('');
    try {
      const body = { title: item.title, description: item.description, category: item.category, price_paise: Math.round(Number(price) * 100), includes: includes.split('\n').filter(Boolean), is_published: item.is_published };
      const saved = await businessApi(item.id ? `/admin/resources/${item.id}` : '/admin/resources', { method: item.id ? 'PUT' : 'POST', token, body });
      setItem(saved);
      for (const [i, f] of pendingFiles.entries()) {
        setBusy(`Uploading file ${i + 1} of ${pendingFiles.length}…`);
        const form = new FormData(); form.append('file', f);
        const uploaded = await businessApi(`/admin/resources/${saved.id}/files`, { method: 'POST', token, body: form, signal: AbortSignal.timeout(120000) });
        setExistingFiles(x => [...x, uploaded]);
      }
      setPendingFiles([]);
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
        {existingFiles.length ? <ul className="resource-file-list" data-testid="admin-resource-current-files">{existingFiles.map(f => <li key={f.id} data-testid={`admin-resource-current-file-${f.id}`}><FileCheck2 size={18} /><span>{f.file_name}<small>{f.file_type} · {(f.file_size / 1024).toFixed(1)} KB</small></span><button type="button" disabled={removingId === f.id} title={`Remove ${f.file_name}`} aria-label={`Remove ${f.file_name}`} onClick={() => removeExisting(f.id)} data-testid={`admin-resource-remove-file-${f.id}`}><Trash2 size={16} /></button></li>)}</ul> : <p data-testid="admin-resource-no-file">File coming soon · No files uploaded</p>}
        <label className="biz-upload-label"><Upload size={16} />Add downloadable files · up to {MAX_FILE_MB} MB each<input type="file" multiple accept=".pdf,.xlsx,.xls,.docx,.zip,.csv,.txt,.md" onChange={chooseFiles} data-testid="admin-resource-file" /></label>
        {pendingFiles.map(f => <div className="resource-file-selected" key={f.name} data-testid={`admin-resource-selected-file-${f.name}`}><span>{f.name} · {(f.size / 1024).toFixed(1)} KB</span><button type="button" title="Remove selected file" aria-label={`Remove ${f.name}`} onClick={() => dropPending(f.name)} data-testid={`admin-resource-clear-file-${f.name}`}><X size={16} /></button></div>)}
      </div>
      <label className="biz-consent"><input type="checkbox" checked={item.is_published} onChange={e => set('is_published', e.target.checked)} data-testid="admin-resource-published" />Published in the resource shop</label>
      <p className="biz-fine-print" data-testid="admin-resource-inclusion-note">Free for course students. Without a file, students see “File coming soon”.</p>
    </fieldset>{error && <p className="biz-alert" role="alert" data-testid="admin-resource-error">{error}</p>}
      <button className="biz-button biz-button-primary" disabled={!!busy} data-testid="admin-resource-save"><Save size={16} />{busy || (pendingFiles.length ? `Save resource & upload ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}` : 'Save resource')}</button>
    </form>
  </DialogContent></Dialog>;
};