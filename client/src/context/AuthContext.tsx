import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { isPortfolioDataMutation, notifyPortfolioDataUpdated } from '../utils/portfolioSync';
import { broadcastAdminSessionEnded, isProtectedAdminRequest, watchAdminSessionEnded } from '../utils/adminSessionEvents';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  avatar?: string;
  bio?: string;
  settings?: {
    theme?: 'light' | 'dark';
    wallpaper?: string;
    soundEnabled?: boolean;
    accentColor?: string;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLocked: boolean;
  isLoading: boolean;
  csrfToken: string | null;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: (options?: { lockScreen?: boolean }) => Promise<void>;
  lockScreen: () => void;
  unlockScreen: (passwordOrPin: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

async function readLoginResponse(response: Response): Promise<any> {
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!body.trim()) {
    throw new Error(
      `The login service returned an empty response (HTTP ${response.status}). Check that the server is running and the client API proxy is configured.`
    );
  }

  if (!contentType.includes('application/json')) {
    throw new Error(
      `The login service returned an unexpected response type (HTTP ${response.status}, ${contentType || 'unknown content type'}). Check the client API proxy and server route.`
    );
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`The login service returned invalid JSON (HTTP ${response.status}).`);
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCK_KEY = 'win11_portfolio_is_locked';
export const DEFAULT_AVATAR_KEY = 'win11_default_avatar';
export const ABOUT_PROFILE_KEY = 'win11_custom_about_profile';

const getInitialAvatar = (): string => {
  try {
    const savedAvatar = localStorage.getItem(DEFAULT_AVATAR_KEY);
    if (savedAvatar) return savedAvatar;
    const customProfile = localStorage.getItem(ABOUT_PROFILE_KEY);
    if (customProfile) {
      const parsed = JSON.parse(customProfile);
      if (parsed?.avatar) return parsed.avatar;
    }
  } catch {}
  return '/avatar.png';
};

const getInitialName = (): string => {
  try {
    const customProfile = localStorage.getItem(ABOUT_PROFILE_KEY);
    if (customProfile) {
      const parsed = JSON.parse(customProfile);
      if (parsed?.name) return parsed.name;
    }
  } catch {}
  return 'User';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const currentUser = useRef(user);

  useEffect(() => {
    currentUser.current = user;
  }, [user]);

  // Authenticated fetch helper with CSRF token and cookie credentials
  const apiFetch = useCallback(
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers || {});
      if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes((init.method || 'GET').toUpperCase())) {
        headers.set('X-CSRF-Token', csrfToken);
      }
      const response = await fetch(url, {
        ...init,
        headers,
        credentials: 'include', // include HttpOnly session cookie
      });
      if (response.status === 401 && user?.role === 'admin' && isProtectedAdminRequest(url)) {
        broadcastAdminSessionEnded();
      }
      if (response.ok && isPortfolioDataMutation(url, (init.method || 'GET').toUpperCase())) {
        notifyPortfolioDataUpdated(url, (init.method || 'GET').toUpperCase());
      }
      return response;
    },
    [csrfToken, user?.role]
  );

  // Verify server-side session on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch('/api/auth/me', {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then((data) => {
        if (isMounted && data.success && data.user) {
          const defaultAvatar = getInitialAvatar();
          const defaultName = getInitialName();
          const mergedUser: UserProfile = {
            ...data.user,
            avatar: defaultAvatar || data.user.avatar || '/avatar.png',
            name: data.user.name || defaultName,
          };
          setUser(mergedUser);
          if (data.csrfToken) {
            setCsrfToken(data.csrfToken);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setCsrfToken(null);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => watchAdminSessionEnded((lockScreen) => {
    if (currentUser.current?.role !== 'admin') return;
    currentUser.current = null;
    setUser(null);
    setCsrfToken(null);
    setIsLocked(lockScreen);
    try {
      sessionStorage.setItem('win11_admin_panel_locked', 'true');
      localStorage.setItem(LOCK_KEY, String(lockScreen));
    } catch (error) {
      console.error('[AuthContext] Could not persist the admin lock state after session end.', error);
    }
  }), []);

  // The published portfolio profile is the canonical avatar across every app,
  // including visitors who do not have an authenticated account.
  useEffect(() => {
    let isMounted = true;
    fetch('/api/profile')
      .then((response) => response.json())
      .then((profile) => {
        if (!isMounted || typeof profile?.avatar !== 'string' || !profile.avatar.trim()) return;
        try { localStorage.setItem(DEFAULT_AVATAR_KEY, profile.avatar); } catch {}
        setUser((current) => current ? { ...current, avatar: profile.avatar } : current);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Synchronize profile changes
  useEffect(() => {
    const handleProfileUpdateEvent = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setUser((prev) => {
          if (!prev) return prev;
          return { ...prev, ...detail };
        });
      }
    };

    window.addEventListener('win11_profile_updated', handleProfileUpdateEvent as EventListener);
    const handlePublishedContent = (event: Event) => {
      const profile = (event as CustomEvent).detail?.profile;
      if (!profile) return;
      if (typeof profile.avatar === 'string' && profile.avatar.trim()) {
        try { localStorage.setItem(DEFAULT_AVATAR_KEY, profile.avatar); } catch {}
      }
      setUser((prev) => prev ? { ...prev, name: profile.name || prev.name, avatar: profile.avatar || prev.avatar, bio: profile.bio || prev.bio } : prev);
    };
    window.addEventListener('portfolio-content-published', handlePublishedContent);
    return () => {
      window.removeEventListener('win11_profile_updated', handleProfileUpdateEvent as EventListener);
      window.removeEventListener('portfolio-content-published', handlePublishedContent);
    };
  }, []);

  const login = async (
    email: string,
    pass: string,
    rememberMe = false
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password: pass, rememberMe }),
      });
      const data = await readLoginResponse(res);

      if (!res.ok || !data.success) {
        setIsLoading(false);
        return { success: false, error: data.error || 'Login failed' };
      }

      const defaultAvatar = getInitialAvatar();
      const mergedUser: UserProfile = {
        ...data.user,
        avatar: defaultAvatar || data.user.avatar || '/avatar.png',
      };

      setUser(mergedUser);
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      setIsLocked(false);
      try {
        localStorage.setItem(LOCK_KEY, 'false');
      } catch {}
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const logout = useCallback(async (options: { lockScreen?: boolean } = {}) => {
    const lockScreen = options.lockScreen !== false;
    const response = await apiFetch('/api/auth/logout', { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    if (response.status !== 401 && (!response.ok || result.success !== true)) {
      throw new Error(result.error || `Logout failed (HTTP ${response.status}).`);
    }

    setUser(null);
    setCsrfToken(null);
    setIsLocked(lockScreen);
    try {
      localStorage.setItem(LOCK_KEY, String(lockScreen));
      sessionStorage.setItem('win11_admin_panel_locked', 'true');
    } catch {}
    broadcastAdminSessionEnded(lockScreen);
  }, [apiFetch]);

  const lockScreen = () => {
    setIsLocked(true);
    try {
      localStorage.setItem(LOCK_KEY, 'true');
    } catch {}
  };

  const unlockScreen = async (passwordOrPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!passwordOrPin) {
      setIsLocked(false);
      try {
        localStorage.setItem(LOCK_KEY, 'false');
      } catch {}
      return { success: true };
    }

    try {
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ password: passwordOrPin }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsLocked(false);
        try {
          localStorage.setItem(LOCK_KEY, 'false');
        } catch {}
        if (data.user) setUser(data.user);
        if (data.csrfToken) setCsrfToken(data.csrfToken);
        return { success: true };
      }
      return { success: false, error: data.error || 'Unable to unlock the desktop.' };
    } catch (err) {
      console.error('Unlock failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unable to contact the authentication service.',
      };
    }
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    try {
      if (data.avatar) {
        try {
          localStorage.setItem(DEFAULT_AVATAR_KEY, data.avatar);
        } catch {}
      }

      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (user) {
        const updated = { ...user, ...data };
        setUser(updated);
      }
      window.dispatchEvent(new CustomEvent('win11_profile_updated', { detail: data }));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && user.role !== 'guest',
        isAdmin: !!user && user.role === 'admin',
        isLocked,
        isLoading,
        csrfToken,
        login,
        logout,
        lockScreen,
        unlockScreen,
        updateProfile,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
