export async function businessApi(path, { token, body, method = 'GET', ...options } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api${path}`, {
    ...options, method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: options.signal || AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validation = Array.isArray(data.detail)
      ? data.detail.map(issue => issue.msg?.replace(/^Value error, /, '')).filter(Boolean).join(' · ')
      : '';
    const error = new Error(typeof data.detail === 'string' ? data.detail : validation || 'Unable to complete this request. Please try again.');
    error.status = response.status; throw error;
  }
  return data;
}
export const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
export const CATEGORIES = ['Excel financial models', 'Equity research report templates', 'AI prompt packs', 'Sector study frameworks', 'Interview prep kits'];