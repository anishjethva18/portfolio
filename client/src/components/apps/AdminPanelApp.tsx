import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOS } from '../../context/OSContext';
import { apiFetch } from '../../utils/apiClient';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { uploadPortfolioMedia } from '../../utils/uploadPortfolioMedia';
import { formatBackupDateTime } from '../../utils/dateTime';
import { getContentState, getProjectState } from '../../utils/adminDraftStatus';
import { useResponsivePageSize } from '../../hooks/useResponsivePageSize';
import { AdminPanelLayout } from './AdminPanelLayout';
import { AdminLoginScreen } from './AdminLoginScreen';
import { AdminPagination } from './AdminPagination';
import { UserManagement } from './UserManagement';
import { CameraArchive } from './CameraArchive';
import { ProjectManagement } from './ProjectManagement';
import { ContactManagement } from './ContactManagement';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { PortfolioManagement } from './PortfolioManagement';
import { SecurityManagement } from './SecurityManagement';
import { MediaManagement } from './admin/MediaManagement';
import { AdvancedContentManagement } from './admin/AdvancedContentManagement';
import { AdminDashboardChart } from './admin/AdminDashboardChart';
import { PublishingManagement } from './admin/PublishingManagement';
import {
  FolderKanban,
  Users,
  MessageSquare,
  HardDrive,
  Activity,
  RefreshCw,
  Edit,
  UserCheck,
  Download,
  UploadCloud,
  Cloud,
  ArrowUpRight,
  Sparkles,
  Globe,
} from 'lucide-react';

type AdminTab =
  | 'dashboard'
  | 'users'
  | 'portfolio'
  | 'appearance'
  | 'media'
  | 'seo'
  | 'advanced'
  | 'publishing'
  | 'projects'
  | 'contacts'
  | 'archives'
  | 'analytics'
  | 'security'
  | 'backup';

function updateIfChanged<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  nextValue: T
): void {
  setState((current) => JSON.stringify(current) === JSON.stringify(nextValue) ? current : nextValue);
}

export const AdminPanelApp: React.FC<{ windowId?: string }> = ({ windowId }) => {
  const confirm = useConfirmDialog();
  const { user, login, logout } = useAuth();
  const { settings: osSettings, minimizeWindow, maximizeWindow, closeWindow, openApp, updateSettings, registerWindowCloseGuard } = useOS();
  const isLight = osSettings?.theme === 'light';
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('portfolio_admin_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Session state: check re-login policy and lock state
  const [isPanelLocked, setIsPanelLocked] = useState<boolean>(() => {
    const policy = localStorage.getItem('win11_admin_relogin_policy');
    if (policy === 'prompt_always') return true;
    if (sessionStorage.getItem('win11_admin_panel_locked') === 'true') return true;
    return false;
  });
  const [sessionPolicy, setSessionPolicy] = useState(() => localStorage.getItem('win11_admin_relogin_policy') || 'timeout_15m');

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [publishedProjects, setPublishedProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [archivesList, setArchivesList] = useState<any[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveMediaType, setArchiveMediaType] = useState('all');
  const [archivePage, setArchivePage] = useState(1);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const archiveListRef = useRef<HTMLDivElement>(null);
  const adminRolesMigratedRef = useRef(false);
  const adminRolesMigrationPromiseRef = useRef<Promise<void> | null>(null);
  const archivePageSize = useResponsivePageSize(10, 220, archiveListRef, 80);
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsRecentPage, setAnalyticsRecentPage] = useState(1);
  const [activityDays, setActivityDays] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [projectFormDirty, setProjectFormDirty] = useState(false);
  const [projectsDirty, setProjectsDirty] = useState(false);
  const [draftSavedAfterChanges, setDraftSavedAfterChanges] = useState(false);
  const pendingProjectDraftIds = useRef<Set<string>>(new Set());
  const savePendingProjectsRef = useRef<() => void>(() => undefined);
  const [hasUnpublishedDraft, setHasUnpublishedDraft] = useState<boolean | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ latest: any; scheduled: boolean } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const backupFileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!successMsg) return;
    const timeoutId = window.setTimeout(() => setSuccessMsg(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [successMsg]);

  useEffect(() => {
    if (!error) return;
    const timeoutId = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  const handleLoginFromScreen = async (email: string, pass: string) => {
    const result = await login(email, pass, false);
    if (result.success) {
      sessionStorage.removeItem('win11_admin_panel_locked');
      setIsPanelLocked(false);
    }
    return result;
  };

  const fetchSystemHealth = async (silent = false) => {
    if (!silent) {
      setHealthLoading(true);
      setHealthError(null);
    }
    try {
      const response = await apiFetch('/api/health/admin');
      const data = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(data.error || 'System health could not be loaded.');
      updateIfChanged(setSystemHealth, data);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background system health refresh failed.', err);
      else setHealthError(err.message || 'System health could not be loaded.');
    } finally {
      if (!silent) setHealthLoading(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    try {
      await logout({ lockScreen: false });
      setIsPanelLocked(true);
    } catch (err: any) {
      setError(err.message || 'Could not end the administrator session.');
    }
  };

  const handleCloseAdminWindow = useCallback(async (): Promise<boolean> => {
    if (user?.role !== 'admin') return true;
    setError(null);
    try {
      await logout({ lockScreen: false });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication service unavailable.';
      setError(`Could not end the administrator session: ${message}. The Admin window is still open; retry Close or Log out.`);
      return false;
    }
  }, [logout, user?.role]);

  useEffect(() => {
    if (!windowId) return;
    return registerWindowCloseGuard(windowId, handleCloseAdminWindow);
  }, [windowId, registerWindowCloseGuard, handleCloseAdminWindow]);

  const fetchDraftAvailability = async () => {
    try {
      const [snapshotResponse, draftProjectsResponse] = await Promise.all([
        apiFetch('/api/admin/content-studio'),
        apiFetch('/api/admin/projects'),
      ]);
      const [snapshot, draftProjects] = await Promise.all([
        snapshotResponse.json(),
        draftProjectsResponse.json(),
      ]);
      if (!snapshotResponse.ok || !snapshot.success) throw new Error(snapshot.error || 'Draft status could not be loaded.');
      if (!draftProjectsResponse.ok || !draftProjects.success || !Array.isArray(draftProjects.projects)) {
        throw new Error(draftProjects.error || 'Staged project status could not be loaded.');
      }
      const liveProjects = Array.isArray(draftProjects.publishedProjects)
        ? draftProjects.publishedProjects
        : await apiFetch('/api/projects').then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.projects)) {
              throw new Error(data.error || 'Published project status could not be loaded.');
            }
            return data.projects;
          });
      const hasUnpublishedChanges =
        getContentState(snapshot.draft) !== getContentState(snapshot.published) ||
        getProjectState(draftProjects.projects) !== getProjectState(liveProjects);
      setHasUnpublishedDraft(hasUnpublishedChanges);
      return hasUnpublishedChanges;
    } catch (err: any) {
      setError(err.message || 'Draft status could not be loaded.');
      return false;
    }
  };

  const reportDraftDirty = (dirty: boolean) => {
    setDraftDirty(dirty);
    if (dirty) setDraftSavedAfterChanges(false);
  };

  const reportProjectFormDirty = (dirty: boolean) => {
    setProjectFormDirty(dirty);
    if (dirty) setDraftSavedAfterChanges(false);
  };

  const markCurrentDraftAsSaved = async () => {
    setDraftSavedAfterChanges(await fetchDraftAvailability());
  };

  const refreshWorkspaceData = () => {
    fetchDashboard();
    fetchProjects();
    void fetchDraftAvailability();
    fetchUsers();
    fetchContacts();
    fetchTasks();
    fetchBackupStatus();
  };

  const refreshAll = () => {
    refreshWorkspaceData();
    fetchArchives();
    fetchAnalytics();
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      refreshWorkspaceData();
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.role === 'admin') fetchArchives();
  }, [user?.id, user?.role, archiveSearch, archiveMediaType, archivePage, archivePageSize]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || isPanelLocked || sessionPolicy !== 'timeout_15m') return;

    let lastActivityAt = Date.now();
    let lastHeartbeatActivityAt = lastActivityAt;
    let heartbeatInProgress = false;
    let timeoutId = window.setTimeout(lockPanel, 15 * 60 * 1000);
    const resetTimeout = () => {
      lastActivityAt = Date.now();
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(lockPanel, 15 * 60 * 1000);
    };
    function lockPanel() {
      sessionStorage.setItem('win11_admin_panel_locked', 'true');
      setIsPanelLocked(true);
    }

    const activityEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll'];
    activityEvents.forEach((eventName) => document.addEventListener(eventName, resetTimeout, { passive: true }));
    const heartbeatId = window.setInterval(async () => {
      if (
        document.visibilityState === 'hidden' ||
        heartbeatInProgress ||
        lastActivityAt <= lastHeartbeatActivityAt
      ) return;

      heartbeatInProgress = true;
      try {
        const response = await apiFetch('/api/auth/me');
        if (response.status === 401) {
          try {
            await logout();
          } catch (logoutError) {
            console.error('[AdminPanel] Could not clear an expired administrator session.', logoutError);
            sessionStorage.setItem('win11_admin_panel_locked', 'true');
            setIsPanelLocked(true);
          }
          return;
        }
        if (!response.ok) throw new Error(`Session heartbeat failed (HTTP ${response.status}).`);
        lastHeartbeatActivityAt = lastActivityAt;
      } catch (heartbeatError) {
        console.error('[AdminPanel] Could not renew the active administrator session.', heartbeatError);
        lastHeartbeatActivityAt = lastActivityAt;
      } finally {
        heartbeatInProgress = false;
      }
    }, 60 * 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(heartbeatId);
      activityEvents.forEach((eventName) => document.removeEventListener(eventName, resetTimeout));
    };
  }, [user, isPanelLocked, sessionPolicy, apiFetch, logout]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || isPanelLocked || !['dashboard', 'analytics'].includes(activeTab)) return;
    void fetchAnalytics();
    let refreshTimeoutId: number | undefined;
    const refreshAfterPortfolioActivity = () => {
      window.clearTimeout(refreshTimeoutId);
      refreshTimeoutId = window.setTimeout(() => void fetchAnalytics(), 250);
    };
    window.addEventListener('portfolio-analytics-updated', refreshAfterPortfolioActivity);
    return () => {
      window.clearTimeout(refreshTimeoutId);
      window.removeEventListener('portfolio-analytics-updated', refreshAfterPortfolioActivity);
    };
  }, [user?.id, user?.role, isPanelLocked, activeTab, analyticsRecentPage, activityDays]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || isPanelLocked || activeTab !== 'security') return;
    void fetchSystemHealth();
  }, [user?.id, user?.role, isPanelLocked, activeTab]);

  const toggleAdminTheme = () => {
    setAdminTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('portfolio_admin_theme', next); } catch { /* keep the in-memory preference */ }
      return next;
    });
  };

  const fetchAnalytics = async (recentPage = analyticsRecentPage, selectedActivityDays = activityDays, silent = false) => {
    if (!silent) {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
    }
    try {
      const res = await apiFetch(`/api/analytics/dashboard?recentPage=${recentPage}&recentLimit=5&activityDays=${selectedActivityDays}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Analytics could not be loaded.');
      updateIfChanged(setAnalyticsData, data);
      setAnalyticsRecentPage(recentPage);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background analytics refresh failed.', err);
      else {
        setAnalyticsError(err.message || 'Analytics could not be loaded.');
        setError(err.message || 'Analytics could not be loaded.');
      }
    } finally {
      if (!silent) setAnalyticsLoading(false);
    }
  };

  const fetchDashboard = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await apiFetch('/api/admin/dashboard');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load admin dashboard.');
      updateIfChanged(setDashboardData, data);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background dashboard refresh failed.', err);
      else setError(err.message || 'Network error loading dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchProjects = async (silent = false) => {
    if (!silent) setProjectsLoading(true);
    try {
      const res = await apiFetch('/api/admin/projects');
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.projects)) {
        throw new Error(data.error || 'Projects could not be loaded.');
      }
      updateIfChanged(setProjects, data.projects);
      updateIfChanged(setPublishedProjects, Array.isArray(data.publishedProjects) ? data.publishedProjects : []);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background project refresh failed.', err);
      else setError(err.message || 'Projects could not be loaded.');
    } finally {
      if (!silent) setProjectsLoading(false);
    }
  };

  useEffect(() => {
    const handleDraftRestored = () => {
      pendingProjectDraftIds.current.clear();
      setDraftDirty(false);
      setProjectFormDirty(false);
      setProjectsDirty(false);
      setError(null);
      void fetchProjects();
      void markCurrentDraftAsSaved();
    };
    window.addEventListener('portfolio-draft-restored', handleDraftRestored);
    return () => window.removeEventListener('portfolio-draft-restored', handleDraftRestored);
  }, []);

  const fetchUsers = async (silent = false) => {
    try {
      if (!adminRolesMigratedRef.current) {
        if (!adminRolesMigrationPromiseRef.current) {
          adminRolesMigrationPromiseRef.current = (async () => {
            const migrationResponse = await apiFetch('/api/admin/users/migrate-to-admin', {
              method: 'POST',
              body: JSON.stringify({}),
            });
            const migrationData = await migrationResponse.json();
            if (!migrationResponse.ok || !migrationData.success) {
              throw new Error(migrationData.error || 'Existing accounts could not be converted to administrators.');
            }
            adminRolesMigratedRef.current = true;
            if (migrationData.migratedCount > 0) {
              setSuccessMsg(`${migrationData.migratedCount} existing account(s) converted to Admin.`);
            }
          })();
        }
        try {
          await adminRolesMigrationPromiseRef.current;
        } catch (migrationError) {
          adminRolesMigrationPromiseRef.current = null;
          throw migrationError;
        }
      }
      const res = await apiFetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.users)) throw new Error(data.error || 'Administrator accounts could not be loaded.');
      updateIfChanged(setUsersList, data.users);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background account refresh failed.', err);
      else setError(err.message || 'Administrator accounts could not be loaded.');
    }
  };

  const handleCreateUser = async (user: { name: string; email: string; password: string; role: 'admin' }) => {
    try {
      const res = await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(user) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'User account could not be created.');
      setSuccessMsg('User account created.');
      await fetchUsers();
      return true;
    } catch (err: any) {
      setError(err.message || 'User account could not be created.');
      return false;
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'User account could not be deleted.');
      setSuccessMsg('User account deleted.');
      setUsersList((current) => current.filter((user) => user.id !== id));
      await fetchUsers();
      return true;
    } catch (err: any) {
      setError(err.message || 'User account could not be deleted.');
      throw err;
    }
  };

  const handleEnableUser = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        body: JSON.stringify({ disabled: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Account could not be enabled.');
      setSuccessMsg('Administrator account enabled.');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Account could not be enabled.');
    }
  };

  const handleDeleteArchive = async (id: string) => {
    if (!await confirm({ title: 'Delete archive capture?', message: 'This will permanently remove the selected camera archive capture and its stored file.', confirmLabel: 'Delete capture', destructive: true })) return;
    try {
      const res = await apiFetch(`/api/admin/archives/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to delete archive.');
        return;
      }
      setSuccessMsg('Archive capture permanently purged.');
      await fetchArchives();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownloadArchive = async (id: string) => {
    window.open(`/api/admin/archives/${id}/download`, '_blank');
  };

  const handleSaveProject = async (proj: any) => {
    try {
      const isNew = !proj.id;
      const url = isNew ? '/api/admin/projects' : `/api/admin/projects/${proj.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(proj)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save project.');
        return false;
      }
      if (!data.project || typeof data.project.id !== 'string') {
        throw new Error('Project was saved but the server did not return its updated draft record.');
      }
      setProjects((current) => {
        const index = current.findIndex((project) => project.id === data.project.id);
        if (index < 0) return [...current, data.project];
        return current.map((project) => project.id === data.project.id ? data.project : project);
      });
      setSuccessMsg(isNew ? 'Project created in draft.' : 'Project draft updated. Publish to apply this change to the live Projects app.');
      setDraftSavedAfterChanges(await fetchDraftAvailability());
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save project.');
      return false;
    }
  };

  const handleToggleProjectVisibility = async (id: string, visible: boolean) => {
    const project = projects.find((item) => item.id === id);
    if (!project) {
      setError('Project is no longer in the current draft. Refresh the Projects section and try again.');
      return false;
    }
    setProjects((current) => current.map((item) => item.id === id ? { ...item, visible } : item));
    pendingProjectDraftIds.current.add(id);
    setProjectsDirty(true);
    setDraftSavedAfterChanges(false);
    setError(null);
    setSuccessMsg(`${project.title} visibility changed locally. Save draft to stage it, then publish to update the Projects app.`);
    return true;
  };

  const handleReorderProjects = (orderedIds: string[]) => {
    const currentById = new Map(projects.map((project) => [project.id, project]));
    const ordered = orderedIds.map((id) => currentById.get(id)).filter(Boolean) as any[];
    if (ordered.length !== projects.length) return;
    const next = ordered.map((project, sortOrder) => ({ ...project, sortOrder }));
    setProjects(next);
    next.forEach((project) => pendingProjectDraftIds.current.add(project.id));
    setProjectsDirty(true);
    setDraftSavedAfterChanges(false);
    setError(null);
    setSuccessMsg('Project order changed locally. Save draft to stage it, then publish to update the Projects app.');
  };

  const savePendingProjectChanges = async () => {
    const ids = Array.from(pendingProjectDraftIds.current);
    let allSaved = true;
    for (const id of ids) {
      const project = projects.find((item) => item.id === id);
      if (!project) {
        setError(`Project ${id} is no longer in the list. Refresh Projects and try again.`);
        allSaved = false;
        continue;
      }
      if (await handleSaveProject(project)) pendingProjectDraftIds.current.delete(id);
      else allSaved = false;
    }
    setProjectsDirty(pendingProjectDraftIds.current.size > 0);
    if (allSaved && ids.length) setSuccessMsg('Project changes saved to draft. Publish to apply them to the live Projects app.');
  };
  savePendingProjectsRef.current = () => { void savePendingProjectChanges(); };

  useEffect(() => {
    const handleSaveDraft = () => savePendingProjectsRef.current();
    window.addEventListener('admin-save-content-draft', handleSaveDraft);
    return () => window.removeEventListener('admin-save-content-draft', handleSaveDraft);
  }, []);

  useEffect(() => {
    const handleDiscardUnsavedEdits = () => {
      pendingProjectDraftIds.current.clear();
      setProjectsDirty(false);
      setDraftSavedAfterChanges(false);
      setError(null);
      setSuccessMsg(null);
      void fetchProjects();
    };
    window.addEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
    return () => window.removeEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
  }, []);

  useEffect(() => {
    const handleDraftDiscard = () => {
      pendingProjectDraftIds.current.clear();
      setProjectsDirty(false);
      setDraftSavedAfterChanges(false);
      void fetchProjects();
      void fetchDraftAvailability();
    };
    window.addEventListener('portfolio-drafts-discarded', handleDraftDiscard);
    return () => window.removeEventListener('portfolio-drafts-discarded', handleDraftDiscard);
  }, []);

  const handleDeleteProject = async (id: string) => {
    if (!await confirm({ title: 'Delete project?', message: 'This project will be permanently removed from the portfolio.', confirmLabel: 'Delete project', destructive: true })) return false;
    try {
      const res = await apiFetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to delete project.');
        return false;
      }
      setSuccessMsg('Project deleted.');
      await fetchProjects();
      await fetchDraftAvailability();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete project.');
      return false;
    }
  };

  const handleReplyToContact = async (id: string, message: string) => {
    try {
      const res = await apiFetch(`/api/admin/contacts/${encodeURIComponent(id)}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Reply could not be sent.');
      }
      setSuccessMsg(`Reply sent to ${data.contact?.email || 'the contact'}.`);
      await fetchContacts();
    } catch (err: any) {
      setError(err.message || 'Reply could not be sent.');
      throw err;
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!await confirm({ title: 'Delete message?', message: 'This contact message will be permanently removed.', confirmLabel: 'Delete message', destructive: true })) return false;
    try {
      setError(null);
      const res = await apiFetch(`/api/admin/contacts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to delete contact message.');
        return false;
      }
      setSuccessMsg('Contact message deleted.');
      await fetchContacts();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete contact message.');
      return false;
    }
  };

  const fetchBackupStatus = async (silent = false) => {
    try {
      const res = await apiFetch('/api/admin/backup/status');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Backup status could not be loaded.');
      updateIfChanged(setBackupStatus, data);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background backup status refresh failed.', err);
      else setError(err.message || 'Backup status could not be loaded.');
    }
  };

  const handleRunBackup = async () => {
    setIsBackingUp(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/backup/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const fileName = data.backup?.fileName;
        if (typeof fileName !== 'string' || !fileName.endsWith('.json')) {
          throw new Error('Backup completed, but the server did not return its JSON filename.');
        }
        const downloadResponse = await apiFetch('/api/admin/backup/download');
        if (!downloadResponse.ok) {
          const downloadError = await downloadResponse.json();
          throw new Error(downloadError.error || 'Backup was created but could not be downloaded.');
        }
        const downloadUrl = URL.createObjectURL(await downloadResponse.blob());
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        setSuccessMsg('Backup created.');
        await fetchBackupStatus();
      } else {
        setError(data.error || 'Backup failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const response = await apiFetch('/api/admin/backup/download');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Backup download failed.');
      }
      const downloadUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = backupStatus?.latest?.fileName || 'portfolio-backup.json';
      link.click();
      URL.revokeObjectURL(downloadUrl);
      setSuccessMsg('Backup downloaded.');
    } catch (err: any) {
      setError(err.message || 'Backup download failed.');
    }
  };

  const handleRestoreBackup = async (file?: File) => {
    if (!file || isRestoringBackup) return;
    if (!await confirm({ title: 'Restore this backup?', message: 'This replaces the current portfolio content and projects with the selected backup.', confirmLabel: 'Restore backup', destructive: true })) {
      if (backupFileInput.current) backupFileInput.current.value = '';
      return;
    }
    setIsRestoringBackup(true);
    setError(null);
    try {
      const response = await apiFetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: file,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Portfolio restore failed.');
      setSuccessMsg('Backup restored.');
      pendingProjectDraftIds.current.clear();
      setDraftDirty(false);
      setProjectFormDirty(false);
      setProjectsDirty(false);
      window.dispatchEvent(new Event('portfolio-data-updated'));
      window.dispatchEvent(new Event('portfolio-content-published'));
      await Promise.all([fetchDashboard(), fetchProjects(), fetchBackupStatus(), fetchDraftAvailability()]);
    } catch (err: any) {
      setError(err.message || 'Portfolio restore failed.');
    } finally {
      setIsRestoringBackup(false);
      if (backupFileInput.current) backupFileInput.current.value = '';
    }
  };

  const fetchArchives = async (silent = false) => {
    try {
      const query = new URLSearchParams({
        search: archiveSearch,
        mediaType: archiveMediaType,
        page: String(archivePage),
        limit: String(archivePageSize),
      });
      const res = await apiFetch(`/api/admin/archives?${query}`);
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.captures)) throw new Error(data.error || 'Archive records could not be loaded.');
      updateIfChanged(setArchivesList, data.captures);
      setArchiveTotal((current) => current === data.total ? current : data.total);
      if (data.totalPages < archivePage) {
        setArchivePage(Math.max(1, data.totalPages));
        return;
      }
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background archive refresh failed.', err);
      else setError(err.message || 'Archive records could not be loaded.');
    }
  };

  const fetchContacts = async (silent = false) => {
    if (!silent) setContactsLoading(true);
    try {
      const res = await apiFetch('/api/admin/contacts');
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.contacts)) throw new Error(data.error || 'Contact messages could not be loaded.');
      updateIfChanged(setContactsList, data.contacts);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background contact refresh failed.', err);
      else setError(err.message || 'Contact messages could not be loaded.');
    } finally {
      if (!silent) setContactsLoading(false);
    }
  };

  const fetchTasks = async (silent = false) => {
    try {
      const res = await apiFetch('/api/admin/tasks');
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.tasks)) throw new Error(data.error || 'Admin tasks could not be loaded.');
      updateIfChanged(setTasksList, data.tasks);
    } catch (err: any) {
      if (silent) console.error('[AdminPanel] Background task refresh failed.', err);
      else setError(err.message || 'Admin tasks could not be loaded.');
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin' || isPanelLocked) return;
    let running = false;
    let refreshQueued = false;
    const refreshCurrentSection = async () => {
      if (running) {
        refreshQueued = true;
        return;
      }
      running = true;
      try {
        if (activeTab === 'dashboard') await Promise.all([fetchDashboard(true), fetchAnalytics(analyticsRecentPage, activityDays, true)]);
        else if (activeTab === 'users') await fetchUsers(true);
        else if (activeTab === 'projects') await fetchProjects(true);
        else if (activeTab === 'contacts') await fetchContacts(true);
        else if (activeTab === 'archives') await fetchArchives(true);
        else if (activeTab === 'backup') await fetchBackupStatus(true);
      } finally {
        running = false;
        if (refreshQueued) {
          refreshQueued = false;
          void refreshCurrentSection();
        }
      }
    };
    window.addEventListener('portfolio-data-updated', refreshCurrentSection);
    return () => {
      window.removeEventListener('portfolio-data-updated', refreshCurrentSection);
    };
  }, [user?.id, user?.role, isPanelLocked, activeTab, archiveSearch, archiveMediaType, archivePage, archivePageSize, analyticsRecentPage, activityDays]);

  const containerClass = isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100';
  const cardClass = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800';
  const inputClass = isLight ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500';
  const btnPrimaryClass = 'bg-blue-600 hover:bg-blue-500 text-white font-semibold';
  const btnSecondaryClass = isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200';
  const dimTextClass = isLight ? 'text-slate-500' : 'text-slate-400';

  if (!user || user.role !== 'admin' || isPanelLocked) {
    return (
      <AdminLoginScreen
        onLogin={handleLoginFromScreen}
        onVisitPortfolio={() => {
          if (windowId) minimizeWindow(windowId);
          openApp('about');
        }}
        onMinimize={() => windowId && minimizeWindow(windowId)}
        onMaximize={() => windowId && maximizeWindow(windowId)}
        onClose={() => (windowId ? closeWindow(windowId) : (window.location.hash = ''))}
        theme={isLight ? 'light' : 'dark'}
        onToggleTheme={() => updateSettings({ theme: isLight ? 'dark' : 'light' })}
      />
    );
  }

  return (
    <AdminPanelLayout
      activeTab={activeTab}
      theme={adminTheme}
      onToggleTheme={toggleAdminTheme}
      setActiveTab={(t) => setActiveTab(t as AdminTab)}
      user={user}
      onLogout={handleLogout}
      onSaveDraft={() => window.dispatchEvent(new Event('admin-save-content-draft'))}
      onDiscardUnsavedChanges={() => window.dispatchEvent(new Event('admin-discard-unsaved-edits'))}
      canSaveDraft={draftDirty || projectFormDirty || projectsDirty}
      canPublishDraft={Boolean(hasUnpublishedDraft && !draftDirty && !projectFormDirty && !projectsDirty)}
      onRefreshData={refreshAll}
    >
      {/* Notifications */}
      {error && <div role="alert" className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs">{error}</div>}
      {successMsg && <div role="status" aria-live="polite" className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs">{successMsg}</div>}
      
      {/* Content */}
      <div className="w-full min-w-0 space-y-6">
        {activeTab === 'dashboard' && loading && !dashboardData && (
            <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Loading dashboard data...</div>
        )}
        {activeTab === 'dashboard' && !loading && !dashboardData && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                <p>Dashboard data is unavailable.</p>
                <button type="button" onClick={() => void fetchDashboard()} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">Retry</button>
            </div>
        )}
        {activeTab === 'dashboard' && dashboardData && dashboardData.metrics && (
          <div className={`admin-overview mx-auto max-w-[1500px] space-y-6 text-slate-900 ${adminTheme === 'dark' ? 'admin-overview-dark' : ''}`}>
            <section className="admin-overview-welcome relative overflow-hidden rounded-[22px] bg-gradient-to-r from-cyan-700 via-sky-600 to-cyan-400 p-4 text-white shadow-xl shadow-blue-900/10 sm:rounded-[24px] sm:p-5">
              <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border-[24px] border-white/10" />
              <div className="pointer-events-none absolute -bottom-16 right-[18%] h-36 w-36 rounded-full border border-white/10 bg-cyan-200/10" />
              <div className="relative flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/10"><Sparkles size={15} /></span>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-cyan-50">Your digital presence</p>
                  <h3 className="mt-1.5 text-[clamp(1.25rem,2.4vw,1.625rem)] font-semibold leading-tight tracking-tight">Make your next opportunity happen.</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-cyan-50 sm:text-sm">Keep your story current, then preview and publish it when you are ready.</p>
                </div>
                <button type="button" onClick={() => setActiveTab('portfolio')} className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-bold text-sky-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white/80 sm:w-auto sm:text-sm">
                  <Edit size={15} /> Edit portfolio
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4 sm:gap-4">
              {[
                { label: 'Unique visitors', value: analyticsData?.summary?.uniqueVisitors, icon: Users, tint: 'bg-sky-500/10 text-sky-500', note: 'All recorded visitors' },
                { label: 'Page views', value: analyticsData?.summary?.pageViews, icon: Globe, tint: 'bg-violet-500/10 text-violet-500', note: 'Portfolio page visits' },
                { label: 'Project interest', value: analyticsData?.summary?.projectClicks, icon: Activity, tint: 'bg-orange-500/10 text-orange-500', note: 'Project link clicks' },
                { label: 'Unread messages', value: analyticsData?.summary?.unreadLeads, icon: MessageSquare, tint: 'bg-emerald-500/10 text-emerald-500', note: 'Waiting in your inbox' },
              ].map((stat) => (
                <article key={stat.label} className="admin-overview-card relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                  <div className="pointer-events-none absolute -bottom-9 -right-5 h-24 w-24 rounded-full opacity-60" style={{ backgroundColor: stat.label === 'Unique visitors' ? 'rgb(14 165 233 / .1)' : stat.label === 'Page views' ? 'rgb(139 92 246 / .1)' : stat.label === 'Project interest' ? 'rgb(249 115 22 / .1)' : 'rgb(16 185 129 / .1)' }} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-xs font-semibold text-slate-500 sm:text-sm">{stat.label}</p><p className="mt-3 text-3xl font-medium tracking-tight text-slate-900">{stat.value ?? '—'}</p></div>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${stat.tint}`}><stat.icon size={17} /></span>
                  </div>
                  <p className="relative mt-1 text-[11px] text-slate-400 sm:text-xs">{stat.note}</p>
                </article>
              ))}
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.9fr)] xl:gap-5">
              <div className="min-w-0">
                {analyticsError && <div role="alert" className="mb-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">{analyticsError} <button type="button" onClick={() => void fetchAnalytics()} className="ml-1 font-semibold underline">Retry</button></div>}
                {analyticsData ? <AdminDashboardChart activity={analyticsData.dailyActivity || []} theme={adminTheme} activityDays={activityDays} onActivityDaysChange={setActivityDays} onRefresh={fetchAnalytics} /> : <div role="status" className="admin-overview-card rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{analyticsLoading ? 'Loading live activity…' : 'Analytics data is unavailable. Use refresh to retry.'}</div>}
              </div>
              <section className="admin-overview-card min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-base font-bold text-slate-950">Portfolio checklist</h3><p className="mt-1 text-xs text-slate-500">A quick pulse on your public profile</p></div>
                </div>
                <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
                  <div className="flex min-h-11 items-center gap-2 py-2 text-xs">
                    <span className="text-emerald-600"><UserCheck size={14} /></span><span className="min-w-0 flex-1 text-slate-600">Portfolio profile</span><strong className="text-right text-[11px] font-medium text-slate-700">Ready</strong>
                  </div>
                  <div className="flex min-h-11 items-center gap-2 py-2 text-xs">
                    <span className="text-emerald-600"><FolderKanban size={14} /></span><span className="min-w-0 flex-1 text-slate-600">Visible projects</span><strong className="text-right text-[11px] font-medium text-slate-700">{publishedProjects.filter((project) => project.visible !== false).length}</strong>
                  </div>
                  <div className="flex min-h-11 items-center gap-2 py-2 text-xs">
                    <span className="text-emerald-600"><Cloud size={14} /></span><span className="min-w-0 flex-1 text-slate-600">Published version</span><strong className="text-right text-[11px] font-medium text-slate-700">{hasUnpublishedDraft === null ? 'Checking…' : hasUnpublishedDraft ? 'Draft changes' : 'Live'}</strong>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveTab('publishing')} className="mt-4 inline-flex min-h-10 items-center gap-2 text-[11px] font-bold text-sky-700 hover:text-sky-900">Review publish history <ArrowUpRight size={14} /></button>
              </section>
            </div>
          </div>
        )}
        {activeTab === 'users' && (
            <UserManagement users={usersList} currentUserId={user.id} onCreate={handleCreateUser} onDelete={handleDeleteUser} onEnable={handleEnableUser} />
        )}
        <div className={['portfolio', 'appearance', 'seo'].includes(activeTab) ? 'block' : 'hidden'}>
          <PortfolioManagement
            initialSection="profile"
            requestedSection={activeTab === 'appearance' || activeTab === 'seo' ? activeTab : activeTab === 'portfolio' ? 'profile' : undefined}
            onDraftChange={reportDraftDirty}
            onSaveSuccess={() => { fetchProjects(); void markCurrentDraftAsSaved(); }}
          />
        </div>
        {activeTab === 'media' && <MediaManagement apiFetch={apiFetch} onDraftChange={reportDraftDirty} onSaved={markCurrentDraftAsSaved} />}
        {activeTab === 'advanced' && <AdvancedContentManagement apiFetch={apiFetch} onDraftChange={reportDraftDirty} onSaved={markCurrentDraftAsSaved} />}
        <div className={activeTab === 'projects' ? 'block' : 'hidden'}>
          <ProjectManagement projects={projects} loading={projectsLoading} onSave={handleSaveProject} onToggleVisibility={handleToggleProjectVisibility} onDelete={handleDeleteProject} onUploadMedia={(file) => uploadPortfolioMedia(file, 'project')} onReorder={handleReorderProjects} onDraftChange={reportProjectFormDirty} />
        </div>
        {activeTab === 'contacts' && (
            <ContactManagement contacts={contactsList} loading={contactsLoading} onRefresh={fetchContacts} onReply={handleReplyToContact} onDelete={handleDeleteContact} />
        )}
        {activeTab === 'archives' && (
            <CameraArchive archives={archivesList} listRef={archiveListRef} page={archivePage} pageSize={archivePageSize} totalItems={archiveTotal} onPageChange={setArchivePage} onDelete={handleDeleteArchive} onDownload={handleDownloadArchive} />
        )}
        {activeTab === 'analytics' && (
            <AnalyticsDashboard data={analyticsData} theme={adminTheme} activityDays={activityDays} onActivityDaysChange={setActivityDays} onRefresh={fetchAnalytics} onRecentPageChange={setAnalyticsRecentPage} onReset={async () => {
              const response = await apiFetch('/api/analytics/reset', { method: 'DELETE' });
              const result = await response.json();
              if (!response.ok || !result.success) throw new Error(result.error || 'Analytics could not be reset.');
              setSuccessMsg(`Analytics reset. ${result.deletedCount} events removed.`);
              await fetchAnalytics(1);
            }} />
        )}
        {activeTab === 'publishing' && (
          <PublishingManagement apiFetch={apiFetch} canPublish={Boolean(hasUnpublishedDraft && !draftDirty && !projectsDirty)} onSuccess={(message) => setSuccessMsg(message)} onError={(message) => setError(message)} onStatusChange={(hasChanges) => { setHasUnpublishedDraft(hasChanges); if (!hasChanges) setDraftSavedAfterChanges(false); }} />
        )}
        {activeTab === 'security' && (
          <SecurityManagement
            onPolicyChange={setSessionPolicy}
            health={systemHealth}
            healthError={healthError}
            healthLoading={healthLoading}
            onRefreshHealth={() => void fetchSystemHealth()}
            onLogout={handleLogout}
            adminEmail={user.email}
          />
        )}
        {activeTab === 'backup' && (
            <section className="admin-content-card w-full max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><HardDrive size={19} /></span>
                    <div><h2 className="text-base font-bold text-slate-900">Backup files</h2><p className="mt-1 text-xs text-slate-500">Download the latest backup or restore a JSON file.</p></div>
                </div>
                
                {backupStatus?.latest ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Latest backup</div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              {backupStatus.latest.type === 'full-portfolio-assets' ? 'Full portfolio & media backup' : 'Portfolio content backup'}
                            </span>
                            <time dateTime={backupStatus.latest.timestamp} className="text-xs text-slate-500">
                              {formatBackupDateTime(backupStatus.latest.timestamp)}
                            </time>
                        </div>
                        <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{backupStatus.latest.fileName}</p>
                    </div>
                ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">No backup has been created yet.</p>
                )}

                <div className="flex flex-wrap gap-2.5 border-t border-slate-100 pt-4">
                    <button
                        onClick={() => void handleRunBackup()}
                        disabled={isBackingUp || isRestoringBackup}
                        className="admin-action-button inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isBackingUp ? <RefreshCw className="animate-spin" size={16} /> : <HardDrive size={16} />}
                        {isBackingUp ? 'Creating backup…' : 'Create full backup'}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleDownloadBackup()}
                        disabled={!backupStatus?.latest || isRestoringBackup}
                        className="admin-action-button inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Download size={16} /> Download latest
                    </button>
                    <button
                        type="button"
                        onClick={() => backupFileInput.current?.click()}
                        disabled={isRestoringBackup || isBackingUp}
                        className="admin-action-button inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <UploadCloud size={16} /> {isRestoringBackup ? 'Restoring…' : 'Restore Backup'}
                    </button>
                    <input
                        ref={backupFileInput}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(event) => void handleRestoreBackup(event.target.files?.[0])}
                    />
                </div>

            </section>
        )}
      </div>
    </AdminPanelLayout>
  );
};
