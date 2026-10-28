import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { uploadPortfolioMedia } from '../../utils/uploadPortfolioMedia';
import { mergeAdminDraft } from '../../utils/mergeAdminDraft';
import { getDefaultDesktopWallpaper } from '../../utils/siteAppearance';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { SkillBrandIcon } from '../common/SkillBrandIcon';
import { SkillCategoryIcon } from '../common/SkillCategoryIcon';
import { SkillCategoryIconPicker } from '../common/SkillCategoryIconPicker';
import { SkillIconPicker } from '../common/SkillIconPicker';
import {
  getCategoryIconIdentifier,
  getSkillIconIdentifier,
} from '../../utils/skillIcons';
import { APPS_LIST } from '../../data/portfolioData';
import { useOS } from '../../context/OSContext';
import { DesktopIconItem } from '../../types';
import { DEFAULT_ADMIN_SHORTCUT, formatAdminShortcut, getAdminShortcut, setAdminShortcut as saveAdminShortcut } from '../../utils/adminShortcut';
import {
  User,
  Globe,
  Briefcase,
  GraduationCap,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Github,
  Linkedin,
  Instagram,
  Twitter,
  Image as ImageIcon,
  Phone,
  Layers,
  Palette,
  ShieldAlert,
  Megaphone,
  ArrowUp,
  ArrowDown,
  Pencil,
  Award,
  Zap,
  IdCard,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';

interface PortfolioManagementProps {
  onSaveSuccess?: () => void;
  onDraftSaved?: (hasUnpublishedChanges: boolean) => void;
  onDraftChange?: (dirty: boolean) => void;
  initialSection?: 'profile' | 'socials' | 'skills' | 'experience' | 'education' | 'appearance' | 'seo';
  requestedSection?: 'profile' | 'appearance' | 'seo';
}

interface AdminDraftSaveDetail {
  register?: (key: string, save: () => Promise<void>) => void;
}

const clonePortfolioContent = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const APPEARANCE_APPS = [...APPS_LIST].sort((left, right) => {
  if (left.id === 'admin') return -1;
  if (right.id === 'admin') return 1;
  return left.name.localeCompare(right.name);
});

const VisibilityToggle: React.FC<{ label: string; visible: boolean; onToggle: (visible: boolean) => void }> = ({ label, visible, onToggle }) => (
  <button
    type="button"
    aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
    aria-pressed={visible}
    title={`Currently ${visible ? 'visible' : 'hidden'}. ${visible ? 'Hide' : 'Show'} ${label}.`}
    onClick={() => onToggle(!visible)}
    className={`admin-responsive-action inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${visible ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100' : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-sky-400/50 hover:bg-sky-500/15 hover:text-sky-100'}`}
  >
    {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    <span className="admin-responsive-action-label">{visible ? 'Hide' : 'Show'}</span>
  </button>
);

export const PortfolioManagement: React.FC<PortfolioManagementProps> = ({ onSaveSuccess, onDraftSaved, onDraftChange, initialSection = 'profile', requestedSection }) => {
  const confirm = useConfirmDialog();
  const {
    updateHiddenAppIds, desktopIcons,
    pinnedAppIds, startPinnedAppIds, addNotification,
    adminAppEnabledInStart,
  } = useOS();
  const [activeSection, setActiveSection] = useState<'profile' | 'socials' | 'education' | 'certifications' | 'skills' | 'experience' | 'capabilities' | 'appearance' | 'seo' | 'site'>(initialSection);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishedContent, setPublishedContent] = useState<any>(null);
  const [savedDraftContent, setSavedDraftContent] = useState<any>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingMediaField, setUploadingMediaField] = useState<'avatar' | 'resumeUrl' | 'socialImageUrl' | 'faviconUrl' | null>(null);
  const [unavailableCertificationPreviews, setUnavailableCertificationPreviews] = useState<Record<string, boolean>>({});
  const [wallpaperLocalPreviewUrl, setWallpaperLocalPreviewUrl] = useState<string | null>(null);
  const [wallpaperPreviewError, setWallpaperPreviewError] = useState(false);
  const wallpaperUploadInputRef = useRef<HTMLInputElement>(null);
  const wallpaperLocalPreviewRef = useRef<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hiringStatusOpen, setHiringStatusOpen] = useState(false);
  const [adminShortcut, setAdminShortcut] = useState(getAdminShortcut);
  const [recordingAdminShortcut, setRecordingAdminShortcut] = useState(false);
  const saveDraftActionRef = useRef<() => Promise<void>>(async () => undefined);
  const savingDraftLocallyRef = useRef(false);

  useEffect(() => {
    if (requestedSection) setActiveSection(requestedSection);
  }, [requestedSection]);

  useEffect(() => () => onDraftChange?.(false), [onDraftChange]);

  // Content state
  const [content, setContent] = useState<any>({
    profile: {
      name: 'Anish Jethva',
      title: 'Full Stack & AI Engineer',
      tagline: 'Building intelligent software, agentic systems, and joyful web operating systems.',
      bio: 'Passionate Full Stack & AI Engineer with expertise in architecting high-performance web applications, cloud systems, and generative AI interfaces.',
      avatar: '/avatar.png',
      email: 'anish.jethva2006@gmail.com',
      phone: '+91 98765 43210',
      location: 'India',
      github: 'https://github.com/anishjethva18',
      linkedin: 'https://linkedin.com/in/anishjethva/',
      instagram: 'https://instagram.com/anish_jethva18',
      twitter: 'https://twitter.com/anishjethva',
      website: 'https://anishjethva.dev',
      resumeUrl: '/downloads/resume.pdf',
      goals: [
        'Master agentic AI systems and multi-modal integration',
        'Contribute to transformative open-source developer tooling',
        'Build intuitive, joyful software that solves real human problems',
      ],
      stats: {
        publicRepos: 28,
        totalStars: 540,
        followers: 120,
        yearsExperience: 4,
        completedProjects: 18,
      },
    },
    skills: [],
    experiences: [],
    education: [],
    certifications: [],
    capabilities: [],
    siteSettings: {
      siteName: '',
      siteTitle: 'Windows 11 OS Portfolio — Anish Jethva',
      metaDescription: 'Interactive Windows 11 web operating system portfolio showcasing full-stack projects, AI agents, and interactive apps.',
      openGraphTitle: '',
      openGraphDescription: '',
      canonicalUrl: '',
      twitterCard: 'summary_large_image',
      twitterTitle: '',
      twitterDescription: '',
      portfolioVersion: '1.0.0',
      socialImageUrl: '',
      faviconUrl: '',
      emailFaviconEnabled: true,
      maintenanceMode: false,
      maintenanceMessage: 'System is currently undergoing scheduled maintenance. Please check back shortly.',
      announcementBanner: {
        enabled: false,
        message: '🚀 Available for exciting new roles and AI/Full-Stack opportunities!',
        type: 'info',
        link: '',
      },
      contactEmail: 'anish.jethva2006@gmail.com',
      defaultTheme: 'dark',
      defaultWallpaper: 'Windows11.jpg',
      defaultAccentColor: '#0078d4',
      defaultIconTheme: 'fluent_3d',
      soundEnabled: true,
      animationsEnabled: true,
      assistantEnabled: true,
    },
  });

  // New item temp states
  const [newGoalInput, setNewGoalInput] = useState('');
  const [skillDialog, setSkillDialog] = useState<'category' | 'skill' | null>(null);
  const [skillDialogCategoryId, setSkillDialogCategoryId] = useState<string | null>(null);
  const [skillDialogEdit, setSkillDialogEdit] = useState<{ categoryId: string; skillId: string } | null>(null);
  const [skillDialogName, setSkillDialogName] = useState('');
  const [skillDialogIcon, setSkillDialogIcon] = useState('');
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({});
  const isRecordExpanded = (key: string) => expandedRecords[key] === true;
  const toggleRecordExpanded = (key: string) => setExpandedRecords((current) => ({ ...current, [key]: !current[key] }));

  useEffect(() => {
    onDraftChange?.(!loading && savedDraftContent !== null && JSON.stringify(content) !== JSON.stringify(savedDraftContent));
  }, [content, loading, savedDraftContent, onDraftChange]);

  useEffect(() => {
    fetchContent();
  }, []);

  useEffect(() => {
    const handleRemotePortfolioChange = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail;
      // Uploading an asset does not change the content draft. Refetching here can
      // race with updateProfile() and replace the just-uploaded URL with old data.
      if (detail?.path === '/api/files/portfolio-media' ||
        (detail?.path === '/api/admin/content-studio/draft' && savingDraftLocallyRef.current) ||
        detail?.path === '/api/admin/content-studio/publish') return;
      void fetchContent();
    };
    window.addEventListener('portfolio-data-updated', handleRemotePortfolioChange);
    return () => window.removeEventListener('portfolio-data-updated', handleRemotePortfolioChange);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const timeout = window.setTimeout(() => setErrorMessage(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [errorMessage]);

  useEffect(() => () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  useEffect(() => () => {
    if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
  }, [resumePreviewUrl]);

  useEffect(() => () => {
    if (wallpaperLocalPreviewRef.current) URL.revokeObjectURL(wallpaperLocalPreviewRef.current);
  }, []);

  const replaceWallpaperLocalPreview = (url: string | null) => {
    if (wallpaperLocalPreviewRef.current) URL.revokeObjectURL(wallpaperLocalPreviewRef.current);
    wallpaperLocalPreviewRef.current = url;
    setWallpaperLocalPreviewUrl(url);
  };

  const fetchContent = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch('/api/admin/content-studio', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success || !data.draft) throw new Error(data.error || 'Failed to load portfolio content.');
      const draftSettings = data.draft.siteSettings || {};
      const normalizedDraft = {
        ...data.draft,
        certifications: Array.isArray(data.draft.certifications) ? data.draft.certifications : [],
        capabilities: Array.isArray(data.draft.capabilities) ? data.draft.capabilities : [],
        siteSettings: {
          ...draftSettings,
          desktopShortcuts: Array.isArray(draftSettings.desktopShortcuts)
            ? draftSettings.desktopShortcuts
            : desktopIcons.filter((icon) => icon.type === 'app'),
          taskbarPinnedApps: Array.isArray(draftSettings.taskbarPinnedApps) ? draftSettings.taskbarPinnedApps : pinnedAppIds,
          startPinnedApps: Array.isArray(draftSettings.startPinnedApps) ? draftSettings.startPinnedApps : startPinnedAppIds,
          adminAppEnabledInStart: typeof draftSettings.adminAppEnabledInStart === 'boolean'
            ? draftSettings.adminAppEnabledInStart
            : adminAppEnabledInStart,
        },
      };
      setContent(clonePortfolioContent(normalizedDraft));
      setSavedDraftContent(clonePortfolioContent(normalizedDraft));
      setPublishedContent(data.published);
      updateHiddenAppIds(data.draft.siteSettings?.disabledApps || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load portfolio content.');
    } finally {
      setLoading(false);
    }
  };

  const persistDraft = async () => {
    const currentResponse = await apiFetch('/api/admin/content-studio', { cache: 'no-store' });
    const currentData = await currentResponse.json();
    if (!currentResponse.ok || !currentData.success || !currentData.draft) {
      throw new Error(currentData.error || 'Could not load the latest portfolio draft.');
    }
    const base = savedDraftContent ?? content;
    const contentToSave = mergeAdminDraft(base, content, currentData.draft);
    savingDraftLocallyRef.current = true;
    try {
      const response = await apiFetch('/api/admin/content-studio/draft', {
        method: 'PUT',
        body: JSON.stringify({ content: contentToSave }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save portfolio content.');
      return data;
    } finally {
      savingDraftLocallyRef.current = false;
    }
  };

  const handleSaveAll = async (throwOnError = false): Promise<boolean> => {
    if (saving || loading || savedDraftContent === null) {
      if (throwOnError) throw new Error('Portfolio settings are still loading or another save is in progress. Try again shortly.');
      return false;
    }
    if (JSON.stringify(content) === JSON.stringify(savedDraftContent)) return false;
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const data = await persistDraft();
      const savedDraft = clonePortfolioContent(data.draft || content);
      setContent(savedDraft);
      setSavedDraftContent(clonePortfolioContent(savedDraft));
      setPublishedContent(data.published);
      if (typeof data.isPublished === 'boolean') onDraftSaved?.(!data.isPublished);
      setSuccessMessage('Draft saved. Publish it when you are ready to update the live portfolio.');
      onSaveSuccess?.();
      return true;
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error saving portfolio content.');
      if (throwOnError) throw err;
      return false;
    } finally {
      setSaving(false);
    }
  };
  saveDraftActionRef.current = async () => { await handleSaveAll(true); };

  useEffect(() => {
    const handleAdminSaveDraft = (event: Event) => {
      const detail = (event as CustomEvent<AdminDraftSaveDetail>).detail;
      if (detail?.register) detail.register('portfolio', () => saveDraftActionRef.current());
      else void saveDraftActionRef.current();
    };
    window.addEventListener('admin-save-content-draft', handleAdminSaveDraft);
    return () => window.removeEventListener('admin-save-content-draft', handleAdminSaveDraft);
  }, []);

  useEffect(() => {
    const handleDiscardUnsavedEdits = () => {
      if (savedDraftContent !== null) {
        setContent(clonePortfolioContent(savedDraftContent));
        updateHiddenAppIds(savedDraftContent.siteSettings?.disabledApps || []);
      } else {
        void fetchContent();
      }
      replaceWallpaperLocalPreview(null);
      setWallpaperPreviewError(false);
      setErrorMessage(null);
      setSuccessMessage(null);
    };
    window.addEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
    return () => window.removeEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
  }, [savedDraftContent, updateHiddenAppIds]);

  const handlePreviewDraft = async () => {
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
      setErrorMessage('The preview tab was blocked. Allow pop-ups for this site and try again.');
      return;
    }
    previewWindow.opener = null;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await persistDraft();
      const savedDraft = clonePortfolioContent(data.draft || content);
      setContent(savedDraft);
      setSavedDraftContent(clonePortfolioContent(savedDraft));
      setPublishedContent(data.published);
      setSuccessMessage('Draft saved. Opening the private preview.');
      previewWindow.location.replace('/admin/preview');
    } catch (err: any) {
      previewWindow.close();
      setErrorMessage(err.message || 'Draft could not be saved for preview.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = async () => {
    if (!await confirm({ title: 'Discard draft changes?', message: 'Restore the currently published portfolio content and projects as the draft?', confirmLabel: 'Discard changes', destructive: true })) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await apiFetch('/api/admin/content-studio/discard', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success || !data.draft) throw new Error(data.error || 'Draft changes could not be discarded.');
      setContent(clonePortfolioContent(data.draft));
      setSavedDraftContent(clonePortfolioContent(data.draft));
      setPublishedContent(data.published);
      updateHiddenAppIds(data.published?.siteSettings?.disabledApps || []);
      setSuccessMessage('Draft changes discarded. The published content is restored.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Draft changes could not be discarded.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!await confirm({ title: 'Publish portfolio changes?', message: 'These changes will become visible on the public portfolio.', confirmLabel: 'Publish now' })) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await persistDraft();
      const response = await apiFetch('/api/admin/content-studio/publish', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Portfolio content could not be published.');
      const savedDraft = clonePortfolioContent(data.draft || content);
      setContent(savedDraft);
      setSavedDraftContent(clonePortfolioContent(savedDraft));
      setPublishedContent(data.published);
      const liveProfile = data.published?.profile;
      if (typeof liveProfile?.avatar === 'string' && liveProfile.avatar.trim()) {
        try { localStorage.setItem('win11_default_avatar', liveProfile.avatar); } catch {}
        window.dispatchEvent(new CustomEvent('win11_profile_updated', {
          detail: { avatar: liveProfile.avatar, name: liveProfile.name, bio: liveProfile.bio },
        }));
      }
      setAvatarPreviewUrl(null);
      setAvatarFileName('');
      setResumePreviewUrl(null);
      if (typeof liveProfile?.resumeUrl === 'string' && liveProfile.resumeUrl.trim()) setResumeFileName('');
      window.dispatchEvent(new CustomEvent('portfolio-content-published', { detail: data.published }));
      setSuccessMessage('Portfolio changes are live.');
      onSaveSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Portfolio content could not be published.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMedia = async (file: File, field: 'avatar' | 'resumeUrl' | 'socialImageUrl' | 'faviconUrl') => {
    setUploadingMedia(true);
    setUploadingMediaField(field);
    setErrorMessage(null);
    setSuccessMessage(null);
    const localPreview = URL.createObjectURL(file);
    if (field === 'avatar') {
      setAvatarPreviewUrl(localPreview);
      setAvatarFileName(file.name);
    } else if (field === 'resumeUrl') {
      setResumePreviewUrl(localPreview);
      setResumeFileName(file.name);
    }
    try {
      const url = await uploadPortfolioMedia(file, field === 'resumeUrl' ? 'resume' : 'profile');
      if (field === 'socialImageUrl' || field === 'faviconUrl') updateSiteSettings(field, url);
      else updateProfile(field, url);
      if (field === 'socialImageUrl') URL.revokeObjectURL(localPreview);
      window.dispatchEvent(new CustomEvent('portfolio-media-changed'));
      setSuccessMessage(`${file.name} uploaded. Save the draft and publish to make it public.`);
    } catch (err: any) {
      if (field === 'avatar') {
        setAvatarPreviewUrl(null);
        setAvatarFileName('');
      } else if (field === 'resumeUrl') {
        setResumePreviewUrl(null);
        setResumeFileName('');
      } else {
        URL.revokeObjectURL(localPreview);
      }
      setErrorMessage(err.message || 'Portfolio media upload failed.');
    } finally {
      setUploadingMediaField(null);
      setUploadingMedia(false);
    }
  };

  const handleUploadDefaultWallpaper = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Choose an image file for the default wallpaper.');
      return;
    }
    const localPreviewUrl = URL.createObjectURL(file);
    replaceWallpaperLocalPreview(localPreviewUrl);
    setWallpaperPreviewError(false);
    setUploadingMedia(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const url = await uploadPortfolioMedia(file, 'profile');
      updateSiteSettings('defaultWallpaperUrl', url);
      setSuccessMessage(`${file.name} uploaded. Save the draft and publish to make it the visitor wallpaper.`);
      window.dispatchEvent(new CustomEvent('portfolio-media-changed'));
    } catch (err: any) {
      setErrorMessage(err.message || 'Wallpaper upload failed.');
    } finally {
      setUploadingMedia(false);
    }
  };
  const contentMatchesPublished = Boolean(
    publishedContent && JSON.stringify(content) === JSON.stringify(publishedContent)
  );
  const draftDesktopShortcuts: DesktopIconItem[] = Array.isArray(content.siteSettings?.desktopShortcuts)
    ? content.siteSettings.desktopShortcuts
    : desktopIcons.filter((icon) => icon.type === 'app');
  const draftTaskbarPinnedApps: string[] = Array.isArray(content.siteSettings?.taskbarPinnedApps)
    ? content.siteSettings.taskbarPinnedApps
    : pinnedAppIds;
  const draftStartPinnedApps: string[] = Array.isArray(content.siteSettings?.startPinnedApps)
    ? content.siteSettings.startPinnedApps
    : startPinnedAppIds;
  const draftAdminAppEnabledInStart = typeof content.siteSettings?.adminAppEnabledInStart === 'boolean'
    ? content.siteSettings.adminAppEnabledInStart
    : adminAppEnabledInStart;

  const updateProfile = (field: string, value: any) => {
    setContent((prev: any) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value,
      },
    }));
  };

  const updateArrayItem = (field: string, index: number, updates: Record<string, unknown>) => {
    setContent((prev: any) => ({
      ...prev,
      [field]: (prev[field] || []).map((item: any, itemIndex: number) =>
        itemIndex === index ? { ...item, ...updates } : item
      ),
    }));
  };

  const updateContactVisibility = (field: string, visible: boolean) => {
    setContent((prev: any) => ({
      ...prev,
      profile: {
        ...prev.profile,
        contactVisibility: {
          ...(prev.profile?.contactVisibility || {}),
          [field]: visible,
        },
      },
    }));
  };

  const updateStats = (field: string, value: any) => {
    setContent((prev: any) => ({
      ...prev,
      profile: {
        ...prev.profile,
        stats: {
          ...prev.profile.stats,
          [field]: Number(value) || 0,
        },
      },
    }));
  };

  const updateSiteSettings = (field: string, value: any) => {
    setContent((prev: any) => ({
      ...prev,
      siteSettings: {
        ...prev.siteSettings,
        [field]: value,
      },
    }));
    onDraftChange?.(true);
  };

  const toggleAppAvailability = (appId: string, enabled: boolean) => {
    const disabledApps = new Set<string>(content.siteSettings?.disabledApps || []);
    if (enabled) disabledApps.delete(appId);
    else disabledApps.add(appId);
    const nextDisabledApps = Array.from(disabledApps);
    updateSiteSettings('disabledApps', nextDisabledApps);
    updateHiddenAppIds(nextDisabledApps as any);
  };

  const updateAnnouncement = (field: string, value: any) => {
    setContent((prev: any) => ({
      ...prev,
      siteSettings: {
        ...prev.siteSettings,
        announcementBanner: {
          ...prev.siteSettings.announcementBanner,
          [field]: value,
        },
      },
    }));
  };

  // Goals operations
  const handleAddGoal = () => {
    if (!newGoalInput.trim()) return;
    setContent((prev: any) => ({
      ...prev,
      profile: {
        ...prev.profile,
        goals: [...(prev.profile.goals || []), newGoalInput.trim()],
      },
    }));
    setNewGoalInput('');
  };

  const handleRemoveGoal = (index: number) => {
    setContent((prev: any) => ({
      ...prev,
      profile: {
        ...prev.profile,
        goals: (prev.profile.goals || []).filter((_: any, i: number) => i !== index),
      },
    }));
  };

  const handleUpdateGoal = (index: number, value: string) => {
    setContent((prev: any) => ({
      ...prev,
      profile: {
        ...prev.profile,
        goals: (prev.profile.goals || []).map((goal: string, goalIndex: number) => goalIndex === index ? value : goal),
      },
    }));
  };

  // Skills operations
  const normalizeSkillLabel = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const createSkillRecordId = () => globalThis.crypto?.randomUUID?.() || `skill-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const getSkillCategoryKey = (category: any) => String(category?.id || category?._id || category?.title || '');
  const getSkillRecordKey = (skill: any) => String(skill?.id || skill?._id || normalizeSkillLabel(skill?.name || ''));
  const handleAddSkillCategory = () => {
    setSkillDialog('category');
    setSkillDialogCategoryId(null);
    setSkillDialogEdit(null);
    setSkillDialogName('');
    setSkillDialogIcon(getCategoryIconIdentifier(''));
  };

  const moveItem = (items: any[], from: number, direction: -1 | 1) => {
    const to = from + direction;
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  };

  const moveSkillCategory = (index: number, direction: -1 | 1) => setContent((prev: any) => ({
    ...prev,
    skills: moveItem(prev.skills || [], index, direction).map((category: any, order: number) => ({ ...category, order })),
  }));
  const moveSkill = (categoryIndex: number, index: number, direction: -1 | 1) => setContent((prev: any) => {
    const skills = [...(prev.skills || [])];
    skills[categoryIndex] = {
      ...skills[categoryIndex],
      skills: moveItem(skills[categoryIndex]?.skills || [], index, direction).map((skill: any, order: number) => ({ ...skill, order })),
    };
    return { ...prev, skills };
  });

  const handleAddSkillItem = (catIdx: number) => {
    setSkillDialog('skill');
    setSkillDialogCategoryId(getSkillCategoryKey(content.skills?.[catIdx]) || null);
    setSkillDialogEdit(null);
    setSkillDialogName('');
    setSkillDialogIcon('');
  };

  const handleEditSkillCategory = (category: any) => {
    setSkillDialog('category');
    setSkillDialogCategoryId(getSkillCategoryKey(category));
    setSkillDialogEdit(null);
    setSkillDialogName(category.title);
    setSkillDialogIcon(category.icon || getCategoryIconIdentifier(category.title));
  };

  const handleEditSkill = (category: any, skill: any) => {
    setSkillDialog('skill');
    setSkillDialogCategoryId(getSkillCategoryKey(category));
    setSkillDialogEdit({ categoryId: getSkillCategoryKey(category), skillId: getSkillRecordKey(skill) });
    setSkillDialogName(skill.name);
    const detectedIcon = getSkillIconIdentifier(skill.name);
    setSkillDialogIcon(
      skill.iconIdentifier?.startsWith('lucide:') && (detectedIcon.startsWith('simple:') || detectedIcon.startsWith('custom:'))
        ? detectedIcon
        : skill.iconIdentifier || detectedIcon
    );
  };

  const handleSubmitSkillDialog = (event: React.FormEvent) => {
    event.preventDefault();
    const name = skillDialogName.trim();
    const normalizedName = normalizeSkillLabel(name);
    if (!name || !normalizedName) return;

    if (skillDialog === 'category') {
      const duplicate = (content.skills || []).some((category: any) =>
        getSkillCategoryKey(category) !== skillDialogCategoryId && normalizeSkillLabel(category.title) === normalizedName);
      if (duplicate) {
        setErrorMessage(`The category "${name}" already exists. Choose another name.`);
        return;
      }
      setContent((prev: any) => {
        const categories = [...(prev.skills || [])];
        const editingIndex = skillDialogCategoryId
          ? categories.findIndex((category: any) => getSkillCategoryKey(category) === skillDialogCategoryId)
          : -1;
        if (categories.some((category: any, index: number) => index !== editingIndex && normalizeSkillLabel(category.title) === normalizedName)) return prev;
        if (editingIndex >= 0) {
          categories[editingIndex] = {
            ...categories[editingIndex],
            id: categories[editingIndex].id || categories[editingIndex]._id || createSkillRecordId(),
            title: name,
            normalizedName,
            icon: skillDialogIcon || getCategoryIconIdentifier(name),
            updatedAt: new Date().toISOString(),
          };
        } else {
          const id = createSkillRecordId();
          categories.push({
            id,
            title: name,
            normalizedName,
            icon: skillDialogIcon || getCategoryIconIdentifier(name),
            iconImage: '',
            order: categories.length,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            skills: [],
          });
        }
        return { ...prev, skills: categories };
      });
    } else if (skillDialog === 'skill' && skillDialogCategoryId) {
      const editSkillId = skillDialogEdit?.skillId;
      const duplicateSkill = (content.skills || []).some((category: any) =>
        category.skills?.some((skill: any) => getSkillRecordKey(skill) !== editSkillId && normalizeSkillLabel(skill.name) === normalizedName));
      if (duplicateSkill) {
        setErrorMessage(`The skill "${name}" already exists. Choose another name or edit the existing skill.`);
        return;
      }
      setContent((prev: any) => {
        const categories = [...(prev.skills || [])];
        const targetIndex = categories.findIndex((category: any) => getSkillCategoryKey(category) === skillDialogCategoryId);
        if (targetIndex < 0) return prev;
        const existing = skillDialogEdit
          ? categories.find((category: any) => getSkillCategoryKey(category) === skillDialogEdit.categoryId)?.skills?.find((skill: any) => getSkillRecordKey(skill) === skillDialogEdit.skillId)
          : null;
        const existingSkillKey = getSkillRecordKey(existing);
        const duplicate = categories.some((category: any) =>
          category.skills?.some((skill: any) => getSkillRecordKey(skill) !== existingSkillKey && normalizeSkillLabel(skill.name) === normalizedName));
        if (duplicate) return prev;

        if (existing) {
          const sourceIndex = categories.findIndex((category: any) => getSkillCategoryKey(category) === skillDialogEdit?.categoryId);
          if (sourceIndex >= 0 && sourceIndex !== targetIndex) {
            categories[sourceIndex] = {
              ...categories[sourceIndex],
              skills: categories[sourceIndex].skills
                .filter((skill: any) => getSkillRecordKey(skill) !== getSkillRecordKey(existing))
                .map((item: any, order: number) => ({ ...item, order })),
            };
          }
        }

        const target = categories.find((category: any) => getSkillCategoryKey(category) === skillDialogCategoryId);
        if (!target) return prev;
        const targetId = target.id || target._id || createSkillRecordId();
        const skill = {
          ...(existing || {}),
          id: existing?.id || existing?._id || createSkillRecordId(),
          name,
          normalizedName,
          categoryId: targetId,
          iconIdentifier: skillDialogIcon || getSkillIconIdentifier(name),
          order: existing && categories.findIndex((category: any) => getSkillCategoryKey(category) === skillDialogEdit?.categoryId) === targetIndex
            ? existing.order
            : (target.skills || []).length,
          active: existing?.active ?? true,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        categories[targetIndex] = {
          ...categories[targetIndex],
          id: targetId,
          skills: existing && categories.findIndex((category: any) => getSkillCategoryKey(category) === skillDialogEdit?.categoryId) === targetIndex
            ? categories[targetIndex].skills.map((item: any) => getSkillRecordKey(item) === existingSkillKey ? skill : item)
            : [...(categories[targetIndex].skills || []), skill],
        };
        return { ...prev, skills: categories };
      });
    }
    setErrorMessage(null);
    setSkillDialog(null);
  };

  const handleRemoveCategory = async (catIdx: number) => {
    if (!await confirm({ title: 'Delete skill category?', message: 'The category and all skills inside it will be removed from the draft.', confirmLabel: 'Delete category', destructive: true })) return;
    setContent((prev: any) => ({
      ...prev,
      skills: prev.skills.filter((_: any, i: number) => i !== catIdx),
    }));
  };

  const handleRemoveSkillItem = (catIdx: number, skillIdx: number) => {
    setContent((prev: any) => {
      const categories = (prev.skills || []).map((category: any, categoryIndex: number) => {
        if (categoryIndex !== catIdx) return category;
        return {
          ...category,
          skills: (category.skills || [])
            .filter((_: any, index: number) => index !== skillIdx)
            .map((skill: any, order: number) => ({ ...skill, order })),
        };
      });
      return { ...prev, skills: categories };
    });
  };

  const toggleSkillActive = (catIdx: number, skillIdx: number) => setContent((prev: any) => {
    const categories = [...prev.skills];
    const category = categories[catIdx];
    categories[catIdx] = {
      ...category,
      skills: category.skills.map((skill: any, index: number) => index === skillIdx
        ? { ...skill, active: !skill.active, updatedAt: new Date().toISOString() }
        : skill),
    };
    return { ...prev, skills: categories };
  });

  const toggleSkillCategoryActive = (catIdx: number) => setContent((prev: any) => ({
    ...prev,
    skills: prev.skills.map((category: any, index: number) => index === catIdx
      ? { ...category, active: !category.active, updatedAt: new Date().toISOString() }
      : category),
  }));

  const skillDialogDuplicateMessage = skillDialog === 'category'
    ? (content.skills || []).some((category: any) =>
        getSkillCategoryKey(category) !== skillDialogCategoryId && normalizeSkillLabel(category.title) === normalizeSkillLabel(skillDialogName))
      ? 'A category with this name already exists.'
      : ''
    : skillDialog === 'skill' && (content.skills || []).some((category: any) =>
        category.skills?.some((skill: any) => getSkillRecordKey(skill) !== skillDialogEdit?.skillId && normalizeSkillLabel(skill.name) === normalizeSkillLabel(skillDialogName)))
      ? 'This skill already exists in another category.'
      : '';

  // Experiences operations
  const handleAddExperience = () => {
    setContent((prev: any) => ({
      ...prev,
      experiences: [
        {
          role: 'New Position',
          company: 'Company / Organization',
          period: '2024 - Present',
          location: 'Remote / Hybrid',
          description: ['Key achievement or responsibility.'],
          skills: ['TypeScript', 'React'],
          visible: true,
        },
        ...(prev.experiences || []),
      ],
    }));
  };

  const handleUpdateExperience = (idx: number, field: string, val: any) => {
    setContent((prev: any) => {
      const copy = [...prev.experiences];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, experiences: copy };
    });
  };

  const handleRemoveExperience = (idx: number) => {
    setContent((prev: any) => ({
      ...prev,
      experiences: prev.experiences.filter((_: any, i: number) => i !== idx),
    }));
  };

  // Education operations
  const handleAddEducation = () => {
    setContent((prev: any) => ({
      ...prev,
      education: [
        {
          degree: 'Bachelor of Science / Technology',
          institution: 'University / College Name',
          period: '2020 - 2024',
          details: 'Specialization details and achievements.',
          achievements: [],
          visible: true,
        },
        ...(prev.education || []),
      ],
    }));
  };

  const handleUpdateEducation = (idx: number, field: string, val: any) => {
    setContent((prev: any) => {
      const copy = [...prev.education];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, education: copy };
    });
  };

  const handleRemoveEducation = (idx: number) => {
    setContent((prev: any) => ({
      ...prev,
      education: prev.education.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateEducationAchievement = (educationIndex: number, achievementIndex: number, value: string) => {
    const education = [...(content.education || [])];
    const item = { ...education[educationIndex] };
    const achievements = [...(item.achievements || [])];
    achievements[achievementIndex] = value;
    item.achievements = achievements;
    education[educationIndex] = item;
    setContent((prev: any) => ({ ...prev, education }));
  };

  const updateCertification = (index: number, field: string, value: any) => setContent((prev: any) => {
    const certifications = [...(prev.certifications || [])];
    certifications[index] = { ...certifications[index], [field]: value };
    return { ...prev, certifications };
  });

  const addCertification = () => setContent((prev: any) => ({
    ...prev,
    certifications: [{ title: 'New certification', provider: '', description: '', image: '', artLabel: '', artDetail: '', link: '', visible: true }, ...(prev.certifications || [])],
  }));

  const reorderCertifications = (index: number, direction: -1 | 1) => setContent((prev: any) => ({ ...prev, certifications: moveItem(prev.certifications || [], index, direction) }));

  const addCapability = () => setContent((prev: any) => ({ ...prev, capabilities: [{ title: 'New capability', icon: 'bi-stars', description: '', visible: true }, ...(prev.capabilities || [])] }));
  const updateCapability = (index: number, field: string, value: string) => setContent((prev: any) => {
    const capabilities = [...(prev.capabilities || [])];
    capabilities[index] = { ...capabilities[index], [field]: value };
    return { ...prev, capabilities };
  });
  const moveCapability = (index: number, direction: -1 | 1) => setContent((prev: any) => ({ ...prev, capabilities: moveItem(prev.capabilities || [], index, direction) }));

  const uploadCertificationImage = async (index: number, file?: File) => {
    if (!file) return;
    setUploadingMedia(true);
    setErrorMessage(null);
    try {
      const url = await uploadPortfolioMedia(file, 'certificates');
      updateCertification(index, 'image', url);
      setSuccessMessage(`${file.name} uploaded. Save the draft and publish to make it public.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Certificate image upload failed.');
    } finally {
      setUploadingMedia(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading live website content...</span>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6 pb-12">
      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Site content editor navigation stays separate from global appearance settings. */}
      {activeSection !== 'appearance' && activeSection !== 'seo' && <div className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'profile', label: 'Personal Profile', icon: IdCard },
          { id: 'socials', label: 'Contact & Social', icon: Phone },
          { id: 'education', label: 'Education', icon: GraduationCap },
          { id: 'certifications', label: 'Certification', icon: Award },
          { id: 'skills', label: 'Skills & Toolkit', icon: Zap },
          { id: 'experience', label: 'Work Experience', icon: Briefcase },
          { id: 'capabilities', label: 'Capabilities', icon: Sparkles },
          { id: 'site', label: 'Site & Banners', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>}

      {/* TAB 1: PROFILE & PERSONAL BRANDING */}
      {activeSection === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-5 bg-[#11141c] p-6 rounded-3xl border border-slate-800/60">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Personal & Professional Bio
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display name</label>
                <input
                  type="text"
                  value={content.profile?.name || ''}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Professional focus</label>
                <input
                  type="text"
                  value={content.profile?.title || ''}
                  onChange={(e) => updateProfile('title', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Biography / About Me</label>
              <textarea
                rows={4}
                value={content.profile?.bio || ''}
                onChange={(e) => updateProfile('bio', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label id="profile-hiring-status-label" className="block text-xs font-semibold text-slate-300 mb-1.5">Hiring status</label>
                <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHiringStatusOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') setHiringStatusOpen(false); }}>
                  {(() => {
                    const rawStatus = String(content.profile?.hiringStatus || 'available').toLowerCase();
                    const status = ['hidden', 'available', 'open', 'unavailable'].includes(rawStatus)
                      ? rawStatus
                      : rawStatus.includes('open') ? 'open' : rawStatus.includes('not available') ? 'unavailable' : 'available';
                    const statusInfo: Record<string, { label: string; tone: string }> = { hidden: { label: 'Hide status', tone: 'bg-slate-400' }, available: { label: 'Available for work', tone: 'bg-emerald-400' }, open: { label: 'Open to opportunities', tone: 'bg-amber-400' }, unavailable: { label: 'Not available', tone: 'bg-slate-500' } };
                    return <>
                      <button type="button" aria-labelledby="profile-hiring-status-label" aria-haspopup="listbox" aria-expanded={hiringStatusOpen} onClick={() => setHiringStatusOpen((open) => !open)} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-xs font-semibold text-slate-700 outline-none hover:border-sky-400 focus:border-sky-500">
                        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${statusInfo[status].tone}`} />
                        <span className="min-w-0 flex-1 truncate">{statusInfo[status].label}</span>
                        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${hiringStatusOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {hiringStatusOpen && <div role="listbox" aria-label="Hiring status options" className="absolute left-0 right-0 top-full z-30 mt-1 space-y-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        {Object.entries(statusInfo).map(([value, option]) => <button key={value} type="button" role="option" aria-selected={status === value} onClick={() => { updateProfile('hiringStatus', value); setHiringStatusOpen(false); }} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs transition-colors ${status === value ? 'bg-sky-50 font-semibold text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${option.tone}`} />
                          <span className="flex-1">{option.label}</span>
                          {status === value && <Check aria-hidden="true" className="h-3.5 w-3.5 text-sky-600" />}
                        </button>)}
                      </div>}
                    </>;
                  })()}
                </div>
                <p className="mt-1 text-[10px] text-slate-400">This status appears on your public profile.</p>
              </div>
            </div>

          </div>

          {/* Right Column: Avatar & Counter Stats */}
          <div className="space-y-5">
            {/* Avatar Preview & URL */}
            <div className="bg-[#11141c] p-6 rounded-3xl border border-slate-800/60 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                Profile Picture
              </h3>

              <div className="flex flex-wrap items-center gap-4">
                <img
                  src={avatarPreviewUrl || content.profile?.avatar || '/avatar.png'}
                  alt="Profile"
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-700 shadow-md bg-slate-800"
                  onError={(e: any) => {
                    e.target.src = '/avatar.png';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <label className="mt-2 flex min-w-0 flex-col items-start gap-2 text-[11px] text-slate-400">
                    <span>{uploadingMedia ? 'Uploading image…' : 'Choose profile picture'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploadingMedia || saving}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUploadMedia(file, 'avatar');
                        event.target.value = '';
                      }}
                      className="block w-full min-w-0 max-w-full text-[11px] file:mr-2 file:h-8 file:max-w-full file:border-0 file:bg-slate-800 file:px-2 file:text-[10px] file:font-semibold file:text-slate-200"
                    />
                  </label>
                  {avatarFileName && (
                    <p className="mt-1 break-all text-[11px] text-slate-400" aria-live="polite">
                      Selected: <span className="font-medium text-slate-200">{avatarFileName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Portfolio Highlights / Career Goals */}
            <div className="bg-[#11141c] p-6 rounded-3xl border border-slate-800/60 space-y-3">
              <h3 className="text-sm font-bold text-white">Focus & Career Goals</h3>
              <div className="space-y-2">
                {(content.profile?.goals || []).map((goal: string, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
                    <input
                      aria-label={`Career goal ${idx + 1}`}
                      maxLength={300}
                      value={goal}
                      onChange={(event) => handleUpdateGoal(idx, event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none focus:text-white"
                    />
                    <button type="button" aria-label={`Move specialty ${idx + 1} up`} disabled={idx === 0} onClick={() => updateProfile('goals', moveItem(content.profile?.goals || [], idx, -1))} className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Move specialty ${idx + 1} down`} disabled={idx === (content.profile?.goals || []).length - 1} onClick={() => updateProfile('goals', moveItem(content.profile?.goals || [], idx, 1))} className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button
                      type="button"
                      onClick={() => handleRemoveGoal(idx)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newGoalInput}
                  onChange={(e) => setNewGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoal())}
                  placeholder="Add new goal or specialty..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddGoal}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: SOCIAL & LINKS */}
      {activeSection === 'socials' && (
        <div className="bg-[#11141c] p-6 rounded-3xl border border-slate-800/60 space-y-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400" />
            Contact & Social
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="text-xs font-semibold text-slate-300">Contact email</label><VisibilityToggle label="contact email" visible={content.profile?.contactVisibility?.email !== false} onToggle={(visible) => updateContactVisibility('email', visible)} /></div>
              <input type="email" value={content.profile?.email || ''} onChange={(event) => updateProfile('email', event.target.value)} className="w-full rounded-xl border border-slate-700/60 bg-slate-900 px-3.5 py-2.5 text-xs text-white" />
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="text-xs font-semibold text-slate-300">Phone</label><VisibilityToggle label="phone" visible={content.profile?.contactVisibility?.phone !== false} onToggle={(visible) => updateContactVisibility('phone', visible)} /></div>
              <input type="tel" value={content.profile?.phone || ''} onChange={(event) => updateProfile('phone', event.target.value)} className="w-full rounded-xl border border-slate-700/60 bg-slate-900 px-3.5 py-2.5 text-xs text-white" />
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="text-xs font-semibold text-slate-300">Location</label><VisibilityToggle label="location" visible={content.profile?.contactVisibility?.location !== false} onToggle={(visible) => updateContactVisibility('location', visible)} /></div>
              <input value={content.profile?.location || ''} onChange={(event) => updateProfile('location', event.target.value)} className="w-full rounded-xl border border-slate-700/60 bg-slate-900 px-3.5 py-2.5 text-xs text-white" />
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Github className="w-4 h-4 text-slate-400" /> GitHub Profile URL
              </label><VisibilityToggle label="GitHub link" visible={content.profile?.contactVisibility?.github !== false} onToggle={(visible) => updateContactVisibility('github', visible)} /></div>
              <input
                type="text"
                value={content.profile?.github || ''}
                onChange={(e) => updateProfile('github', e.target.value)}
                placeholder="https://github.com/username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none font-mono"
              />
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Linkedin className="w-4 h-4 text-blue-400" /> LinkedIn Profile URL
              </label><VisibilityToggle label="LinkedIn link" visible={content.profile?.contactVisibility?.linkedin !== false} onToggle={(visible) => updateContactVisibility('linkedin', visible)} /></div>
              <input
                type="text"
                value={content.profile?.linkedin || ''}
                onChange={(e) => updateProfile('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none font-mono"
              />
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Instagram className="w-4 h-4 text-pink-400" /> Instagram Profile URL
              </label><VisibilityToggle label="Instagram link" visible={content.profile?.contactVisibility?.instagram !== false} onToggle={(visible) => updateContactVisibility('instagram', visible)} /></div>
              <input
                type="text"
                value={content.profile?.instagram || ''}
                onChange={(e) => updateProfile('instagram', e.target.value)}
                placeholder="https://instagram.com/username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none font-mono"
              />
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Twitter className="w-4 h-4 text-sky-400" /> Twitter / X Profile URL
              </label><VisibilityToggle label="X / Twitter link" visible={content.profile?.contactVisibility?.twitter !== false} onToggle={(visible) => updateContactVisibility('twitter', visible)} /></div>
              <input
                type="text"
                value={content.profile?.twitter || ''}
                onChange={(e) => updateProfile('twitter', e.target.value)}
                placeholder="https://twitter.com/username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none font-mono"
              />
            </div>

          </div>
          <div className="space-y-3 border-t border-slate-800 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white">Additional social links</h4>
                <p className="mt-1 text-xs text-slate-400">Add any platform with its display name and URL.</p>
              </div>
              <button type="button" onClick={() => updateProfile('socialLinks', [...(content.profile?.socialLinks || []), { label: '', url: '' }])} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500"><Plus className="h-4 w-4" />Add link</button>
            </div>
            {(content.profile?.socialLinks || []).map((link: any, index: number) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                <input aria-label={`Social link ${index + 1} name`} maxLength={60} value={link.label || ''} onChange={(event) => { const links = [...(content.profile?.socialLinks || [])]; links[index] = { ...links[index], label: event.target.value }; updateProfile('socialLinks', links); }} placeholder="Platform name" className="min-w-0 rounded-xl border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input aria-label={`Social link ${index + 1} URL`} type="url" maxLength={2048} value={link.url || ''} onChange={(event) => { const links = [...(content.profile?.socialLinks || [])]; links[index] = { ...links[index], url: event.target.value }; updateProfile('socialLinks', links); }} placeholder="https://…" className="min-w-0 rounded-xl border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white font-mono" />
                <div className="flex items-center justify-end gap-1">
                  <VisibilityToggle label={`${link.label || `social link ${index + 1}`}`} visible={link.visible !== false} onToggle={(visible) => { const links = [...(content.profile?.socialLinks || [])]; links[index] = { ...links[index], visible }; updateProfile('socialLinks', links); }} />
                  <button type="button" aria-label={`Move social link ${index + 1} up`} disabled={index === 0} onClick={() => updateProfile('socialLinks', moveItem(content.profile?.socialLinks || [], index, -1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Move social link ${index + 1} down`} disabled={index === (content.profile?.socialLinks || []).length - 1} onClick={() => updateProfile('socialLinks', moveItem(content.profile?.socialLinks || [], index, 1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label={`Remove social link ${index + 1}`} onClick={() => updateProfile('socialLinks', (content.profile?.socialLinks || []).filter((_: any, itemIndex: number) => itemIndex !== index))} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /><span className="sm:hidden">Remove</span></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SKILLS & TECH STACK */}
      {activeSection === 'skills' && (
        <div className="skill-management-scope space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Skills &amp; Toolkit
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage technology categories, icons, visibility, and display order.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddSkillCategory}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {(content.skills || []).map((cat: any, catIdx: number) => (
              <section key={cat.id || catIdx} className={`min-w-0 space-y-4 rounded-2xl border bg-[#11141c] p-3 sm:p-4 ${cat.active === false ? 'border-slate-800 opacity-70' : 'border-slate-800/70'}`}>
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex min-w-0 items-center gap-2 text-left">
                    <SkillCategoryIcon name={cat.icon} category={cat.title} className="h-5 w-5 shrink-0 text-sky-400" />
                    <span className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-white">{cat.title}</h4>
                      <span className="block truncate text-[10px] text-slate-400">{cat.skills?.length || 0} technologies · {cat.active === false ? 'Inactive' : 'Active'}</span>
                    </span>
                  </div>
                  <div className="skill-category-actions flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                    <button type="button" aria-label={`${isRecordExpanded(`skill-category-${cat.id || catIdx}`) ? 'Hide' : 'Show'} details for ${cat.title}`} aria-expanded={isRecordExpanded(`skill-category-${cat.id || catIdx}`)} onClick={() => toggleRecordExpanded(`skill-category-${cat.id || catIdx}`)} className="admin-disclosure-edit-button admin-responsive-action inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold">
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRecordExpanded(`skill-category-${cat.id || catIdx}`) ? 'rotate-180' : ''}`} />
                      <span className="admin-responsive-action-label">{isRecordExpanded(`skill-category-${cat.id || catIdx}`) ? 'Hide details' : 'Show details'}</span>
                    </button>
                    <button type="button" onClick={() => handleAddSkillItem(catIdx)} aria-label="Add skill" title="Add skill" className="admin-responsive-action inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-600/20 px-3 text-xs font-semibold text-blue-300 transition hover:bg-blue-600/30"><Plus className="h-4 w-4 shrink-0" /><span className="admin-responsive-action-label">Add skill</span></button>
                    <button type="button" aria-label={`Edit ${cat.title} category name`} title="Edit category name" onClick={() => handleEditSkillCategory(cat)} className="skill-order-button inline-flex h-10 min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg p-1.5 text-slate-400"><Pencil className="h-4 w-4" /><span className="admin-responsive-action-label">Edit</span></button>
                    <button type="button" aria-label={`Move ${cat.title} up`} title="Move up" disabled={catIdx === 0} onClick={() => moveSkillCategory(catIdx, -1)} className="skill-order-button inline-flex h-10 min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-slate-400 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Move ${cat.title} down`} title="Move down" disabled={catIdx === (content.skills || []).length - 1} onClick={() => moveSkillCategory(catIdx, 1)} className="skill-order-button inline-flex h-10 min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-slate-400 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`${cat.active === false ? 'Activate' : 'Deactivate'} ${cat.title}`} title={`${cat.active === false ? 'Activate' : 'Deactivate'} category`} onClick={() => toggleSkillCategoryActive(catIdx)} className="skill-visibility-toggle inline-flex h-10 min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-800">{cat.active === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}<span className="admin-responsive-action-label">{cat.active === false ? 'Activate' : 'Deactivate'}</span></button>
                    <button type="button" aria-label={`Delete ${cat.title}`} title="Delete category" onClick={() => handleRemoveCategory(catIdx)} className="inline-flex h-10 min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {isRecordExpanded(`skill-category-${cat.id || catIdx}`) && <>
                <div className="skill-category-artwork min-w-0">
                  <label htmlFor={`skill-category-artwork-${cat.id || catIdx}`} className="mb-1 block text-[10px] font-semibold text-slate-400">Custom category artwork (optional)</label>
                  <span className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900 px-2 py-1">
                    {cat.iconImage && <img src={cat.iconImage} alt={`${cat.title} category icon`} className="h-7 w-7 shrink-0 rounded object-contain" />}
                    <input id={`skill-category-artwork-${cat.id || catIdx}`} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={uploadingMedia || saving} onChange={async (event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return; setUploadingMedia(true); try { const url = await uploadPortfolioMedia(file, 'profile'); setContent((prev: any) => ({ ...prev, skills: prev.skills.map((item: any, index: number) => index === catIdx ? { ...item, iconImage: url, updatedAt: new Date().toISOString() } : item) })); } catch (error: any) { setErrorMessage(error.message || 'Icon upload failed.'); } finally { setUploadingMedia(false); } }} className="min-w-0 w-full flex-1 text-[10px] text-slate-300 file:mr-1 file:max-w-[42%] file:truncate file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-[10px] file:text-slate-200" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Technologies</h4>
                </div>
                <div className="space-y-2">
                  {(cat.skills || []).map((skill: any, skillIdx: number) => (
                    <div key={`${getSkillRecordKey(skill)}:${skillIdx}`} className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 ${skill.active === false ? 'opacity-60' : ''}`}>
                      <SkillBrandIcon name={skill.name || ''} iconIdentifier={skill.iconIdentifier} className="h-7 w-7" />
                      <span className="min-w-0 truncate text-xs font-semibold text-white">{skill.name}</span>
                      <div className="skill-item-actions col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                        <button type="button" aria-label={`Edit ${skill.name}`} title="Edit skill" onClick={() => handleEditSkill(cat, skill)} className="skill-order-button inline-flex h-10 min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-sky-300"><Pencil className="h-4 w-4" /><span className="admin-responsive-action-label">Edit</span></button>
                        <button type="button" aria-label={`${skill.active === false ? 'Activate' : 'Deactivate'} ${skill.name}`} title={`${skill.active === false ? 'Activate' : 'Deactivate'} skill`} onClick={() => toggleSkillActive(catIdx, skillIdx)} className="skill-visibility-toggle inline-flex h-10 min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">{skill.active === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}<span className="admin-responsive-action-label">{skill.active === false ? 'Activate' : 'Deactivate'}</span></button>
                        <button type="button" aria-label={`Move ${skill.name} up`} title="Move up" disabled={skillIdx === 0} onClick={() => moveSkill(catIdx, skillIdx, -1)} className="skill-order-button inline-flex h-10 min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-slate-400 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Move ${skill.name} down`} title="Move down" disabled={skillIdx === cat.skills.length - 1} onClick={() => moveSkill(catIdx, skillIdx, 1)} className="skill-order-button inline-flex h-10 min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-slate-400 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Delete ${skill.name}`} title="Delete skill" onClick={() => handleRemoveSkillItem(catIdx, skillIdx)} className="inline-flex h-10 min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {!cat.skills?.length && <p className="rounded-lg border border-dashed border-slate-700 px-3 py-5 text-center text-[10px] text-slate-400">No skills in this category yet.</p>}
                </div>
                </>}
              </section>
            ))}
          </div>
          {!content.skills?.length && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-400">No skill categories yet. Add a category to get started.</p>}
        </div>
      )}

      {/* TAB 4: EXPERIENCE TIMELINE */}
      {activeSection === 'experience' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-purple-400" />
                Work History & Career Experience
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Add, edit, and organize positions shown in the Resume and About apps.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddExperience}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-purple-500"
            >
              <Plus className="w-4 h-4" />
              <span>Add Position</span>
            </button>
          </div>

          <div className="space-y-4">
            {(content.experiences || []).map((exp: any, idx: number) => (
              <div key={idx} className="min-w-0 rounded-3xl border border-slate-800/60 bg-[#11141c] p-4 sm:p-6 space-y-4">
                <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 py-1"><h4 className="truncate text-sm font-semibold text-white">{exp.role || `Position ${idx + 1}`}</h4><p className="truncate text-xs text-slate-400">{[exp.company, exp.period, exp.location].filter(Boolean).join(' · ') || 'Work experience details'}</p></div>
                  <div className="flex w-full flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:justify-end">
                      <button type="button" aria-label={`${isRecordExpanded(`experience-${idx}`) ? 'Hide' : 'Show'} details for ${exp.role || `position ${idx + 1}`}`} title={isRecordExpanded(`experience-${idx}`) ? 'Hide details' : 'Show details'} aria-expanded={isRecordExpanded(`experience-${idx}`)} onClick={() => toggleRecordExpanded(`experience-${idx}`)} className="admin-disclosure-edit-button admin-responsive-action inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRecordExpanded(`experience-${idx}`) ? 'rotate-180' : ''}`} /><span className="admin-responsive-action-label">{isRecordExpanded(`experience-${idx}`) ? 'Hide details' : 'Show details'}</span></button>
                      <VisibilityToggle label={`${exp.role || `experience ${idx + 1}`}`} visible={exp.visible !== false} onToggle={(visible) => updateArrayItem('experiences', idx, { visible })} />
                      <button type="button" aria-label={`Move experience ${idx + 1} up`} title="Move up" disabled={idx === 0} onClick={() => setContent((prev: any) => ({ ...prev, experiences: moveItem(prev.experiences || [], idx, -1) }))} className="admin-responsive-action inline-flex h-10 min-h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Move experience ${idx + 1} down`} title="Move down" disabled={idx === (content.experiences || []).length - 1} onClick={() => setContent((prev: any) => ({ ...prev, experiences: moveItem(prev.experiences || [], idx, 1) }))} className="admin-responsive-action inline-flex h-10 min-h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Delete experience ${idx + 1}`} title="Delete position" onClick={() => handleRemoveExperience(idx)} className="admin-responsive-action inline-flex h-10 min-h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {isRecordExpanded(`experience-${idx}`) && <>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Role Title</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => handleUpdateExperience(idx, 'role', e.target.value)}
                        className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Company / Organization</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => handleUpdateExperience(idx, 'company', e.target.value)}
                        className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Period (e.g. 2023 - Present)</label>
                      <input
                        type="text"
                        value={exp.period}
                        onChange={(e) => handleUpdateExperience(idx, 'period', e.target.value)}
                        className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Location</label>
                      <input
                        type="text"
                        value={exp.location}
                        onChange={(e) => handleUpdateExperience(idx, 'location', e.target.value)}
                        className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Key Achievements / Bullet Points (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={Array.isArray(exp.description) ? exp.description.join('\n') : exp.description || ''}
                    onChange={(e) => handleUpdateExperience(idx, 'description', e.target.value.split('\n'))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Technologies Used (comma separated)</label>
                  <input
                    type="text"
                    value={Array.isArray(exp.skills) ? exp.skills.join(', ') : exp.skills || ''}
                    onChange={(e) =>
                      handleUpdateExperience(
                        idx,
                        'skills',
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
                </>}
              </div>
            ))}
            {!content.experiences?.length && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-400">No work experience yet. Add a position to get started.</p>}
          </div>
        </div>
      )}

      {/* TAB 5: EDUCATION & CERTS */}
      {activeSection === 'education' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                Degrees, Education & Certifications
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage degrees and certificates presented on the Resume CV app.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddEducation}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add education</span>
            </button>
          </div>

          <div className="space-y-4">
            {(content.education || []).map((edu: any, idx: number) => (
              <article key={idx} className="min-w-0 rounded-2xl border border-slate-800/70 bg-[#11141c] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="min-w-0"><h4 className="truncate text-sm font-semibold text-white">{edu.degree || `Education item ${idx + 1}`}</h4><p className="text-[10px] text-slate-400">Education details</p></div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button type="button" aria-label={`${isRecordExpanded(`education-${idx}`) ? 'Hide' : 'Show'} details for ${edu.degree || `education item ${idx + 1}`}`} title={isRecordExpanded(`education-${idx}`) ? 'Hide details' : 'Show details'} aria-expanded={isRecordExpanded(`education-${idx}`)} onClick={() => toggleRecordExpanded(`education-${idx}`)} className="admin-disclosure-edit-button admin-responsive-action inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRecordExpanded(`education-${idx}`) ? 'rotate-180' : ''}`} /><span className="admin-responsive-action-label">{isRecordExpanded(`education-${idx}`) ? 'Hide details' : 'Show details'}</span></button>
                    <VisibilityToggle label={`${edu.degree || `education item ${idx + 1}`}`} visible={edu.visible !== false} onToggle={(visible) => updateArrayItem('education', idx, { visible })} />
                    <button type="button" aria-label={`Move education ${idx + 1} up`} disabled={idx === 0} onClick={() => setContent((prev: any) => ({ ...prev, education: moveItem(prev.education || [], idx, -1) }))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Move education ${idx + 1} down`} disabled={idx === (content.education || []).length - 1} onClick={() => setContent((prev: any) => ({ ...prev, education: moveItem(prev.education || [], idx, 1) }))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Delete education ${idx + 1}`} onClick={() => handleRemoveEducation(idx)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {isRecordExpanded(`education-${idx}`) && <>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <label className="text-[11px] font-semibold text-slate-300">Period<input value={edu.period || ''} onChange={(e) => handleUpdateEducation(idx, 'period', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                  <label className="text-[11px] font-semibold text-slate-300">Title<input value={edu.title ?? edu.degree ?? ''} onChange={(e) => { handleUpdateEducation(idx, 'title', e.target.value); handleUpdateEducation(idx, 'degree', e.target.value); }} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                  <label className="text-[11px] font-semibold text-slate-300">College / institution<input value={edu.institution || ''} onChange={(e) => handleUpdateEducation(idx, 'institution', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                  <label className="text-[11px] font-semibold text-slate-300 sm:col-span-2">Description<textarea rows={3} value={edu.description ?? edu.details ?? ''} onChange={(e) => { handleUpdateEducation(idx, 'description', e.target.value); handleUpdateEducation(idx, 'details', e.target.value); }} className="mt-1.5 w-full resize-y rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs leading-relaxed text-white" /></label>
                </div>
                <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h5 className="text-xs font-semibold text-white">Key achievements</h5><p className="mt-1 text-[10px] text-slate-400">{(edu.achievements || []).length} items</p></div><button type="button" onClick={() => handleUpdateEducation(idx, 'achievements', [...(edu.achievements || []), ''])} style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#ffffff' }} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition-colors hover:border-sky-500 hover:bg-sky-600 hover:text-white"><Plus className="h-3.5 w-3.5" />Add achievement</button></div>
                  {(edu.achievements || []).map((achievement: string, achievementIndex: number) => <div key={achievementIndex} className="mb-2 flex min-w-0 items-center gap-1"><input value={achievement} onChange={(event) => updateEducationAchievement(idx, achievementIndex, event.target.value)} aria-label={`Achievement ${achievementIndex + 1}`} className="min-w-0 flex-1 rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2 text-xs text-white" placeholder="Achievement" /><button type="button" aria-label={`Move achievement ${achievementIndex + 1} up`} disabled={achievementIndex === 0} onClick={() => handleUpdateEducation(idx, 'achievements', moveItem(edu.achievements || [], achievementIndex, -1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`Move achievement ${achievementIndex + 1} down`} disabled={achievementIndex === edu.achievements.length - 1} onClick={() => handleUpdateEducation(idx, 'achievements', moveItem(edu.achievements || [], achievementIndex, 1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label="Remove achievement" onClick={() => handleUpdateEducation(idx, 'achievements', edu.achievements.filter((_: any, i: number) => i !== achievementIndex))} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div>)}
                  {!edu.achievements?.length && <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-[10px] text-slate-500">No achievements yet. Add one to get started.</p>}
                </section>
                </>}
              </article>
            ))}
            {!content.education?.length && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-400">No education details yet. Add one to get started.</p>}
          </div>

        </div>
      )}
      {activeSection === 'certifications' && (
        <div className="space-y-4">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold text-white">Certifications</h3><p className="mt-1 text-xs text-slate-400">Manage certificate details, images, links, and visibility.</p></div><button type="button" onClick={addCertification} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500"><Plus className="h-4 w-4" />Add certification</button></div>
            {(content.certifications || []).map((certificate: any, idx: number) => <article key={idx} className="min-w-0 space-y-4 rounded-2xl border border-slate-800/70 bg-[#11141c] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3"><div className="min-w-0"><h4 className="truncate text-sm font-semibold text-white">{certificate.title || `Certification ${idx + 1}`}</h4><p className="text-[10px] text-slate-400">{[certificate.provider, certificate.artLabel].filter(Boolean).join(' · ') || 'Certificate details'}</p></div><div className="flex flex-wrap items-center gap-1"><button type="button" aria-label={`${isRecordExpanded(`certification-${idx}`) ? 'Hide' : 'Show'} details for ${certificate.title || `certification ${idx + 1}`}`} title={isRecordExpanded(`certification-${idx}`) ? 'Hide details' : 'Show details'} aria-expanded={isRecordExpanded(`certification-${idx}`)} onClick={() => toggleRecordExpanded(`certification-${idx}`)} className="admin-disclosure-edit-button admin-responsive-action inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRecordExpanded(`certification-${idx}`) ? 'rotate-180' : ''}`} /><span className="admin-responsive-action-label">{isRecordExpanded(`certification-${idx}`) ? 'Hide details' : 'Show details'}</span></button><VisibilityToggle label={certificate.title || `certification ${idx + 1}`} visible={certificate.visible !== false} onToggle={(visible) => updateCertification(idx, 'visible', visible)} /><button type="button" aria-label={`Move certification ${idx + 1} up`} disabled={idx === 0} onClick={() => reorderCertifications(idx, -1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`Move certification ${idx + 1} down`} disabled={idx === content.certifications.length - 1} onClick={() => reorderCertifications(idx, 1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label={`Delete certification ${idx + 1}`} onClick={() => setContent((prev: any) => ({ ...prev, certifications: prev.certifications.filter((_: any, itemIndex: number) => itemIndex !== idx) }))} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div></div>
              {isRecordExpanded(`certification-${idx}`) && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-slate-300">Title<input value={certificate.title || ''} onChange={(e) => updateCertification(idx, 'title', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                <label className="text-[11px] font-semibold text-slate-300">Provider<input value={certificate.provider || ''} onChange={(e) => updateCertification(idx, 'provider', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                <label className="text-[11px] font-semibold text-slate-300 sm:col-span-2">Description<textarea rows={3} value={certificate.description || ''} onChange={(e) => updateCertification(idx, 'description', e.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                <div className="sm:col-span-2 rounded-xl border border-slate-700/60 bg-slate-900/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {certificate.image && !unavailableCertificationPreviews[certificate.image] ? (
                        <img
                          src={certificate.image}
                          alt={`${certificate.title || 'Certificate'} image preview`}
                          onError={() => setUnavailableCertificationPreviews((current) => ({ ...current, [certificate.image]: true }))}
                          className="h-20 w-28 rounded-lg border border-slate-700 bg-slate-950 object-contain p-1"
                        />
                      ) : (
                        <span className="grid h-20 w-28 place-items-center rounded-lg border border-dashed border-slate-700 bg-slate-950 px-2 text-center text-[10px] text-slate-400">
                          {certificate.image ? <><ImageIcon className="mb-1 h-4 w-4" />Preview unavailable</> : 'No image uploaded'}
                        </span>
                      )}
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/70 px-3 text-[10px] font-semibold text-slate-100 transition duration-150 hover:border-sky-400 hover:bg-sky-500/15 hover:text-sky-100 hover:shadow-[0_0_18px_rgba(56,189,248,.15)] focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-400">
                        <ImageIcon className="h-4 w-4" />{uploadingMedia ? 'Uploading…' : certificate.image ? 'Replace image' : 'Upload image'}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploadingMedia || saving} onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void uploadCertificationImage(idx, file); }} className="sr-only" />
                      </label>
                    </div>
                  </div>
                </div>
                <label className="text-[11px] font-semibold text-slate-300">Cover label<input value={certificate.artLabel || ''} onChange={(e) => updateCertification(idx, 'artLabel', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                <label className="text-[11px] font-semibold text-slate-300">Cover detail<input value={certificate.artDetail || ''} onChange={(e) => updateCertification(idx, 'artDetail', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
                <label className="text-[11px] font-semibold text-slate-300">Link<input type="url" value={certificate.link || ''} onChange={(e) => updateCertification(idx, 'link', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label>
              </div>}
            </article>)}
            {!content.certifications?.length && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-500">No certifications yet. Add one to get started.</p>}
          </section>
        </div>
      )}

      {activeSection === 'capabilities' && (
        <div className="space-y-4">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-base font-bold text-white"><Sparkles className="h-4 w-4 text-sky-400" />Capabilities</h3><p className="mt-1 text-xs text-slate-400">Describe the services and areas where you can contribute.</p></div><button type="button" onClick={addCapability} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500"><Plus className="h-4 w-4" />Add capability</button></div>
          {(content.capabilities || []).map((capability: any, index: number) => <article key={index} className="space-y-4 rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-400"><Sparkles className="h-4 w-4" /></span><div className="min-w-0"><h4 className="truncate text-sm font-semibold text-white">{capability.title || 'New capability'}</h4><p className="truncate text-[10px] text-slate-400">{capability.description || 'Capability details'}</p></div></div><div className="flex flex-wrap items-center gap-1"><button type="button" aria-label={`${isRecordExpanded(`capability-${index}`) ? 'Hide' : 'Show'} details for ${capability.title || `capability ${index + 1}`}`} title={isRecordExpanded(`capability-${index}`) ? 'Hide details' : 'Show details'} aria-expanded={isRecordExpanded(`capability-${index}`)} onClick={() => toggleRecordExpanded(`capability-${index}`)} className="admin-disclosure-edit-button admin-responsive-action inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${isRecordExpanded(`capability-${index}`) ? 'rotate-180' : ''}`} /><span className="admin-responsive-action-label">{isRecordExpanded(`capability-${index}`) ? 'Hide details' : 'Show details'}</span></button><VisibilityToggle label={capability.title || `capability ${index + 1}`} visible={capability.visible !== false} onToggle={(visible) => updateArrayItem('capabilities', index, { visible })} /><button type="button" aria-label={`Move capability ${index + 1} up`} disabled={index === 0} onClick={() => moveCapability(index, -1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`Move capability ${index + 1} down`} disabled={index === (content.capabilities || []).length - 1} onClick={() => moveCapability(index, 1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label={`Delete capability ${index + 1}`} onClick={() => setContent((prev: any) => ({ ...prev, capabilities: prev.capabilities.filter((_: any, itemIndex: number) => itemIndex !== index) }))} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div></div>
            {isRecordExpanded(`capability-${index}`) && <div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-semibold text-slate-300">Title<input value={capability.title || ''} onChange={(e) => updateCapability(index, 'title', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label><label className="text-[11px] font-semibold text-slate-300">Icon<input value={capability.icon || ''} onChange={(e) => updateCapability(index, 'icon', e.target.value)} placeholder="bi-stars" className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs text-white" /></label><label className="text-[11px] font-semibold text-slate-300 sm:col-span-2">Description<textarea rows={3} value={capability.description || ''} onChange={(e) => updateCapability(index, 'description', e.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2.5 text-xs leading-relaxed text-white" /></label></div>}
          </article>)}
          {!content.capabilities?.length && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-400">No capabilities yet. Add one to get started.</p>}
        </section>
        </div>
      )}

      {/* TAB: SITE APPEARANCE, BANNERS & MAINTENANCE */}
      {activeSection === 'seo' && (
        <div className="w-full min-w-0 max-w-6xl">
          <section className="admin-content-card space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><Globe className="h-5 w-5" /></span>
              <div><h3 className="text-base font-semibold text-slate-900">SEO &amp; Sharing</h3><p className="mt-1 text-xs text-slate-500">Edit search and social metadata, then use the Admin Panel header’s Save draft and Publish buttons. Changes stay in your private draft until published.</p></div>
            </div>
            <section className="space-y-4">
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Site details</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">Site name
                  <input value={content.siteSettings?.siteName || ''} maxLength={160} onChange={(event) => updateSiteSettings('siteName', event.target.value)} placeholder={content.profile?.name || 'Portfolio site name'} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">Page title
                  <input value={content.siteSettings?.siteTitle || ''} maxLength={120} onChange={(event) => updateSiteSettings('siteTitle', event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">Portfolio version
                  <input value={content.siteSettings?.portfolioVersion || '1.0.0'} maxLength={32} onChange={(event) => updateSiteSettings('portfolioVersion', event.target.value.trim())} placeholder="1.0.0" className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
                <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Meta description
                  <textarea rows={3} maxLength={320} value={content.siteSettings?.metaDescription || ''} onChange={(event) => updateSiteSettings('metaDescription', event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                  <span className="mt-1 block text-right text-[10px] text-slate-500">{(content.siteSettings?.metaDescription || '').length}/320</span>
                </label>
                <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Canonical portfolio URL
                  <input type="url" value={content.siteSettings?.canonicalUrl || ''} onChange={(event) => updateSiteSettings('canonicalUrl', event.target.value)} placeholder={window.location.origin} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Images &amp; favicon</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-xs font-semibold text-slate-700">
                  <label htmlFor="social-preview-url">Social preview image</label>
                  <input id="social-preview-url" value={content.siteSettings?.socialImageUrl || ''} maxLength={2048} onChange={(event) => updateSiteSettings('socialImageUrl', event.target.value)} placeholder="/api/portfolio-media/… or https://…" className="block h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-normal text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700">
                    <ImageIcon className="h-4 w-4" />
                    {uploadingMediaField === 'socialImageUrl' ? 'Uploading image…' : 'Upload social image'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploadingMedia || saving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadMedia(file, 'socialImageUrl'); event.currentTarget.value = ''; }} className="sr-only" />
                  </label>
                </div>
                <div className="space-y-2 text-xs font-semibold text-slate-700">
                  <label htmlFor="favicon-url">Website favicon</label>
                  <input id="favicon-url" value={content.siteSettings?.faviconUrl || ''} maxLength={2048} onChange={(event) => updateSiteSettings('faviconUrl', event.target.value)} placeholder="/api/portfolio-media/… or https://…" className="block h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-normal text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700">
                    <ImageIcon className="h-4 w-4" />
                    {uploadingMediaField === 'faviconUrl' ? 'Uploading icon…' : 'Upload favicon'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon" disabled={uploadingMedia || saving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadMedia(file, 'faviconUrl'); event.currentTarget.value = ''; }} className="sr-only" />
                  </label>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">Use favicon in emails</p>
                      <p className="mt-0.5 text-[10px] font-normal text-slate-500">Email branding changes after you publish.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={content.siteSettings?.emailFaviconEnabled !== false}
                      aria-label="Use website favicon in emails"
                      onClick={() => updateSiteSettings('emailFaviconEnabled', content.siteSettings?.emailFaviconEnabled === false)}
                      className={`admin-compact-switch relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-slate-500 p-0 shadow-inner transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${content.siteSettings?.emailFaviconEnabled !== false ? 'bg-sky-600' : 'bg-slate-500'}`}
                      style={{ backgroundColor: content.siteSettings?.emailFaviconEnabled !== false ? '#0284c7' : '#64748b' }}
                    >
                      <span
                        className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-slate-300 bg-white shadow-md transition-[left]"
                        style={{ left: content.siteSettings?.emailFaviconEnabled !== false ? 'calc(100% - 1.375rem)' : '0.125rem' }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Open Graph</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">Open Graph title
                  <input value={content.siteSettings?.openGraphTitle || ''} maxLength={120} onChange={(event) => updateSiteSettings('openGraphTitle', event.target.value)} placeholder={content.siteSettings?.siteTitle || 'Use page title'} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">Open Graph description
                  <textarea rows={3} maxLength={320} value={content.siteSettings?.openGraphDescription || ''} onChange={(event) => updateSiteSettings('openGraphDescription', event.target.value)} placeholder={content.siteSettings?.metaDescription || 'Use meta description'} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Twitter / X</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">Twitter/X card
                  <select value={content.siteSettings?.twitterCard || 'summary_large_image'} onChange={(event) => updateSiteSettings('twitterCard', event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
                    <option value="summary_large_image">Large image card</option>
                    <option value="summary">Summary card</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">Twitter/X title
                  <input value={content.siteSettings?.twitterTitle || ''} maxLength={120} onChange={(event) => updateSiteSettings('twitterTitle', event.target.value)} placeholder={content.siteSettings?.openGraphTitle || content.siteSettings?.siteTitle || 'Use Open Graph title'} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
                <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Twitter/X description
                  <textarea rows={3} maxLength={320} value={content.siteSettings?.twitterDescription || ''} onChange={(event) => updateSiteSettings('twitterDescription', event.target.value)} placeholder={content.siteSettings?.openGraphDescription || content.siteSettings?.metaDescription || 'Use Open Graph description'} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                </label>
              </div>
            </section>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div><h4 className="text-xs font-semibold text-slate-800">Search &amp; social preview</h4><p className="mt-1 text-[10px] text-slate-500">Preview reflects the current draft values.</p></div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white p-1">
                    {content.siteSettings?.faviconUrl && ((content.siteSettings.faviconUrl.startsWith('/') && !content.siteSettings.faviconUrl.startsWith('//')) || /^https:\/\//i.test(content.siteSettings.faviconUrl))
                      ? <img src={content.siteSettings.faviconUrl} alt="Favicon preview" className="h-full w-full object-contain" />
                      : <Globe className="h-4 w-4 text-slate-400" />}
                  </span>
                  <span className="max-w-24 text-[10px] font-semibold text-slate-600">Browser tab icon</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,.8fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-[10px] text-emerald-700">{content.siteSettings?.canonicalUrl || window.location.origin}</p>
                  <p className="mt-1 truncate text-base font-semibold text-sky-700">{content.siteSettings?.siteTitle || 'Portfolio title'}</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{content.siteSettings?.metaDescription || 'Your search and social description will appear here.'}</p>
                </div>
                {content.siteSettings?.socialImageUrl && ((content.siteSettings.socialImageUrl.startsWith('/') && !content.siteSettings.socialImageUrl.startsWith('//')) || /^https:\/\//i.test(content.siteSettings.socialImageUrl))
                  ? <div className="aspect-[1.91/1] w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-2"><img src={content.siteSettings.socialImageUrl} alt="Social sharing image preview" className="block h-full w-full object-contain" /></div>
                  : <div className="grid aspect-[1.91/1] w-full place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-[10px] text-slate-400">No social image selected</div>}
              </div>
            </div>
          </section>
        </div>
      )}

      {(activeSection === 'appearance' || activeSection === 'site') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeSection === 'appearance' && <>
          <section className="order-3 rounded-3xl border border-slate-800/60 bg-[#11141c] p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-white"><Layers className="h-4 w-4 text-blue-400" />Available portfolio apps</h3>
                <p className="mt-1 text-xs text-slate-400">Choose which apps visitors can see in the desktop, Start menu, search, and taskbar. Changes preview here immediately; publish to apply them to visitors.</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-semibold text-slate-300">{APPS_LIST.filter((app) => app.id !== 'admin' && !content.siteSettings?.disabledApps?.includes(app.id)).length} visitor apps enabled</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {APPEARANCE_APPS.map((app) => {
                if (app.id === 'admin') {
                  return <label key={app.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-3.5 py-3 transition hover:border-indigo-400/50">
                      <input type="checkbox" checked={draftAdminAppEnabledInStart} onChange={(event) => updateSiteSettings('adminAppEnabledInStart', event.target.checked)} className="h-4 w-4 accent-indigo-500" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-200">{app.name}</span><span className="mt-0.5 block text-[10px] text-slate-500">Private admin app · show or hide in the Start menu after publishing</span></span>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${draftAdminAppEnabledInStart ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{draftAdminAppEnabledInStart ? 'Shown' : 'Hidden'}</span>
                  </label>;
                }
                const enabled = !content.siteSettings?.disabledApps?.includes(app.id);
                return <label key={app.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3 transition hover:border-slate-700">
                  <input type="checkbox" checked={enabled} onChange={(event) => toggleAppAvailability(app.id, event.target.checked)} className="h-4 w-4 accent-blue-600" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-200">{app.name}</span><span className="mt-0.5 block text-[10px] text-slate-500">{app.category}</span></span>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{enabled ? 'Shown' : 'Hidden'}</span>
                </label>;
              })}
            </div>
          </section>
          <section className="order-4 rounded-3xl border border-slate-800/60 bg-[#11141c] p-6 lg:col-span-2">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-white"><Layers className="h-4 w-4 text-cyan-400" />Apps &amp; shortcuts</h3>
              <p className="mt-1 text-xs text-slate-400">Changes are saved to the portfolio draft and take effect for visitors only after publishing.</p>
            </div>
            <div className="space-y-2">
              {APPEARANCE_APPS.map((app) => {
                const shortcut = draftDesktopShortcuts.find((item) => item.appId === app.id);
                const taskbarPinned = draftTaskbarPinnedApps.includes(app.id);
                const startPinned = draftStartPinnedApps.includes(app.id);
                return <div key={app.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-200">{app.name}</span><span className="text-[10px] text-slate-500">{app.id === 'admin' ? 'Private admin app · not shown to visitors' : app.category}</span></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => {
                      if (shortcut) {
                        updateSiteSettings('desktopShortcuts', draftDesktopShortcuts.filter((item) => item.appId !== app.id));
                      } else {
                        const nextShortcut: DesktopIconItem = {
                          id: `icon-${app.id}`,
                          appId: app.id,
                          name: app.name,
                          icon: app.icon || 'Code2',
                          position: { gridX: 0, gridY: draftDesktopShortcuts.length },
                          type: 'app',
                        };
                        updateSiteSettings('desktopShortcuts', [...draftDesktopShortcuts, nextShortcut]);
                      }
                    }} className={`admin-action-button rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${shortcut ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{shortcut ? 'Remove desktop shortcut' : 'Add desktop shortcut'}</button>
                    <button type="button" onClick={() => updateSiteSettings('taskbarPinnedApps', taskbarPinned ? draftTaskbarPinnedApps.filter((id) => id !== app.id) : [...draftTaskbarPinnedApps, app.id])} className={`admin-action-button rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${taskbarPinned ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{taskbarPinned ? 'Unpin taskbar' : 'Pin taskbar'}</button>
                    <button type="button" onClick={() => updateSiteSettings('startPinnedApps', startPinned ? draftStartPinnedApps.filter((id) => id !== app.id) : [...draftStartPinnedApps, app.id])} className={`admin-action-button rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${startPinned ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{startPinned ? 'Unpin Start' : 'Pin Start'}</button>
                  </div>
                </div>;
              })}
            </div>
          </section>
          <section className="order-2 rounded-3xl border border-slate-800/60 bg-[#11141c] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-white"><ShieldAlert className="h-4 w-4 text-indigo-400" />Admin panel keyboard shortcut</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">Use a keyboard combination to open Admin Control Center from anywhere on the desktop. The default is Alt+A. This preference is saved in this browser.</p>
              </div>
              <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs font-semibold text-indigo-200">{adminShortcut}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={recordingAdminShortcut}
                onClick={() => setRecordingAdminShortcut(true)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    setRecordingAdminShortcut(false);
                    return;
                  }
                  const nextShortcut = formatAdminShortcut(event.nativeEvent);
                  if (!nextShortcut) return;
                  try {
                    saveAdminShortcut(nextShortcut);
                    setAdminShortcut(nextShortcut);
                    setRecordingAdminShortcut(false);
                    addNotification({ title: 'Shortcut updated', message: `Admin Control Center opens with ${nextShortcut}.`, type: 'success' });
                  } catch {
                    addNotification({ title: 'Shortcut not saved', message: 'Browser storage is unavailable. The shortcut could not be changed.', type: 'error' });
                    setRecordingAdminShortcut(false);
                  }
                }}
                onBlur={() => setRecordingAdminShortcut(false)}
                className={`admin-action-button rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition ${recordingAdminShortcut ? 'border-indigo-400 bg-indigo-600 text-white ring-2 ring-indigo-300/40' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              >{recordingAdminShortcut ? 'Press your shortcut…' : 'Change shortcut'}</button>
              <button
                type="button"
                disabled={adminShortcut === DEFAULT_ADMIN_SHORTCUT}
                onClick={() => {
                  try {
                    saveAdminShortcut(DEFAULT_ADMIN_SHORTCUT);
                    setAdminShortcut(DEFAULT_ADMIN_SHORTCUT);
                    setRecordingAdminShortcut(false);
                  } catch {
                    addNotification({ title: 'Shortcut not saved', message: 'Browser storage is unavailable. The default shortcut could not be restored.', type: 'error' });
                  }
                }}
                className="admin-action-button rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >Reset to default</button>
              <span className="text-[10px] text-slate-500">Press a key combination with Ctrl, Alt, or Meta; press Escape to cancel.</span>
            </div>
          </section>
          </>}

          {/* Announcement Banner */}
          {activeSection === 'site' && <>
          <div className="bg-[#11141c] p-6 rounded-3xl border border-slate-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-sky-400" />
                Live Announcement Banner
              </h3>
              <button type="button" role="switch" aria-checked={content.siteSettings?.announcementBanner?.enabled || false} aria-label="Toggle announcement banner" onClick={() => updateAnnouncement('enabled', !content.siteSettings?.announcementBanner?.enabled)} className={`admin-compact-switch relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-slate-500 p-0 shadow-inner transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${content.siteSettings?.announcementBanner?.enabled ? 'bg-sky-600' : 'bg-slate-500'}`} style={{ backgroundColor: content.siteSettings?.announcementBanner?.enabled ? '#0284c7' : '#64748b' }}>
                <span className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-slate-300 bg-white shadow-md transition-[left]" style={{ left: content.siteSettings?.announcementBanner?.enabled ? 'calc(100% - 1.375rem)' : '0.125rem' }} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Display an alert or hiring banner at the top of the Windows 11 desktop for all visitors. Save the draft and publish it for the change to appear on the live portfolio.
            </p>
            <p className={`text-[11px] font-semibold ${content.siteSettings?.announcementBanner?.enabled ? 'text-sky-300' : 'text-slate-500'}`}>
              Draft setting: {content.siteSettings?.announcementBanner?.enabled ? 'Enabled' : 'Disabled'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Banner Message</label>
              <input
                type="text"
                value={content.siteSettings?.announcementBanner?.message || ''}
                onChange={(e) => updateAnnouncement('message', e.target.value)}
                placeholder="🚀 Available for new AI & Full-Stack roles!"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Banner Style</label>
                <select
                  value={content.siteSettings?.announcementBanner?.type || 'info'}
                  onChange={(e) => updateAnnouncement('type', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="hiring">Hiring (Purple)</option>
                  <option value="success">Success (Emerald)</option>
                  <option value="warning">Warning (Amber)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Action Link</label>
                <input
                  type="text"
                  value={content.siteSettings?.announcementBanner?.link || ''}
                  onChange={(e) => updateAnnouncement('link', e.target.value)}
                  placeholder="https://... or mailto:..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Emergency Maintenance Mode */}
          <div className="bg-[#11141c] p-6 rounded-3xl border border-slate-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Emergency Maintenance Mode
              </h3>
              <button type="button" role="switch" aria-checked={content.siteSettings?.maintenanceMode || false} aria-label="Toggle maintenance mode" onClick={() => updateSiteSettings('maintenanceMode', !content.siteSettings?.maintenanceMode)} className={`admin-compact-switch relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-slate-500 p-0 shadow-inner transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${content.siteSettings?.maintenanceMode ? 'bg-amber-600' : 'bg-slate-500'}`} style={{ backgroundColor: content.siteSettings?.maintenanceMode ? '#d97706' : '#64748b' }}>
                <span className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-slate-300 bg-white shadow-md transition-[left]" style={{ left: content.siteSettings?.maintenanceMode ? 'calc(100% - 1.375rem)' : '0.125rem' }} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              When enabled and published, visitors will see a Windows 11 maintenance screen. Admins can still sign in. Save the draft and publish it to apply this setting.
            </p>
            <p className={`text-[11px] font-semibold ${content.siteSettings?.maintenanceMode ? 'text-amber-300' : 'text-slate-500'}`}>
              Draft setting: {content.siteSettings?.maintenanceMode ? 'Enabled' : 'Disabled'}
            </p>
            {content.siteSettings?.maintenanceMode && (
              <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                <ShieldAlert className="mx-auto h-6 w-6 text-amber-300" />
                <p className="mt-2 text-sm font-bold text-amber-100">Maintenance screen preview</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{content.siteSettings?.maintenanceMessage || 'This portfolio is temporarily unavailable while scheduled maintenance is in progress.'}</p>
                <p className="mt-2 text-[10px] font-medium text-amber-300">Visitors will see this after the draft is published.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Maintenance Screen Notice</label>
              <textarea
                rows={3}
                value={content.siteSettings?.maintenanceMessage || ''}
                onChange={(e) => updateSiteSettings('maintenanceMessage', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none resize-none leading-relaxed"
              />
            </div>
          </div>
          </>}

          {/* Default OS Appearance for Visitors */}
          {activeSection === 'appearance' && <div className="order-1 bg-[#11141c] p-6 rounded-3xl border border-slate-800/60 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-pink-400" />
              Default Desktop Theme for Visitors
            </h3>

            <div className="grid grid-cols-1 items-start gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Theme</label>
                <select
                  value={content.siteSettings?.defaultTheme || 'dark'}
                  onChange={(e) => updateSiteSettings('defaultTheme', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="dark">Dark Bloom (Windows 11 Dark)</option>
                  <option value="light">Light Bloom (Windows 11 Light)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Wallpaper</label>
                <select
                  value={content.siteSettings?.defaultWallpaperUrl ? 'custom' : (getDefaultDesktopWallpaper(content.siteSettings?.defaultWallpaper) || 'darkbloom')}
                  onChange={(e) => {
                    updateSiteSettings('defaultWallpaper', e.target.value === 'custom' ? (getDefaultDesktopWallpaper(content.siteSettings?.defaultWallpaper) || 'darkbloom') : e.target.value);
                    if (e.target.value !== 'custom') {
                      updateSiteSettings('defaultWallpaperUrl', '');
                      replaceWallpaperLocalPreview(null);
                      setWallpaperPreviewError(false);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="darkbloom">Dark Bloom</option>
                  <option value="bloom">Light Bloom</option>
                  <option value="aurora">Aurora</option>
                  <option value="cyberpunk">Cyberpunk</option>
                  <option value="sunset">Sunset</option>
                  <option value="minimal">Minimal</option>
                  <option value="live-waves">Live Waves</option>
                  {content.siteSettings?.defaultWallpaperUrl && <option value="custom">Uploaded image</option>}
                </select>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => wallpaperUploadInputRef.current?.click()} disabled={uploadingMedia || saving} className="inline-flex cursor-pointer items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                    {uploadingMedia ? 'Uploading…' : 'Upload wallpaper'}
                  </button>
                  <input ref={wallpaperUploadInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploadingMedia || saving} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void handleUploadDefaultWallpaper(file); }} className="sr-only" />
                  {content.siteSettings?.defaultWallpaperUrl && <button type="button" onClick={() => {
                    updateSiteSettings('defaultWallpaperUrl', '');
                    replaceWallpaperLocalPreview(null);
                    setWallpaperPreviewError(false);
                  }} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-300 transition-colors hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-200">Remove image</button>}
                </div>
                {(wallpaperLocalPreviewUrl || content.siteSettings?.defaultWallpaperUrl) && (
                  wallpaperPreviewError && !wallpaperLocalPreviewUrl
                    ? <div role="status" className="mt-2 grid h-20 w-full place-items-center rounded-lg border border-rose-300 bg-rose-50 px-3 text-center text-[11px] text-rose-700">Wallpaper preview could not be loaded. Try uploading the image again.</div>
                    : <img
                        src={wallpaperLocalPreviewUrl || content.siteSettings.defaultWallpaperUrl}
                        alt="Default wallpaper preview"
                        onError={() => {
                          if (wallpaperLocalPreviewUrl) {
                            setWallpaperPreviewError(true);
                            return;
                          }
                          const mediaId = String(content.siteSettings?.defaultWallpaperUrl || '').match(/^\/api\/portfolio-media\/([^/?#]+)$/)?.[1];
                          if (!mediaId) {
                            setWallpaperPreviewError(true);
                            return;
                          }
                          void apiFetch(`/api/files/download/${encodeURIComponent(mediaId)}`)
                            .then(async (response) => {
                              if (!response.ok) throw new Error('Protected wallpaper preview request failed.');
                              const fallbackUrl = URL.createObjectURL(await response.blob());
                              replaceWallpaperLocalPreview(fallbackUrl);
                              setWallpaperPreviewError(false);
                            })
                            .catch(() => setWallpaperPreviewError(true));
                        }}
                        className="mt-2 block h-auto max-h-64 w-full rounded-lg border border-slate-700 object-contain"
                      />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Icon Theme</label>
                <select
                  value={content.siteSettings?.defaultIconTheme || 'fluent_3d'}
                  onChange={(e) => {
                    const iconTheme = e.target.value;
                    updateSiteSettings('defaultIconTheme', iconTheme);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="fluent_3d">Fluent 3D</option>
                  <option value="outline_tint">Tinted outline</option>
                </select>
              </div>
              <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Accent Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={content.siteSettings?.defaultAccentColor || '#0078d4'}
                  onChange={(e) => updateSiteSettings('defaultAccentColor', e.target.value)}
                  className="w-9 h-9 rounded-xl bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={content.siteSettings?.defaultAccentColor || '#0078d4'}
                  onChange={(e) => updateSiteSettings('defaultAccentColor', e.target.value)}
                  className="w-32 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white font-mono"
                />
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-semibold text-slate-400">Quick color presets</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Windows blue', color: '#0078d4' },
                    { name: 'Ocean', color: '#0ea5e9' },
                    { name: 'Violet', color: '#8b5cf6' },
                    { name: 'Emerald', color: '#10b981' },
                    { name: 'Rose', color: '#f43f5e' },
                    { name: 'Amber', color: '#f59e0b' },
                  ].map((preset) => (
                    <button key={preset.color} type="button" onClick={() => updateSiteSettings('defaultAccentColor', preset.color)} aria-label={`Set ${preset.name} accent`} aria-pressed={content.siteSettings?.defaultAccentColor === preset.color} title={preset.name} className={`appearance-accent-swatch bg-transparent h-8 w-8 rounded-full border-2 transition ${content.siteSettings?.defaultAccentColor === preset.color ? 'scale-110 border-white ring-2 ring-sky-400' : 'border-slate-700 hover:scale-105'}`} style={{ '--accent-swatch-color': preset.color } as React.CSSProperties} />
                  ))}
                </div>
              </div>
              </div>
            </div>
          </div>}
        </div>
      )}
      {skillDialog && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 p-4" role="presentation">
          <form
            onSubmit={handleSubmitSkillDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-dialog-title"
            className="skill-management-dialog max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-slate-700 bg-[#11141c] p-5 shadow-2xl"
          >
            <h3 id="skill-dialog-title" className="text-base font-bold text-white">
              {skillDialog === 'category'
                ? `${skillDialogCategoryId ? 'Edit' : 'Add'} Skill Category`
                : `${skillDialogEdit ? 'Edit' : 'Add'} Skill`}
            </h3>
            <div className="block text-xs font-semibold text-slate-300">
              <label htmlFor="skill-dialog-name">{skillDialog === 'category' ? 'Category name' : 'Skill name'}</label>
              <input
                id="skill-dialog-name"
                autoFocus
                required
                maxLength={100}
                value={skillDialogName}
                onChange={(event) => {
                  const value = event.target.value;
                  setSkillDialogName(value);
                  setSkillDialogIcon(skillDialog === 'category' ? getCategoryIconIdentifier(value) : value.trim() ? getSkillIconIdentifier(value) : '');
                  setErrorMessage(null);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
            {skillDialog === 'skill' && (
              <div className="block text-xs font-semibold text-slate-300">
                <label htmlFor="skill-dialog-category">Category</label>
                <select id="skill-dialog-category" required value={skillDialogCategoryId || ''} onChange={(event) => setSkillDialogCategoryId(event.target.value || null)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white">
                  <option value="" disabled>Select category</option>
                  {(content.skills || []).map((category: any, index: number) => {
                    const categoryKey = getSkillCategoryKey(category);
                    return <option key={categoryKey || index} value={categoryKey}>{category.title}</option>;
                  })}
                </select>
              </div>
            )}
            <div className="block text-xs font-semibold text-slate-300">
              {skillDialog === 'category' ? 'Category icon' : 'Technology icon'}
              <div className="mt-1.5 space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="flex items-center gap-3">
                  {skillDialog === 'category'
                    ? <SkillCategoryIcon name={skillDialogIcon} category={skillDialogName} className="h-9 w-9 shrink-0 text-sky-400" />
                    : skillDialogIcon && <SkillBrandIcon name={skillDialogName} iconIdentifier={skillDialogIcon} className="h-9 w-9" />}
                  {skillDialog === 'category'
                    ? <SkillCategoryIconPicker category={skillDialogName} value={skillDialogIcon} onChange={setSkillDialogIcon} />
                    : <SkillIconPicker name={skillDialogName} value={skillDialogIcon} onChange={setSkillDialogIcon} />}
                </div>
              </div>
            </div>
            {skillDialog === 'skill' && skillDialogName.trim() && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{skillDialogName}</p>
                  <p className="text-[10px] text-slate-400">Icon preview updates as you type; choose another icon to override.</p>
                </div>
              </div>
            )}
            {skillDialogDuplicateMessage && <p role="alert" className="text-xs text-rose-300">{skillDialogDuplicateMessage}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setSkillDialog(null); setSkillDialogEdit(null); }} className="skill-dialog-cancel h-10 rounded-lg border border-slate-600 px-4 text-xs font-semibold text-slate-100 transition-colors hover:border-slate-400 hover:bg-slate-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
                Cancel
              </button>
              <button type="submit" disabled={!skillDialogName.trim() || (skillDialog === 'skill' && !(content.skills || []).some((category: any) => getSkillCategoryKey(category) === skillDialogCategoryId))} className="skill-dialog-save h-10 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
