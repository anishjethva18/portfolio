import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { formatAdminDateTime } from '../../utils/dateTime';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Clock,
  LogOut,
  RefreshCw,
  Server,
  Database,
  HardDrive,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SecurityManagementProps {
  onPolicyChange?: (policy: string) => void;
  health?: {
    status: string;
    database: { status: string; latencyMs: number | null };
    storage: { status: string };
    email?: { status: string };
  } | null;
  healthError?: string | null;
  healthLoading?: boolean;
  onRefreshHealth?: () => Promise<void> | void;
  onLogout?: () => void;
  adminEmail?: string;
}

export const SecurityManagement: React.FC<SecurityManagementProps> = ({
  onPolicyChange,
  health = null,
  healthError = null,
  healthLoading = false,
  onRefreshHealth,
  onLogout,
  adminEmail,
}) => {
  const confirm = useConfirmDialog();
  const [loginHistory, setLoginHistory] = useState<Array<{
    id: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
    loginAt: string;
    logoutAt: string | null;
    expiresAt: string;
    active: boolean;
    endReason: 'logout' | 'revoked' | 'expired' | null;
  }>>([]);
  const [loginHistoryPage, setLoginHistoryPage] = useState(1);
  const [loginHistoryReload, setLoginHistoryReload] = useState(0);
  const [loginHistoryPages, setLoginHistoryPages] = useState({ page: 1, limit: 5, total: 0, totalPages: 1 });
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [loginHistoryError, setLoginHistoryError] = useState<string | null>(null);
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [revokingSessions, setRevokingSessions] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [sessionActionMessage, setSessionActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setLoginHistoryLoading(true);
    setLoginHistoryError(null);
    void apiFetch(`/api/admin/security/session-history?page=${loginHistoryPage}&limit=5`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.sessions) || !data.pagination) {
          const message = response.status === 404
            ? 'Login history API is unavailable on the running server. Restart the portfolio server or deploy the latest backend, then try again.'
            : data.error || 'Login history could not be loaded.';
          throw new Error(message);
        }
        if (!isCurrent) return;
        setLoginHistory(data.sessions);
        setLoginHistoryPages(data.pagination);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoginHistoryError(error instanceof Error ? error.message : 'Login history could not be loaded.');
      })
      .finally(() => {
        if (isCurrent) setLoginHistoryLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [loginHistoryPage, loginHistoryReload]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLoginHistoryReload((current) => current + 1);
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!sessionActionMessage) return;
    const timeoutId = window.setTimeout(
      () => setSessionActionMessage(null),
      sessionActionMessage.type === 'success' ? 4000 : 6000
    );
    return () => window.clearTimeout(timeoutId);
  }, [sessionActionMessage]);

  // Re-login Policy
  const [reLoginPolicy, setReLoginPolicy] = useState<string>(() => {
    return localStorage.getItem('win11_admin_relogin_policy') || 'timeout_15m';
  });
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);

  const refreshServiceStatus = async () => {
    if (!onRefreshHealth || refreshingHealth || healthLoading) return;
    setRefreshingHealth(true);
    const startedAt = Date.now();
    try { await onRefreshHealth(); }
    finally { window.setTimeout(() => setRefreshingHealth(false), Math.max(0, 400 - (Date.now() - startedAt))); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!currentPassword) {
      setPwdMsg({ type: 'error', text: 'Current password is required.' });
      return;
    }
    const minPasswordLength = 8;
    if (newPassword.length < minPasswordLength) {
      setPwdMsg({ type: 'error', text: `New password must be at least ${minPasswordLength} characters long.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await apiFetch('/api/admin/security/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPwdMsg({ type: 'success', text: 'Administrator password successfully updated!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwdMsg({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.message || 'Network error updating password.' });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSavePolicy = (val: string) => {
    setReLoginPolicy(val);
    localStorage.setItem('win11_admin_relogin_policy', val);
    onPolicyChange?.(val);
    setPolicyMsg('Session security policy saved.');
    setTimeout(() => setPolicyMsg(null), 3000);
  };

  const handleRevokeAllSessions = async () => {
    if (!await confirm({ title: 'Revoke other sessions?', message: 'Sign out every other active administrator session while keeping this one signed in?', confirmLabel: 'Revoke sessions', destructive: true })) return;
    setRevokingSessions(true);
    setSessionActionMessage(null);
    try {
      const res = await apiFetch('/api/admin/security/sessions/revoke-others', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Other sessions could not be revoked.');
      setSessionActionMessage({ type: 'success', text: `${data.revokedCount} other session(s) revoked.` });
      setLoginHistoryReload((value) => value + 1);
    } catch (err: any) {
      setSessionActionMessage({ type: 'error', text: err.message || 'Other sessions could not be revoked.' });
    } finally {
      setRevokingSessions(false);
    }
  };

  const serviceStatus = [
    ['API server', health?.status === 'healthy' ? 'Healthy' : health ? 'Degraded' : 'Checking', Boolean(health && health.status === 'healthy'), Server],
    ['Database', health?.database.status === 'connected' ? 'Connected' : health?.database.status || 'Checking', health?.database.status === 'connected', Database],
    ['Admin sessions', 'Protected', true, ShieldCheck],
    ['Email replies', health?.email?.status === 'configured' ? 'Configured' : health?.email?.status === 'not-configured' ? 'Not configured' : 'Checking', health?.email?.status === 'configured', Mail],
    ['Media storage', health?.storage.status === 'healthy' ? 'Ready' : health?.storage.status || 'Checking', health?.storage.status === 'healthy', HardDrive],
  ] as const;

  return (
    <div className="admin-security w-full min-w-0 max-w-6xl space-y-4 pb-8">
      <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-2">
        <section className="admin-content-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-900">Change password</h2><p className="mt-1 text-xs text-slate-500">Choose a unique password with at least 8 characters.</p></div>
            <KeyRound className="mt-1 h-4 w-4 text-slate-400" />
          </div>

          {pwdMsg && (
            <div
              className={`mb-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs ${
                pwdMsg.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              <span>{pwdMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Current password</label>
              <div className="relative flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 transition-colors focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="h-10 min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  className="admin-password-eye-toggle inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">New password</label>
              <div className="relative flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 transition-colors focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="h-10 min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  className="admin-password-eye-toggle inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Confirm new password</label>
              <div className="relative flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 transition-colors focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="h-10 min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'}
                  className="admin-password-eye-toggle inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="admin-action-button inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />{pwdLoading ? 'Verifying & updating…' : 'Change password'}
            </button>
          </form>
        </section>

        <section className="admin-content-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-900">System status</h2><p className="mt-1 text-xs text-slate-500">Configuration checks only; secrets are never shown here.</p></div>
            <span className="admin-private-pill">Private</span>
          </div>
          {healthError && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">{healthError} {onRefreshHealth && <button type="button" onClick={onRefreshHealth} className="font-semibold underline">Retry</button>}</div>}
          {healthLoading && !health && <p role="status" className="py-3 text-xs text-slate-500">Checking service health…</p>}
          <div className="admin-service-list">
            {serviceStatus.map(([label, value, isReady, StatusIcon]) => (
              <div className="admin-service-row" key={label}>
                <span className="flex items-center gap-2"><StatusIcon className="h-3.5 w-3.5 text-slate-500" />{label}</span>
                <strong className={isReady ? 'is-ready' : 'is-warning'}>{healthLoading && value === 'Checking' ? 'Checking…' : value}</strong>
              </div>
            ))}
          </div>
          <div className="admin-security-callout"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" /><span>Configure or rotate database and email secrets in your hosting provider’s private environment settings—not in this dashboard.</span></div>
          {onRefreshHealth && <button type="button" onClick={() => void refreshServiceStatus()} disabled={healthLoading || refreshingHealth} className="admin-action-button mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-wait disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${healthLoading || refreshingHealth ? 'animate-spin' : ''}`} />{healthLoading || refreshingHealth ? 'Refreshing…' : 'Refresh service status'}</button>}
          {onLogout && <button type="button" onClick={onLogout} className="admin-action-button mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><LogOut className="h-3.5 w-3.5" />Sign out{adminEmail ? ` from ${adminEmail}` : ''}</button>}
        </section>
      </div>

      <section className="admin-content-card min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Account login history</h2>
            <p className="mt-1 text-xs text-slate-500">Sign-in and sign-out times for administrator and user accounts.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{loginHistoryPages.total} sessions</span>
        </div>
        {loginHistoryError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{loginHistoryError}</p>}
        {loginHistoryLoading && !loginHistory.length ? (
          <p role="status" className="py-6 text-center text-xs text-slate-500">Loading account login history…</p>
        ) : loginHistory.length ? (
          <>
            <div className="space-y-2">
              {loginHistory.map((session) => (
                <article key={session.id} className="admin-session-history-row grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{session.email}</p>
                    <p className="mt-1 text-[10px] capitalize text-slate-500">{session.role} account</p>
                  </div>
                  <p className="min-w-0 text-[10px] text-slate-600"><span className="font-semibold text-slate-700">Signed in: </span>{formatAdminDateTime(session.loginAt)}</p>
                  {!session.active && (
                    <p className="min-w-0 text-[10px] text-slate-600"><span className="font-semibold text-slate-700">{session.endReason === 'expired' ? 'Expired: ' : session.endReason === 'revoked' ? 'Revoked: ' : 'Signed out: '}</span>{formatAdminDateTime(session.logoutAt || session.expiresAt)}</p>
                  )}
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${session.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{session.active ? 'Active' : session.endReason === 'expired' ? 'Expired' : session.endReason === 'revoked' ? 'Revoked' : 'Signed out'}</span>
                </article>
              ))}
            </div>
            {loginHistoryPages.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="text-slate-500">Showing {(loginHistoryPage - 1) * 5 + 1}–{Math.min(loginHistoryPage * 5, loginHistoryPages.total)} of {loginHistoryPages.total}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setLoginHistoryPage((page) => Math.max(1, page - 1))} disabled={loginHistoryPage <= 1} aria-label="Previous login history page" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} /></button>
                  <button type="button" onClick={() => setLoginHistoryPage((page) => Math.min(loginHistoryPages.totalPages, page + 1))} disabled={loginHistoryPage >= loginHistoryPages.totalPages} aria-label="Next login history page" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={15} /></button>
                </div>
              </div>
            )}
          </>
        ) : !loginHistoryError ? (
          <p className="py-6 text-center text-xs text-slate-500">No sign-in sessions have been recorded yet.</p>
        ) : null}
      </section>

      <details className="admin-content-card rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700"><span className="inline-flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-sky-600" />Additional session controls</span></summary>
        <div className="pt-3">
          <p className="text-xs leading-relaxed text-slate-500">Administrator sessions expire after 15 minutes and are also revoked after 15 minutes of inactivity. The panel lock policy controls when the local admin window asks for credentials again.</p>
          {policyMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700">
              {policyMsg}
            </div>
          )}

          {sessionActionMessage && (
            <div role={sessionActionMessage.type === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-2.5 text-xs ${sessionActionMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {sessionActionMessage.text}
            </div>
          )}

          <div className="mt-3 space-y-2.5 text-xs">
            {[
              { id: 'remember', title: 'No automatic panel lock', desc: 'The administrator panel remains open while the server-side session is valid.' },
              { id: 'timeout_15m', title: 'Auto-Lock (15 mins)', desc: 'Locks panel after 15m inactivity.' },
              { id: 'prompt_always', title: 'Always Require Login', desc: 'Requires sign-in when the admin panel is opened.' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                  reLoginPolicy === opt.id
                    ? 'border-sky-200 bg-sky-50 text-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="policy"
                  checked={reLoginPolicy === opt.id}
                  onChange={() => handleSavePolicy(opt.id)}
                  className="mt-0.5 accent-blue-500"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800">{opt.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleRevokeAllSessions}
              disabled={revokingSessions}
              className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{revokingSessions ? 'Revoking sessions...' : 'Revoke All Other Sessions'}</span>
            </button>
          </div>
        </div>
      </details>
    </div>
  );
};
