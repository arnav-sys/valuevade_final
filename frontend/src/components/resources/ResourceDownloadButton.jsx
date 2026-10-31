import { Download, Clock3 } from 'lucide-react';
import { businessApi } from '../enterprise/api';

export const downloadResource = async (resourceId, fileId, token) => {
  const result = await businessApi(`/resources/${resourceId}/files/${fileId}/download`, { method: 'POST', token });
  // Signed private storage URL with an attachment filename; no sample fallback.
  window.location.assign(result.url);
};

export const ResourceDownloadButton = ({ available, busy, onClick, testId }) => (
  <button className="biz-button biz-button-outline resource-download-action" disabled={!available || busy} onClick={onClick} data-testid={testId}>
    {available ? <Download size={16} /> : <Clock3 size={16} />}
    {busy ? 'Preparing…' : available ? 'Download' : 'File coming soon'}
  </button>
);