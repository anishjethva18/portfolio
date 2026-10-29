import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, CirclePlus, Clock3, FileText, Globe, History, RefreshCw, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { useConfirmDialog } from '../../../context/ConfirmDialogContext';
import { formatAdminDateTime } from '../../../utils/dateTime';
import { getContentState, getProjectChangeEntries, getProjectState, ProjectDraftChange } from '../../../utils/adminDraftStatus';
import { AdminPagination } from '../AdminPagination';
import { useResponsivePageSize } from '../../../hooks/useResponsivePageSize';

interface Snapshot {
  draft?: unknown;
  published?: unknown;
  draftUpdatedAt?: string | null;
  publishedAt?: string | null;
  isPublished?: boolean;
}

interface Revision {
  id: string;
  isCurrent?: boolean;
  publishedAt: string;
  publishedBy: string;
  profileName: string;
  profileTitle: string;
  sectionCounts: { skills: number; experiences: number; education: number };
  changes: string[];
  snapshotDetails?: string[];
}

interface PublishingManagementProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  active?: boolean;
  canPublish?: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onStatusChange?: (hasUnpublishedChanges: boolean) => void;
}

class PublishingRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'PublishingRequestError';
  }
}

type PublishingApiResponse = Record<string, unknown> & {
  success: true;
  draft?: unknown;
  published?: unknown;
  draftUpdatedAt?: string | null;
  publishedAt?: string | null;
  isPublished?: boolean;
  revisions?: unknown;
};

const changeSections: Record<string, string> = {
  profile: 'Profile & About', socials: 'Contact & Social', skills: 'Skills & Toolkit', experiences: 'Work Experience', education: 'Education',
  certifications: 'Certifications', capabilities: 'Capabilities', resumes: 'Resume files', siteSettings: 'Site & Appearance',
};
const changeFields: Record<string, string> = {
  name: 'Name', title: 'Title', tagline: 'Tagline', bio: 'Biography', avatar: 'Portrait', hiringStatus: 'Hiring status',
  email: 'Email', phone: 'Phone', location: 'Location', github: 'GitHub', linkedin: 'LinkedIn', instagram: 'Instagram',
  twitter: 'X / Twitter', socialLinks: 'Additional links', goals: 'Focus areas', defaultTheme: 'Default theme', defaultWallpaper: 'Default wallpaper',
  defaultWallpaperUrl: 'Uploaded wallpaper', defaultIconTheme: 'Icon theme', defaultAccentColor: 'Accent color',
  emailFaviconEnabled: 'Email favicon in emails', socialImageUrl: 'Social sharing image', faviconUrl: 'Website favicon',
  siteName: 'Site name', siteTitle: 'Page title', metaDescription: 'Meta description',
  portfolioVersion: 'Portfolio version',
  sortOrder: 'Display order',
  openGraphTitle: 'Open Graph title', openGraphDescription: 'Open Graph description',
  canonicalUrl: 'Canonical URL', twitterCard: 'Twitter/X card type',
  twitterTitle: 'Twitter/X title', twitterDescription: 'Twitter/X description',
  maintenanceMode: 'Maintenance mode',
  desktopShortcuts: 'Apps & shortcuts', taskbarPinnedApps: 'Taskbar pins', startPinnedApps: 'Start menu pins',
  adminAppEnabledInStart: 'Admin Start menu visibility', disabledApps: 'Available apps',
  role: 'Role', company: 'Company', period: 'Period', description: 'Description', institution: 'Institution',
  provider: 'Provider', active: 'Availability', file: 'PDF file', visible: 'Visibility',
};

const legacyDesktopShortcuts = [
  { appId: 'explorer', name: 'This PC', icon: 'ThisPC', position: { gridX: 0, gridY: 0 }, type: 'app' },
  { appId: 'about', name: 'About Me', icon: 'About', position: { gridX: 0, gridY: 1 }, type: 'app' },
  { appId: 'projects', name: 'Projects', icon: 'Projects', position: { gridX: 0, gridY: 2 }, type: 'app' },
  { appId: 'resume', name: 'Resume CV', icon: 'Resume', position: { gridX: 1, gridY: 0 }, type: 'app' },
  { appId: 'contact', name: 'Contact Me', icon: 'Contact', position: { gridX: 1, gridY: 1 }, type: 'app' },
  { appId: 'terminal', name: 'Terminal', icon: 'Terminal', position: { gridX: 1, gridY: 2 }, type: 'app' },
  { appId: 'browser', name: 'Web Browser', icon: 'Globe', position: { gridX: 1, gridY: 3 }, type: 'app' },
  { appId: 'settings', name: 'Settings', icon: 'Settings', position: { gridX: 2, gridY: 0 }, type: 'app' },
  { appId: 'recycle', name: 'Recycle Bin', icon: 'Recycle', position: { gridX: 2, gridY: 1 }, type: 'app' },
  { appId: 'calculator', name: 'Calculator', icon: 'Calculator', position: { gridX: 2, gridY: 2 }, type: 'app' },
  { appId: 'camera', name: 'Camera', icon: 'Camera', position: { gridX: 2, gridY: 3 }, type: 'app' },
  { appId: 'photos', name: 'Media', icon: 'Media', position: { gridX: 3, gridY: 0 }, type: 'app' },
  { appId: 'minesweeper', name: 'Minesweeper', icon: 'Minesweeper', position: { gridX: 3, gridY: 1 }, type: 'app' },
  { appId: 'snake', name: 'Retro Snake', icon: 'Snake', position: { gridX: 3, gridY: 2 }, type: 'app' },
];
const legacyTaskbarPins = ['explorer', 'browser', 'terminal', 'about', 'projects', 'settings'];
const legacyStartPins = [
  'about', 'projects', 'resume', 'contact', 'explorer', 'terminal', 'browser',
  'notepad', 'settings', 'taskmanager', 'minesweeper', 'snake', 'calculator',
];

const normalizeLegacyLayoutForDiff = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const content = value as Record<string, unknown>;
  const siteSettings = content.siteSettings;
  if (!siteSettings || typeof siteSettings !== 'object' || Array.isArray(siteSettings)) return value;
  const settings = siteSettings as Record<string, unknown>;
  return {
    ...content,
    siteSettings: {
      ...settings,
      desktopShortcuts: settings.desktopShortcuts ?? legacyDesktopShortcuts,
      taskbarPinnedApps: settings.taskbarPinnedApps ?? legacyTaskbarPins,
      startPinnedApps: settings.startPinnedApps ?? legacyStartPins,
      adminAppEnabledInStart: settings.adminAppEnabledInStart ?? false,
    },
  };
};

type ContentPathPart = string | { arrayKey: string };
interface ContentDraftChange {
  label: string;
  path: ContentPathPart[];
  action: 'value' | 'replace-array' | 'array-item';
  itemKey?: string;
  hasPublishedItem?: boolean;
  publishedItem?: unknown;
  publishedIndex?: number;
}

const getArrayItemKey = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return `value:${String(value)}`;
  const item = value as Record<string, unknown>;
  const key = item.appId ?? item.id ?? item._id ?? item.title ?? item.name ?? item.role ?? item.degree ?? item.label;
  return `${typeof key}:${String(key)}`;
};

const getAtContentPath = (root: any, path: ContentPathPart[]): any => path.reduce((value, part) => {
  if (typeof part === 'string') return value?.[part];
  if (!Array.isArray(value)) return undefined;
  return value.find((item) => getArrayItemKey(item) === part.arrayKey);
}, root);

const setAtContentPath = (root: any, path: ContentPathPart[], value: unknown, remove = false) => {
  if (!path.length) throw new Error('The saved content change could not be identified.');
  const parent = getAtContentPath(root, path.slice(0, -1));
  const last = path[path.length - 1];
  if (typeof last === 'string') {
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) throw new Error('The saved content field no longer exists.');
    if (remove) delete parent[last];
    else parent[last] = value;
    return;
  }
  if (!Array.isArray(parent)) throw new Error('The saved content item no longer exists.');
  const index = parent.findIndex((item) => getArrayItemKey(item) === last.arrayKey);
  if (index < 0) throw new Error('The saved content item no longer exists.');
  if (remove) parent.splice(index, 1);
  else parent[index] = value;
};

function getContentChangeEntries(before: unknown, after: unknown): ContentDraftChange[] {
  const changes = new Map<string, ContentDraftChange>();
  const addChange = (change: ContentDraftChange) => {
    changes.set(`${change.label}:${JSON.stringify(change.path)}:${change.action}:${change.itemKey || ''}`, change);
  };
  const normalize = (value: any): any => typeof value === 'string'
    ? value.trim()
    : Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]))
      : value;
  const formatPath = (path: string[]) => {
    const [root, ...rest] = path;
    const parts = rest.map((part, index) => /^\d+$/.test(part)
      ? `Item ${Number(part) + 1}`
      : root === 'profile' && part === 'title' ? 'Headline' : changeFields[part] || part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()));
    return [changeSections[root] || root.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()), ...parts].join(' · ');
  };
  const getArrayItemLabel = (value: unknown, index: number) => {
    if (!value || typeof value !== 'object') return String(value ?? `Item ${index + 1}`);
    const item = value as Record<string, unknown>;
    return String(item.name || item.title || item.role || item.degree || item.label || item.appId || `Item ${index + 1}`);
  };
  const getArrayItemKey = (value: unknown) => {
    if (value === null || typeof value !== 'object') return `value:${String(value)}`;
    const item = value as Record<string, unknown>;
    const key = item.appId ?? item.id ?? item._id ?? item.title ?? item.name ?? item.role ?? item.degree ?? item.label;
    return typeof key === 'string' || typeof key === 'number' ? `${typeof key}:${key}` : null;
  };
  const visit = (oldValue: any, newValue: any, path: ContentPathPart[], labelPath: string[]) => {
    if (JSON.stringify(normalize(oldValue)) === JSON.stringify(normalize(newValue))) return;
    if (labelPath[0] === 'securitySettings' || labelPath.some((key) =>
      /password|secret|token|hash|credential|api[_-]?key|adminpin/i.test(key) ||
      ['id', '_id', '__v', 'createdAt', 'updatedAt', 'sortOrder'].includes(key)
    )) return;
    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
      const oldItems = Array.isArray(oldValue) ? oldValue : [];
      const newItems = Array.isArray(newValue) ? newValue : [];
      const oldKeys = oldItems.map(getArrayItemKey);
      const newKeys = newItems.map(getArrayItemKey);
      const canMatchByKey = oldKeys.every((key): key is string => key !== null) &&
        newKeys.every((key): key is string => key !== null) &&
        new Set(oldKeys).size === oldKeys.length &&
        new Set(newKeys).size === newKeys.length;
      if (canMatchByKey) {
        const oldByKey = new Map(oldItems.map((item, index) => [oldKeys[index], { item, index }]));
        const newByKey = new Map(newItems.map((item, index) => [newKeys[index], { item, index }]));
        for (const [key, oldEntry] of oldByKey) {
          const newEntry = newByKey.get(key);
          if (!newEntry) {
            addChange({
              label: `${formatPath(labelPath)} · ${getArrayItemLabel(oldEntry.item, oldEntry.index)} · Removed`,
              path,
              action: 'array-item',
              itemKey: key,
              hasPublishedItem: true,
              publishedItem: oldEntry.item,
              publishedIndex: oldEntry.index,
            });
          } else {
            visit(
              oldEntry.item,
              newEntry.item,
              [...path, { arrayKey: key }],
              [...labelPath, getArrayItemLabel(newEntry.item, newEntry.index)],
            );
          }
        }
        for (const [key, newEntry] of newByKey) {
          if (!oldByKey.has(key)) {
            addChange({
              label: `${formatPath(labelPath)} · ${getArrayItemLabel(newEntry.item, newEntry.index)} · Added`,
              path,
              action: 'array-item',
              itemKey: key,
              hasPublishedItem: false,
            });
          }
        }
        if (oldKeys.length === newKeys.length && oldKeys.some((key, index) => key !== newKeys[index])) {
          addChange({ label: `${formatPath(labelPath)} · Display order`, path, action: 'replace-array' });
        }
        return;
      }
      addChange({ label: formatPath(labelPath), path, action: 'replace-array' });
      return;
    }
    if (oldValue && newValue && typeof oldValue === 'object' && typeof newValue === 'object') {
      for (const key of new Set([...Object.keys(oldValue), ...Object.keys(newValue)])) {
        visit(oldValue[key], newValue[key], [...path, key], [...labelPath, key]);
      }
      return;
    }
    if (typeof oldValue === 'boolean' && typeof newValue === 'boolean') {
      const field = labelPath[labelPath.length - 1];
      const describe = (value: boolean) => field === 'visible'
        ? value ? 'Visible' : 'Hidden'
        : field === 'active'
          ? value ? 'Active' : 'Inactive'
          : field === 'maintenanceMode'
            ? value ? 'On' : 'Off'
            : value ? 'Enabled' : 'Disabled';
      addChange({ label: `${formatPath(labelPath)}: ${describe(oldValue)} → ${describe(newValue)}`, path, action: 'value' });
      return;
    }
    addChange({ label: formatPath(labelPath), path, action: 'value' });
  };
  visit(normalizeLegacyLayoutForDiff(before), normalizeLegacyLayoutForDiff(after), [], []);
  return [...changes.values()];
}

export const PublishingManagement: React.FC<PublishingManagementProps> = ({ apiFetch, active = true, canPublish = false, onSuccess, onError, onStatusChange }) => {
  const confirm = useConfirmDialog();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [projectsMatch, setProjectsMatch] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedChanges, setExpandedChanges] = useState<Record<string, boolean>>({});
  const [showDraftChanges, setShowDraftChanges] = useState(false);
  const [projectDraftChanges, setProjectDraftChanges] = useState<ProjectDraftChange[]>([]);
  const [revertingChangeId, setRevertingChangeId] = useState<string | null>(null);
  const [revisionPage, setRevisionPage] = useState(1);
  const revisionListRef = useRef<HTMLOListElement>(null);
  const revisionPageSize = useResponsivePageSize(5, 180, revisionListRef);

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await apiFetch(`/api/admin/content-studio${path}`, options);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (!response.ok) {
        throw new PublishingRequestError(response.statusText || 'Publishing data could not be loaded.', response.status);
      }
      throw error;
    }
    const data = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    if (!response.ok || data.success !== true) {
      throw new PublishingRequestError(
        typeof data.error === 'string' ? data.error : 'Publishing data could not be loaded.',
        response.status,
      );
    }
    return { ...data, success: true } as PublishingApiResponse;
  }, [apiFetch]);

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setLoadError(null);
    try {
      const [state, revisionData, draftProjectsResponse] = await Promise.all([
        request('', { cache: 'no-store' }),
        request('/revisions', { cache: 'no-store' }),
        apiFetch('/api/admin/projects', { cache: 'no-store' }),
      ]);
      const draftProjects = await draftProjectsResponse.json();
      if (!draftProjectsResponse.ok || !draftProjects.success || !Array.isArray(draftProjects.projects)) throw new Error(draftProjects.error || 'Staged projects could not be loaded.');
      const liveProjects = Array.isArray(draftProjects.publishedProjects)
        ? draftProjects.publishedProjects
        : await apiFetch('/api/projects', { cache: 'no-store' }).then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.projects)) throw new Error(data.error || 'Published projects could not be loaded.');
            return data.projects;
          });
      setSnapshot(state);
      setProjectDraftChanges(getProjectChangeEntries(draftProjects.projects, liveProjects));
      if (!Array.isArray(revisionData.revisions)) throw new Error('Version history response is invalid.');
      setRevisions(revisionData.revisions);
      setProjectsMatch(getProjectState(draftProjects.projects) === getProjectState(liveProjects));
      return true;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Publishing data could not be loaded.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);
  const hasUnpublishedChanges = Boolean(
    snapshot &&
      (getContentState(snapshot.draft) !== getContentState(snapshot.published) || projectsMatch === false),
  );
  const contentDraftChanges = snapshot ? getContentChangeEntries(snapshot.published, snapshot.draft) : [];
  const draftChanges = [
    ...contentDraftChanges.map((change) => ({ ...change, scope: 'content' as const, id: `content:${change.label}:${JSON.stringify(change.path)}` })),
    ...projectDraftChanges.map((change) => ({ ...change, scope: 'project' as const, id: `project:${change.projectId || ''}:${change.action}:${change.field || ''}` })),
  ];
  const revisionPageCount = Math.max(1, Math.ceil(revisions.length / revisionPageSize));
  const currentRevisionPage = Math.min(revisionPage, revisionPageCount);
  const visibleRevisions = revisions.slice((currentRevisionPage - 1) * revisionPageSize, currentRevisionPage * revisionPageSize);
  useEffect(() => {
    setRevisionPage((current) => Math.min(current, revisionPageCount));
  }, [revisionPageCount, revisionPageSize]);
  useEffect(() => {
    if (snapshot && projectsMatch !== null) onStatusChange?.(hasUnpublishedChanges);
  }, [hasUnpublishedChanges, onStatusChange, projectsMatch, snapshot]);

  const revertDraftChange = async (change: (typeof draftChanges)[number]) => {
    setRevertingChangeId(change.id);
    try {
      if (change.scope === 'content') {
        if (!snapshot) throw new Error('Draft content is not loaded.');
        const nextDraft = JSON.parse(JSON.stringify(snapshot.draft));
        const publishedValue = getAtContentPath(snapshot.published, change.path);
        if (change.action === 'array-item') {
          let targetArray = getAtContentPath(nextDraft, change.path);
          if (!Array.isArray(targetArray) && change.hasPublishedItem) {
            setAtContentPath(nextDraft, change.path, []);
            targetArray = getAtContentPath(nextDraft, change.path);
          }
          if (!Array.isArray(targetArray) || !change.itemKey) {
            throw new Error('The saved draft list changed. Refresh and retry this action.');
          }
          const existingIndex = targetArray.findIndex((item) => getArrayItemKey(item) === change.itemKey);
          if (change.hasPublishedItem) {
            const restored = JSON.parse(JSON.stringify(change.publishedItem));
            if (existingIndex >= 0) targetArray[existingIndex] = restored;
            else targetArray.splice(Math.min(change.publishedIndex ?? targetArray.length, targetArray.length), 0, restored);
          } else if (existingIndex >= 0) {
            targetArray.splice(existingIndex, 1);
          }
        } else {
          setAtContentPath(nextDraft, change.path, publishedValue, publishedValue === undefined);
        }
        const updated = await request('/draft', {
          method: 'PUT',
          body: JSON.stringify({ content: nextDraft }),
        });
        setSnapshot(updated);
      } else {
        const response = await apiFetch('/api/admin/projects/revert-change', {
          method: 'POST',
          body: JSON.stringify({
            action: change.action,
            projectId: change.projectId,
            field: change.field,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'The selected project change could not be removed from the draft.');
        }
      }

      if (change.scope === 'project' && !await load()) {
        throw new Error('The change was reverted, but draft status could not be reloaded. Refresh to verify before publishing.');
      }
      onSuccess(`Removed this change from the saved draft: ${change.label}`);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The selected change could not be removed from the draft.');
    } finally {
      setRevertingChangeId(null);
    }
  };

  const runAction = async (path: string, successMessage: string) => {
    setBusy(true);
    try {
      const result = await request(path, { method: 'POST', body: JSON.stringify({}) });
      if ((path === '/publish' || path === '/discard') && result.published) {
        window.dispatchEvent(new CustomEvent('portfolio-content-published', { detail: result.published }));
      }
      if (path === '/discard') window.dispatchEvent(new Event('portfolio-drafts-discarded'));
      onSuccess(successMessage);
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The requested publishing action failed.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!await confirm({
      title: 'Publish portfolio changes?',
      message: 'This makes the saved content and staged project changes public.',
      confirmLabel: 'Publish changes',
    })) return;
    const contentChanged = Boolean(snapshot && getContentState(snapshot.draft) !== getContentState(snapshot.published));
    const projectsChanged = projectsMatch === false;
    const successMessage = contentChanged && projectsChanged
      ? 'Portfolio content and project changes were published.'
      : projectsChanged
        ? 'Project changes were published.'
        : contentChanged
          ? 'Portfolio content changes were published.'
          : 'Portfolio is already up to date.';
    await runAction('/publish', successMessage);
  };

  const discard = async () => {
    if (!await confirm({
      title: 'Discard all draft changes?',
      message: 'Saved content and staged project changes will be restored to the currently published state.',
      confirmLabel: 'Discard drafts',
      destructive: true,
    })) return;
    await runAction('/discard', 'Draft content and staged projects were restored to the published state.');
  };

  const restoreRevision = async (revision: Revision) => {
    if (!await confirm({
      title: 'Restore this version to draft?',
      message: 'The selected version will replace the current draft. You can then publish it with Publish changes.',
      confirmLabel: 'Restore to draft',
    })) return;
    setRestoringId(revision.id);
    const startedAt = Date.now();
    try {
      const restored = await request(`/revisions/${encodeURIComponent(revision.id)}/restore`, { method: 'POST', body: JSON.stringify({}) });
      if (!restored.draft || typeof restored.draft !== 'object') {
        throw new Error('The server did not return the restored draft. The version was not confirmed.');
      }
      if (!await load()) throw new Error('The version restore was accepted, but the current draft could not be reloaded. Refresh and verify before publishing.');
      window.dispatchEvent(new Event('portfolio-draft-restored'));
      onSuccess('Version restored as the current draft. Click Publish changes to make it live.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Version could not be restored.');
    } finally {
      window.setTimeout(() => setRestoringId(null), Math.max(0, 400 - (Date.now() - startedAt)));
    }
  };

  const deleteRevision = async (revision: Revision) => {
    if (!await confirm({
      title: 'Delete this version?',
      message: 'This permanently removes the selected version from history. It can no longer be restored.',
      confirmLabel: 'Delete version',
      destructive: true,
    })) return;
    setDeletingId(revision.id);
    try {
      try {
        await request(`/revisions/${encodeURIComponent(revision.id)}`, { method: 'DELETE' });
      } catch (error) {
        // Older API deployments may only expose the POST-compatible route.
        if (!(error instanceof PublishingRequestError) || ![404, 405].includes(error.status)) throw error;
        await request(`/revisions/${encodeURIComponent(revision.id)}/delete`, { method: 'POST', body: JSON.stringify({}) });
      }
      setExpandedChanges((current) => { const next = { ...current }; delete next[revision.id]; return next; });
      setRevisions((current) => current.filter((entry) => entry.id !== revision.id));
      onSuccess('Version deleted from history.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Version could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-publishing w-full min-w-0 max-w-6xl space-y-4 pb-8">
      {loadError && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{loadError} <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Retry</button></div>}
      {loading && !snapshot && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading publishing status…</div>}

      {snapshot && (
        <section className="admin-content-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-900">Draft &amp; publish</h2><p className="mt-1 text-xs text-slate-500">Changes stay private until you explicitly publish them.</p></div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="admin-publish-version">
              <span className="admin-publish-icon"><Globe size={14} /></span>
              <div><span>Live portfolio</span><small>{snapshot.publishedAt ? `Published ${formatAdminDateTime(snapshot.publishedAt)}` : 'No published version is available yet.'}</small></div>
            </div>
            <div className="admin-publish-version">
              <span className="admin-publish-icon draft"><FileText size={14} /></span>
              <div><span>Current draft</span><small>{snapshot.draftUpdatedAt ? `Saved ${formatAdminDateTime(snapshot.draftUpdatedAt)}` : 'The draft has not been saved yet.'}</small></div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowDraftChanges(true)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-700"><FileText size={14} /> View draft changes</button>
            <button type="button" onClick={() => void discard()} disabled={busy || !hasUnpublishedChanges} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={14} /> Discard draft</button>
            <button type="button" onClick={() => void publish()} disabled={busy || !hasUnpublishedChanges || !canPublish} title={canPublish ? 'Publish the saved draft changes' : 'Save or restore a draft before publishing'} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-3.5 text-xs font-bold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"><Send size={14} /> {busy ? 'Publishing…' : 'Publish changes'}</button>
          </div>
        </section>
      )}
      <section className="admin-content-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><History size={16} /></span>
            <div><h2 className="text-base font-semibold text-slate-900">Version history</h2><p className="mt-1 text-xs text-slate-500">Review the fields changed between published versions. Restore an older version to draft or delete it from history.</p></div>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{revisions.length} {revisions.length === 1 ? 'version' : 'versions'}</span>
        </div>
        {loading && revisions.length === 0 ? (
          <div role="status" className="px-5 py-8 text-center text-xs text-slate-500">Loading version history…</div>
        ) : revisions.length === 0 ? (
          <div className="px-5 py-9 text-center">
            <History className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No published versions yet</p>
            <p className="mt-1 text-xs text-slate-500">A snapshot is created when portfolio content is published.</p>
          </div>
        ) : (
          <ol ref={revisionListRef} className="admin-publish-history-list divide-y divide-slate-100">
            {visibleRevisions.map((revision) => (
              <li key={revision.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center text-slate-400"><Clock3 size={16} /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{revision.isCurrent ? 'Current live version' : 'Published version'}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{formatAdminDateTime(revision.publishedAt)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                {revision.isCurrent ? <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700"><Check size={13} />Live now</span> : <>
                <button type="button" onClick={() => void restoreRevision(revision)} disabled={busy || Boolean(restoringId) || Boolean(deletingId)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {restoringId === revision.id ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  Restore to draft
                </button>
                <button type="button" onClick={() => void deleteRevision(revision)} disabled={busy || Boolean(restoringId) || Boolean(deletingId)} aria-label={`Delete version from ${formatAdminDateTime(revision.publishedAt)}`} title="Delete version" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {deletingId === revision.id ? <RotateCcw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
                </>}
                </div>
                </div>
                <div className="ml-11 mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{revision.changes?.length ? 'Changes in this version' : 'Version details'}</p>
                  {revision.changes?.length ? <>
                    <ul className="mt-2 space-y-1 text-[10px] text-slate-600">
                      {(expandedChanges[revision.id] ? revision.changes : revision.changes.slice(0, 3)).map((change, index) => <li key={`${revision.id}-${index}`} className="flex items-start gap-2"><span aria-hidden="true" className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: '#38bdf8' }} /><span>{change}</span></li>)}
                    </ul>
                    {revision.changes.length > 3 && <button type="button" onClick={() => setExpandedChanges((current) => ({ ...current, [revision.id]: !current[revision.id] }))} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-100">
                      {expandedChanges[revision.id] ? <ChevronUp size={13} /> : <CirclePlus size={13} />}{expandedChanges[revision.id] ? 'Show less' : `View all ${revision.changes.length - 3} more changes`}
                    </button>}
                  </> : revision.snapshotDetails?.length ? <ul className="mt-2 space-y-1 text-[10px] text-slate-600">
                    {(expandedChanges[revision.id] ? revision.snapshotDetails : revision.snapshotDetails.slice(0, 3)).map((detail, index) => <li key={`${revision.id}-snapshot-${index}`} className="flex items-start gap-2"><span aria-hidden="true" className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" /><span>{detail}</span></li>)}
                    {revision.snapshotDetails.length > 3 && <button type="button" onClick={() => setExpandedChanges((current) => ({ ...current, [revision.id]: !current[revision.id] }))} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-100">
                      {expandedChanges[revision.id] ? <ChevronUp size={13} /> : <CirclePlus size={13} />}{expandedChanges[revision.id] ? 'Show less' : `View all ${revision.snapshotDetails.length - 3} more details`}
                    </button>}
                  </ul> : <p className="mt-2 text-[10px] text-slate-500">Published {formatAdminDateTime(revision.publishedAt)}{revision.profileName ? ` · ${revision.profileName}` : ''}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="px-4 pb-4 sm:px-5">
          <AdminPagination page={currentRevisionPage} pageSize={revisionPageSize} totalItems={revisions.length} onPageChange={setRevisionPage} />
        </div>
      </section>
      {!loading && !snapshot && !loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">Publishing status is unavailable. Refresh to retry.</div>
      )}
      {showDraftChanges && <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDraftChanges(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="draft-change-title" className="admin-content-card max-h-[min(80dvh,680px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 sm:p-5"><div><h2 id="draft-change-title" className="text-base font-semibold text-slate-900">Saved draft changes</h2><p className="mt-1 text-xs text-slate-500">Remove any item to restore only that field or item to the live version.</p></div><button type="button" onClick={() => setShowDraftChanges(false)} aria-label="Close draft changes" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={15} /></button></header>
          <div className="max-h-[calc(min(80dvh,680px)-80px)] overflow-y-auto p-4 sm:p-5">{draftChanges.length ? <ul className="space-y-2">{draftChanges.map((change) => <li key={change.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-700"><span className="flex min-w-0 items-start gap-2"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={11} /></span><span className="min-w-0 break-words">{change.label}</span></span><button type="button" onClick={() => void revertDraftChange(change)} disabled={busy || Boolean(revertingChangeId)} title="Remove only this change from the saved draft" aria-label={`Remove change: ${change.label}`} className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{revertingChangeId === change.id ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}<span className="hidden sm:inline">Remove</span></button></li>)}</ul> : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-500">No saved content changes differ from the live portfolio.</p>}</div>
        </section>
      </div>}
    </div>
  );
};
