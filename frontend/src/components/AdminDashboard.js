import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LogOut, Users, Search, Trash2, ArrowUpDown, Shield } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('vv_admin_token'));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const fetchEntries = async (authToken) => {
    const t = authToken || tokenRef.current;
    if (!t) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/waitlist/all`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      setEntries(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        sessionStorage.removeItem('vv_admin_token');
        setToken(null);
        tokenRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchEntries(token);
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API}/admin/login`, {
        email: loginEmail,
        password: loginPassword,
      });
      const newToken = res.data.token;
      sessionStorage.setItem('vv_admin_token', newToken);
      tokenRef.current = newToken;
      setToken(newToken);
    } catch {
      setLoginError('Invalid credentials');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vv_admin_token');
    tokenRef.current = null;
    setToken(null);
    setEntries([]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await axios.delete(`${API}/waitlist/${id}`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete');
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // LOGIN VIEW
  if (!token) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: '#02073D' }}
        data-testid="admin-login-page"
      >
        <div
          className="glass-card rounded-2xl p-8 sm:p-10 w-full max-w-sm text-center"
          style={{ borderColor: 'rgba(106, 92, 255, 0.2)', boxShadow: '0 0 60px rgba(106, 92, 255, 0.08)' }}
        >
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-vblue/10 border border-vblue/20 flex items-center justify-center">
              <Shield size={28} className="text-vblue" />
            </div>
          </div>
          <h2 className="font-clash text-2xl text-white mb-1">Admin Dashboard</h2>
          <p className="text-white/40 text-sm font-bricolage mb-8">Sign in to manage your waitlist</p>

          <form onSubmit={handleLogin} className="space-y-4" data-testid="admin-login-form">
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 font-bricolage text-sm focus:outline-none focus:border-vblue/50 transition-all"
              data-testid="admin-email-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 font-bricolage text-sm focus:outline-none focus:border-vblue/50 transition-all"
              data-testid="admin-password-input"
            />
            {loginError && (
              <p className="text-red-400 text-sm font-bricolage" data-testid="admin-login-error">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-vblue text-white font-semibold rounded-xl text-sm hover:brightness-110 transition-all disabled:opacity-50"
              data-testid="admin-login-btn"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  const filtered = entries.filter(
    (e) =>
      (e.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.referral_code || '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField] ?? '';
    const bv = b[sortField] ?? '';
    if (sortDir === 'asc') return av > bv ? 1 : -1;
    return av < bv ? 1 : -1;
  });

  const realEntries = entries.filter((e) => !e.email?.includes('test') && !e.email?.includes('example'));

  return (
    <div className="min-h-screen" style={{ background: '#02073D' }} data-testid="admin-dashboard">
      <header className="border-b border-white/5 bg-navy/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-7 h-7" />
            <span className="font-clash text-lg font-semibold logo-gradient">Valuevade</span>
            <span className="text-white/30 text-xs font-jetbrains ml-2 hidden sm:inline">ADMIN</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-bricolage transition-colors"
            data-testid="admin-logout-btn"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Signups" value={entries.length} icon={Users} color="#246BFD" />
          <StatCard label="Real Signups" value={realEntries.length} icon={Users} color="#6A5CFF" />
          <StatCard label="With Referrals" value={entries.filter((e) => (e.referral_count || 0) > 0).length} icon={Users} color="#FF6AC1" />
          <StatCard label="Via Referral" value={entries.filter((e) => e.referred_by).length} icon={Users} color="#246BFD" />
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search by name, email, or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm font-bricolage focus:outline-none focus:border-vblue/50 transition-all"
              data-testid="admin-search-input"
            />
          </div>
          <button
            onClick={() => fetchEntries()}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm hover:bg-white/10 transition-all font-bricolage"
            data-testid="admin-refresh-btn"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="admin-waitlist-table">
              <thead>
                <tr className="border-b border-white/5">
                  {[
                    { key: 'first_name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'position', label: 'Position' },
                    { key: 'referral_code', label: 'Ref Code' },
                    { key: 'referral_count', label: 'Referrals' },
                    { key: 'referred_by', label: 'Referred By' },
                    { key: 'timestamp', label: 'Signed Up' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="text-left px-4 py-3 text-xs font-jetbrains text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/60 transition-colors select-none"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortField === col.key && <ArrowUpDown size={12} className="text-vblue" />}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => (
                  <tr
                    key={entry.email}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    data-testid={`admin-row-${entry.email}`}
                  >
                    <td className="px-4 py-3 text-sm text-white font-bricolage">{entry.first_name}</td>
                    <td className="px-4 py-3 text-sm text-white/60 font-bricolage">{entry.email}</td>
                    <td className="px-4 py-3 text-sm font-jetbrains text-vblue">#{entry.position}</td>
                    <td className="px-4 py-3 text-sm font-jetbrains text-white/40">{entry.referral_code || '-'}</td>
                    <td className="px-4 py-3 text-sm font-jetbrains text-vpink">{entry.referral_count || 0}</td>
                    <td className="px-4 py-3 text-sm font-jetbrains text-white/30">{entry.referred_by || '-'}</td>
                    <td className="px-4 py-3 text-sm text-white/30 font-bricolage whitespace-nowrap">
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-white/20 hover:text-red-400 transition-colors"
                        data-testid={`admin-delete-${entry.email}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-white/30 text-sm font-bricolage">
                      {search ? 'No entries match your search' : 'No waitlist entries yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-white/20 text-xs font-jetbrains mt-4 text-center">
          Showing {sorted.length} of {entries.length} entries
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div
      className="glass-card rounded-xl p-5"
      style={{ borderColor: `${color}15` }}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/40 text-xs font-jetbrains uppercase tracking-wider">{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="font-clash text-3xl text-white">{value}</p>
    </div>
  );
}
