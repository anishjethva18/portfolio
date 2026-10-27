import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  FolderKanban,
  Camera,
  BarChart3,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
  X,
} from 'lucide-react';

interface AdminLoginScreenProps {
  onLogin: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  onVisitPortfolio?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onLogin,
}) => {
  const initialResetToken =
    new URLSearchParams(window.location.search).get('resetToken') ||
    new URLSearchParams(window.location.hash.replace(/^#/, '')).get('resetToken') || '';
  const [cameFromResetLink] = useState(Boolean(initialResetToken));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(Boolean(initialResetToken));
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetStep, setIsResetStep] = useState(Boolean(initialResetToken));

  const returnToAdminLogin = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('resetToken');
    url.searchParams.set('app', 'admin');
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    hashParams.delete('resetToken');
    url.hash = hashParams.toString();
    window.location.replace(url.toString());
  };

  useEffect(() => {
    if (!cameFromResetLink) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('resetToken');
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    hashParams.delete('resetToken');
    url.hash = hashParams.toString();
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }, [cameFromResetLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your admin email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await onLogin(email.trim(), password);
    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      setForgotLoading(false);
      if (res.ok && data.success) {
        setForgotMsg({ type: 'success', text: data.message || 'If this administrator account exists, a password reset link will be emailed.' });
      } else {
        setForgotMsg({
          type: 'error',
          text: data.message || data.error || 'Failed to dispatch reset request.',
        });
      }
    } catch (err: any) {
      setForgotLoading(false);
      setForgotMsg({ type: 'error', text: err.message || 'Network error occurred.' });
    }
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) return;
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), newPassword }),
      });
      const data = await res.json();
      setForgotLoading(false);
      if (res.ok && data.success) {
        setForgotMsg({
          type: 'success',
          text: 'Password updated successfully! You can now log in.',
        });
        setTimeout(() => {
          if (cameFromResetLink) {
            returnToAdminLogin();
            return;
          }
          setShowForgotModal(false);
          setIsResetStep(false);
          setResetToken('');
          setNewPassword('');
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
        }, 1500);
      } else {
        setForgotMsg({
          type: 'error',
          text: data.message || data.error || 'Failed to reset password.',
        });
      }
    } catch (err: any) {
      setForgotLoading(false);
      setForgotMsg({ type: 'error', text: err.message || 'Network error occurred.' });
    }
  };

  return (
    <div
      className="admin-login-screen relative flex h-full min-h-0 w-full min-w-0 flex-col justify-center overflow-y-auto select-none font-sans text-slate-100"
      style={{
        backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.4), rgba(2, 6, 23, 0.4)),
                          radial-gradient(ellipse at 80% 30%, rgba(14, 165, 233, 0.15) 0%, transparent 60%),
                          radial-gradient(ellipse at 20% 70%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
                          url('/downloads/Windows11.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#030712',
      }}
    >
      {/* MAIN CONTAINER */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-5 sm:px-8 sm:py-8 lg:px-16">
        <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-14">
          {/* LEFT COLUMN: HERO & FEATURE HIGHLIGHTS */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-400/25 bg-blue-950/40 backdrop-blur-md shadow-sm w-fit mb-5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-blue-200 tracking-wide">
                Secure Administrator Access
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-white leading-tight">
              Welcome to<br />
              <span className="text-[#00a2ff]">Admin</span>{' '}
              <span className="bg-gradient-to-r from-[#c084fc] via-[#d946ef] to-[#e879f9] bg-clip-text text-transparent">
                Panel
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-4 mb-7 max-w-xl font-normal">
              Manage your Windows 11 Portfolio System with powerful tools, secure access, and real-time insights.
            </p>

            {/* 4 Feature Cards (2x2 Grid) */}
            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl">
              {/* Card 1: User Management */}
              <div className="bg-slate-900/50 hover:bg-slate-900/70 border border-white/10 hover:border-white/20 rounded-2xl p-4 backdrop-blur-md transition-all shadow-lg flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 shadow-md shadow-blue-600/30 flex items-center justify-center shrink-0 text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-white tracking-tight">User Management</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                    Manage users, roles and permissions securely.
                  </p>
                </div>
              </div>

              {/* Card 2: Portfolio Control */}
              <div className="bg-slate-900/50 hover:bg-slate-900/70 border border-white/10 hover:border-white/20 rounded-2xl p-4 backdrop-blur-md transition-all shadow-lg flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-600 shadow-md shadow-purple-600/30 flex items-center justify-center shrink-0 text-white">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-white tracking-tight">Portfolio Control</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                    Update projects, content and website details.
                  </p>
                </div>
              </div>

              {/* Card 3: Media & File Access */}
              <div className="bg-slate-900/50 hover:bg-slate-900/70 border border-white/10 hover:border-white/20 rounded-2xl p-4 backdrop-blur-md transition-all shadow-lg flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/30 flex items-center justify-center shrink-0 text-white">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-white tracking-tight">Media & File Access</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                    View and manage camera archives and files.
                  </p>
                </div>
              </div>

              {/* Card 4: Analytics & System */}
              <div className="bg-slate-900/50 hover:bg-slate-900/70 border border-white/10 hover:border-white/20 rounded-2xl p-4 backdrop-blur-md transition-all shadow-lg flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-600 shadow-md shadow-amber-600/30 flex items-center justify-center shrink-0 text-white">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-white tracking-tight">Analytics & System</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                    Monitor activity, storage and system health.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Quote Card */}
            <div className="hidden md:flex bg-slate-900/50 border border-white/10 rounded-2xl p-4 backdrop-blur-md max-w-xl items-center gap-3.5 mt-4 shadow-lg">
              <span className="text-3xl font-serif text-blue-400 font-bold leading-none select-none shrink-0">
                “
              </span>
              <p className="text-xs sm:text-sm italic text-slate-200 font-normal leading-relaxed">
                “A secure and powerful control center for your portfolio ecosystem.”
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: ADMINISTRATOR LOGIN CARD */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center gap-4">
            <div className="admin-login-card relative w-full max-w-[440px] rounded-3xl border border-white/15 bg-slate-900/65 p-5 shadow-2xl shadow-black/80 backdrop-blur-2xl sm:p-8">
              {/* Windows 11 Center Glowing Logo */}
              <div className="mb-6 flex flex-col items-center justify-center">
                <div className="grid grid-cols-2 gap-1 w-10 h-10 drop-shadow-[0_0_12px_rgba(0,120,212,0.6)]">
                  <div className="bg-[#0078d4] rounded-[2.5px]" />
                  <div className="bg-[#0078d4] rounded-[2.5px]" />
                  <div className="bg-[#0078d4] rounded-[2.5px]" />
                  <div className="bg-[#0078d4] rounded-[2.5px]" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight text-center mt-3">
                  Administrator Login
                </h2>
                <p className="text-xs text-slate-400 text-center mt-1">
                  Sign in to access the Admin Panel
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative flex items-center rounded-xl bg-slate-950/60 border border-white/15 hover:border-white/25 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all">
                    <Mail className="w-4 h-4 text-slate-400 ml-3.5 mr-2.5 shrink-0" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your admin email"
                      required
                      className="w-full bg-transparent text-sm text-white py-2.5 pr-3.5 outline-none placeholder:text-slate-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email.trim());
                        setForgotMsg(null);
                        setIsResetStep(false);
                        setShowForgotModal(true);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative flex items-center rounded-xl bg-slate-950/60 border border-white/15 hover:border-white/25 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all">
                    <Lock className="w-4 h-4 text-slate-400 ml-3.5 mr-2.5 shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full bg-transparent text-sm text-white py-2.5 pr-10 outline-none placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="admin-password-eye-toggle absolute right-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 hover:from-blue-500 hover:to-sky-400 active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <>
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="admin-login-modal fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 bg-black/70 backdrop-blur-sm animate-fadeIn sm:p-4">
          <div className="my-auto w-full max-w-md overflow-y-auto rounded-3xl border border-slate-700/60 bg-slate-900 p-4 text-slate-200 shadow-2xl space-y-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Reset Administrator Password</h3>
                  <p className="text-xs text-slate-400">{isResetStep ? 'Choose a new administrator password' : 'A secure reset link will be sent to your email'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (cameFromResetLink) {
                    returnToAdminLogin();
                    return;
                  }
                  setShowForgotModal(false);
                  setIsResetStep(false);
                  setForgotMsg(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  forgotMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{forgotMsg.text}</span>
              </div>
            )}

            {!isResetStep ? (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Administrator Email Address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    We will email a secure link if this address belongs to an account.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  {forgotMsg?.type === 'success' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(false);
                        setIsResetStep(false);
                        setForgotMsg(null);
                      }}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                    >
                      Back to Login
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {forgotLoading ? 'Sending...' : 'Email Reset Link'}
                      </button>
                    </>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompletePasswordReset} className="space-y-4">
                <p className="text-xs text-slate-400">This reset link is secure and can only be used once.</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className="w-full px-3.5 py-2.5 pr-11 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((visible) => !visible)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-2 inline-flex w-8 items-center justify-center text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => (cameFromResetLink ? returnToAdminLogin() : setIsResetStep(false))}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {forgotLoading ? 'Updating...' : 'Set New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
