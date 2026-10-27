import mongoose from 'mongoose';
import { AdminContentDraftModel } from '../models/AdminContentDraft';
import { AdminContentRevisionModel } from '../models/AdminContentRevision';
import { SiteContentModel } from '../models/SiteContent';
import { AdminProjectDraftModel, ProjectModel } from '../models';
import { normalizeSkillCategories, validateSkillCategories } from './skillCatalog';

const CONTENT_KEY = 'primary_portfolio_content';
const MAX_CONTENT_BYTES = 1024 * 1024;
const SENSITIVE_FIELD = /password|secret|token|hash|credential|api[_-]?key|adminpin/i;

function stableContentState(value: unknown): string {
  const sortObjectKeys = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(sortObjectKeys);
    if (!current || typeof current !== 'object') return current;
    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortObjectKeys(child)]),
    );
  };
  return JSON.stringify(sortObjectKeys(value));
}

const CHANGE_SECTIONS: Record<string, string> = {
  profile: 'Profile & About', socials: 'Contact & Social', skills: 'Skills & Toolkit',
  experiences: 'Work Experience', education: 'Education', certifications: 'Certifications',
  capabilities: 'Capabilities', resumes: 'Resume files', siteSettings: 'Site & Appearance', projects: 'Projects',
};
const CHANGE_FIELDS: Record<string, string> = {
  name: 'Name', title: 'Title', tagline: 'Tagline', bio: 'Biography', avatar: 'Portrait',
  hiringStatus: 'Hiring status', email: 'Email', phone: 'Phone', location: 'Location',
  github: 'GitHub', linkedin: 'LinkedIn', instagram: 'Instagram', twitter: 'X / Twitter',
  socialLinks: 'Additional links', defaultTheme: 'Default theme', defaultWallpaper: 'Default wallpaper',
  defaultWallpaperUrl: 'Uploaded wallpaper', defaultIconTheme: 'Icon theme', defaultAccentColor: 'Accent color',
  emailFaviconEnabled: 'Email favicon in emails', socialImageUrl: 'Social sharing image', faviconUrl: 'Website favicon',
  siteTitle: 'Page title', metaDescription: 'Meta description', maintenanceMode: 'Maintenance mode',
  desktopShortcuts: 'Apps & shortcuts', taskbarPinnedApps: 'Taskbar pins', startPinnedApps: 'Start menu pins',
  adminAppEnabledInStart: 'Admin Start menu visibility', disabledApps: 'Available apps',
  role: 'Role', company: 'Company', period: 'Period', description: 'Description',
  institution: 'Institution', provider: 'Provider', active: 'Availability', file: 'PDF file', visible: 'Visibility',
};

const isRevisionMetadataField = (field: string) =>
  ['id', '_id', '__v', 'createdAt', 'updatedAt', 'sortOrder'].includes(field);

const getChangeItemKey = (value: unknown): string | null => {
  if (value === null || typeof value !== 'object') return `${typeof value}:${String(value)}`;
  const item = value as Record<string, unknown>;
  const key = item.appId ?? item.id ?? item._id ?? item.title ?? item.name ?? item.role ?? item.degree ?? item.label;
  return typeof key === 'string' || typeof key === 'number' ? `${typeof key}:${key}` : null;
};

const getChangeItemLabel = (value: unknown, index: number): string => {
  if (!value || typeof value !== 'object') return String(value ?? `Item ${index + 1}`);
  const item = value as Record<string, unknown>;
  return String(item.name || item.title || item.role || item.degree || item.label || item.appId || `Item ${index + 1}`);
};

const LEGACY_DESKTOP_SHORTCUTS = [
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
const LEGACY_TASKBAR_PINS = ['explorer', 'browser', 'terminal', 'about', 'projects', 'settings'];
const LEGACY_START_PINS = [
  'about', 'projects', 'resume', 'contact', 'explorer', 'terminal', 'browser',
  'notepad', 'settings', 'taskmanager', 'minesweeper', 'snake', 'calculator',
];

function normalizeLegacyLayoutForDiff(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const content = value as Record<string, unknown>;
  const siteSettings = content.siteSettings;
  if (!siteSettings || typeof siteSettings !== 'object' || Array.isArray(siteSettings)) return value;
  const settings = siteSettings as Record<string, unknown>;
  return {
    ...content,
    siteSettings: {
      ...settings,
      desktopShortcuts: settings.desktopShortcuts ?? LEGACY_DESKTOP_SHORTCUTS,
      taskbarPinnedApps: settings.taskbarPinnedApps ?? LEGACY_TASKBAR_PINS,
      startPinnedApps: settings.startPinnedApps ?? LEGACY_START_PINS,
      adminAppEnabledInStart: settings.adminAppEnabledInStart ?? false,
    },
  };
}

export function summarizeChanges(before: unknown, after: unknown): string[] {
  const changes = new Set<string>();
  const describeBoolean = (field: string, value: boolean) => {
    if (field === 'visible') return value ? 'Visible' : 'Hidden';
    if (field === 'active') return value ? 'Active' : 'Inactive';
    if (field === 'maintenanceMode') return value ? 'On' : 'Off';
    return value ? 'Enabled' : 'Disabled';
  };
  const visit = (oldValue: unknown, newValue: unknown, path: string[]) => {
    if (stableContentState(oldValue) === stableContentState(newValue)) return;
    const key = path[path.length - 1] || '';
    if (/password|secret|token|hash|credential|api[_-]?key|adminpin/i.test(key) ||
      path[0] === 'securitySettings' || path.some(isRevisionMetadataField)) return;
    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
      const oldItems = Array.isArray(oldValue) ? oldValue : [];
      const newItems = Array.isArray(newValue) ? newValue : [];
      const oldKeys = oldItems.map(getChangeItemKey);
      const newKeys = newItems.map(getChangeItemKey);
      const canMatchByKey = oldKeys.every((itemKey): itemKey is string => itemKey !== null) &&
        newKeys.every((itemKey): itemKey is string => itemKey !== null) &&
        new Set(oldKeys).size === oldKeys.length &&
        new Set(newKeys).size === newKeys.length;
      if (canMatchByKey) {
        const oldByKey = new Map(oldItems.map((item, index) => [oldKeys[index], { item, index }]));
        const newByKey = new Map(newItems.map((item, index) => [newKeys[index], { item, index }]));
        for (const [itemKey, oldEntry] of oldByKey) {
          const newEntry = newByKey.get(itemKey);
          if (!newEntry) {
            changes.add(`${formatChangePath(path)} · ${getChangeItemLabel(oldEntry.item, oldEntry.index)} · Removed`);
          } else {
            visit(oldEntry.item, newEntry.item, [...path, getChangeItemLabel(newEntry.item, newEntry.index)]);
          }
        }
        for (const [itemKey, newEntry] of newByKey) {
          if (!oldByKey.has(itemKey)) {
            changes.add(`${formatChangePath(path)} · ${getChangeItemLabel(newEntry.item, newEntry.index)} · Added`);
          }
        }
        if (oldKeys.length === newKeys.length && oldKeys.some((itemKey, index) => itemKey !== newKeys[index])) {
          changes.add(`${formatChangePath(path)} · Display order`);
        }
        return;
      }
      for (let index = 0; index < Math.max(oldItems.length, newItems.length); index += 1) {
        if (index >= oldItems.length) {
          changes.add(`${formatChangePath(path)} · ${getChangeItemLabel(newItems[index], index)} · Added`);
        } else if (index >= newItems.length) {
          changes.add(`${formatChangePath(path)} · ${getChangeItemLabel(oldItems[index], index)} · Removed`);
        } else {
          visit(oldItems[index], newItems[index], [...path, getChangeItemLabel(newItems[index], index)]);
        }
      }
      return;
    }
    if ((oldValue && typeof oldValue === 'object' && !Array.isArray(oldValue)) || (newValue && typeof newValue === 'object' && !Array.isArray(newValue))) {
      const oldRecord = oldValue && typeof oldValue === 'object' && !Array.isArray(oldValue) ? oldValue as Record<string, unknown> : {};
      const newRecord = newValue && typeof newValue === 'object' && !Array.isArray(newValue) ? newValue as Record<string, unknown> : {};
      for (const child of new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])) {
        if (!isRevisionMetadataField(child)) visit(oldRecord[child], newRecord[child], [...path, child]);
      }
      return;
    }
    if (typeof oldValue === 'boolean' && typeof newValue === 'boolean') {
      changes.add(`${formatChangePath(path)}: ${describeBoolean(key, oldValue)} → ${describeBoolean(key, newValue)}`);
      return;
    }
    changes.add(formatChangePath(path));
  };
  visit(normalizeLegacyLayoutForDiff(before), normalizeLegacyLayoutForDiff(after), []);
  return [...changes].filter(Boolean);
}

function formatChangePath(path: string[]): string {
  if (!path.length) return 'Portfolio content';
  const [root, ...rest] = path;
  const details = rest.map((part) => {
    if (/^\d+$/.test(part)) return `Item ${Number(part) + 1}`;
    return root === 'profile' && part === 'title' ? 'Headline' : CHANGE_FIELDS[part] || part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
  });
  return [CHANGE_SECTIONS[root] || root.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()), ...details].join(' · ');
}

export interface ContentStudioSnapshot {
  draft: Record<string, unknown>;
  draftUpdatedAt: Date;
  published: Record<string, unknown>;
  publishedAt: string | null;
  isPublished: boolean;
}

function publicContent(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const clonePublicValue = (source: unknown, depth = 0): unknown => {
    if (source === null || typeof source !== 'object') return source;
    if (source instanceof Date) return source.toISOString();
    const bsonValue = source as { toHexString?: () => string };
    if (typeof bsonValue.toHexString === 'function') return bsonValue.toHexString();
    if (Array.isArray(source)) return source.map((child) => clonePublicValue(child, depth + 1));

    const copy: Record<string, unknown> = {};
    Object.entries(source).forEach(([key, child]) => {
      if (
        (depth === 0 && (key === '_id' || key === '__v' || key === 'key' || key === 'updatedAt' || key === 'createdAt')) ||
        key === 'securitySettings' ||
        SENSITIVE_FIELD.test(key)
      ) return;
      copy[key] = clonePublicValue(child, depth + 1);
    });
    return copy;
  };

  const content = clonePublicValue(value) as Record<string, unknown>;
  content.skills = normalizeSkillCategories(content.skills);
  return content;
}

function isPortfolioMediaPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false;
  try {
    const url = new URL(value, 'https://portfolio.local');
    if (url.origin !== 'https://portfolio.local' || url.hash) return false;
    const prefix = '/api/portfolio-media/';
    if (!url.pathname.startsWith(prefix)) return false;
    const filename = url.pathname.slice(prefix.length);
    if (!filename || filename.includes('/')) return false;
    const decodedFilename = decodeURIComponent(filename);
    if (!decodedFilename || decodedFilename === '.' || decodedFilename === '..' ||
      decodedFilename.includes('/') || decodedFilename.includes('\\')) return false;

    const ids = url.searchParams.getAll('id');
    if (ids.length === 0) return /^file-[A-Za-z0-9-]+$/.test(decodedFilename);
    return ids.length === 1 &&
      url.searchParams.size === 1 &&
      /^file-[A-Za-z0-9-]+$/.test(ids[0]);
  } catch {
    return false;
  }
}

function validateContent(content: Record<string, unknown>): string | null {
  if (!content.profile || typeof content.profile !== 'object' || Array.isArray(content.profile)) {
    return 'Content must include a profile object.';
  }
  const profile = content.profile as Record<string, unknown>;
  const contactVisibility = profile.contactVisibility;
  if (contactVisibility !== undefined) {
    if (!contactVisibility || typeof contactVisibility !== 'object' || Array.isArray(contactVisibility)) {
      return 'Contact visibility settings must be an object.';
    }
    for (const [field, visible] of Object.entries(contactVisibility)) {
      if (typeof visible !== 'boolean') return `Contact visibility for ${field} must be true or false.`;
    }
  }
  for (const field of ['skills', 'experiences', 'education', 'resumes', 'certifications', 'capabilities']) {
    if (content[field] !== undefined && !Array.isArray(content[field])) {
      return `${field} must be an array.`;
    }
    const skillValidationError = validateSkillCategories(content.skills);
    if (skillValidationError) return skillValidationError;
  }
  if (Array.isArray(content.capabilities)) {
    if (content.capabilities.length > 100) return 'Capabilities must contain no more than 100 entries.';
    for (const [index, entry] of content.capabilities.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `Capability ${index + 1} must be an object.`;
      const capability = entry as Record<string, unknown>;
      for (const field of ['title', 'icon', 'description']) {
        if (capability[field] !== undefined && typeof capability[field] !== 'string') return `Capability ${index + 1} ${field} must be text.`;
      }
      if (capability.visible !== undefined && typeof capability.visible !== 'boolean') return `Capability ${index + 1} visibility must be true or false.`;
    }
  }
  if (Array.isArray(content.certifications)) {
    if (content.certifications.length > 100) return 'Certifications must contain no more than 100 entries.';
    for (const [index, entry] of content.certifications.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `Certification ${index + 1} must be an object.`;
      const certificate = entry as Record<string, unknown>;
      for (const field of ['title', 'provider', 'description', 'image', 'artLabel', 'artDetail', 'link']) {
        if (certificate[field] !== undefined && typeof certificate[field] !== 'string') return `Certification ${index + 1} ${field} must be text.`;
      }
      for (const field of ['experiences', 'education', 'socialLinks'] as const) {
        const records = field === 'socialLinks'
          ? (profile.socialLinks as unknown)
          : content[field];
        if (records === undefined) continue;
        if (!Array.isArray(records)) return `${field} must be an array.`;
        for (const [index, entry] of records.entries()) {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `${field} item ${index + 1} must be an object.`;
          const visible = (entry as Record<string, unknown>).visible;
          if (visible !== undefined && typeof visible !== 'boolean') return `${field} item ${index + 1} visibility must be true or false.`;
        }
      }
      if (certificate.visible !== undefined && typeof certificate.visible !== 'boolean') return `Certification ${index + 1} visibility must be true or false.`;
    }
  }
  if (Array.isArray(content.resumes)) {
    if (content.resumes.length > 50) return 'Resumes must contain no more than 50 entries.';
    const resumeIds = new Set<string>();
    for (const [index, entry] of content.resumes.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `Resume ${index + 1} must be an object.`;
      const resume = entry as Record<string, unknown>;
      if (typeof resume.id !== 'string' || !resume.id.trim() || resume.id.length > 100 || resumeIds.has(resume.id)) {
        return `Resume ${index + 1} must have a unique valid identifier.`;
      }
      resumeIds.add(resume.id);
      if (typeof resume.title !== 'string' || !resume.title.trim() || resume.title.length > 120) {
        return `Resume ${index + 1} must have a title of 1 to 120 characters.`;
      }
      if (typeof resume.file !== 'string' || resume.file.length > 2048 ||
        (resume.file && !resume.file.startsWith('/') && !/^https?:\/\//i.test(resume.file)) ||
        resume.file.startsWith('//') || resume.file.includes('\\') ||
        resume.file.split('/').includes('..') ||
        (resume.file.startsWith('/api/') && !isPortfolioMediaPath(resume.file))) {
        return `Resume ${index + 1} must have an http(s) URL or a local portfolio file path.`;
      }
      if (typeof resume.active !== 'boolean') return `Resume ${index + 1} active state must be true or false.`;
    }
  }
  if (content.siteSettings !== undefined && (!content.siteSettings || typeof content.siteSettings !== 'object' || Array.isArray(content.siteSettings))) {
    return 'siteSettings must be an object.';
  }
  const siteSettings = content.siteSettings as Record<string, unknown> | undefined;
  const desktopShortcuts = siteSettings?.desktopShortcuts;
  if (desktopShortcuts !== undefined) {
    if (!Array.isArray(desktopShortcuts) || desktopShortcuts.length > 100) {
      return 'Desktop shortcuts must be an array containing no more than 100 entries.';
    }
    const shortcutIds = new Set<string>();
    const shortcutAppIds = new Set<string>();
    for (const [index, shortcutValue] of desktopShortcuts.entries()) {
      if (!shortcutValue || typeof shortcutValue !== 'object' || Array.isArray(shortcutValue)) {
        return `Desktop shortcut ${index + 1} must be an object.`;
      }
      const shortcut = shortcutValue as Record<string, unknown>;
      if (['id', 'appId', 'name', 'icon'].some((field) => typeof shortcut[field] !== 'string' || !(shortcut[field] as string).trim())) {
        return `Desktop shortcut ${index + 1} must include an ID, app ID, name, and icon.`;
      }
      if (shortcut.type !== 'app') return `Desktop shortcut ${index + 1} must reference an app.`;
      const position = shortcut.position;
      if (!position || typeof position !== 'object' || Array.isArray(position)) {
        return `Desktop shortcut ${index + 1} must include a grid position.`;
      }
      const { gridX, gridY } = position as Record<string, unknown>;
      if (![gridX, gridY].every((coordinate) => Number.isSafeInteger(coordinate) && Number(coordinate) >= 0)) {
        return `Desktop shortcut ${index + 1} must have non-negative integer grid coordinates.`;
      }
      const id = shortcut.id as string;
      const appId = shortcut.appId as string;
      if (shortcutIds.has(id) || shortcutAppIds.has(appId)) return 'Desktop shortcut IDs and app IDs must be unique.';
      shortcutIds.add(id);
      shortcutAppIds.add(appId);
    }
  }
  for (const field of ['taskbarPinnedApps', 'startPinnedApps'] as const) {
    const appIds = siteSettings?.[field];
    if (appIds === undefined) continue;
    if (!Array.isArray(appIds) || appIds.length > 100 || appIds.some((id) => typeof id !== 'string' || !id.trim())) {
      return `${field} must be an array of no more than 100 app IDs.`;
    }
    if (new Set(appIds).size !== appIds.length) return `${field} cannot contain duplicate app IDs.`;
  }
  if (siteSettings?.adminAppEnabledInStart !== undefined && typeof siteSettings.adminAppEnabledInStart !== 'boolean') {
    return 'Admin Start menu visibility must be true or false.';
  }
  for (const [field, label] of [['socialImageUrl', 'Social preview image'], ['faviconUrl', 'Favicon']] as const) {
    const imageUrl = siteSettings?.[field];
    if (imageUrl === undefined) continue;
    if (typeof imageUrl !== 'string' || imageUrl.length > 2048) {
      return `${label} URL must be text no longer than 2,048 characters.`;
    }
    if (imageUrl && !/^https?:\/\//i.test(imageUrl) &&
      (!imageUrl.startsWith('/') || imageUrl.startsWith('//') ||
        (imageUrl.startsWith('/api/') && !isPortfolioMediaPath(imageUrl)) ||
        imageUrl.includes('\\') || imageUrl.split('/').includes('..'))) {
      return `${label} URL must use http(s) or a public local portfolio path.`;
    }
  }
  if (Buffer.byteLength(JSON.stringify(content), 'utf8') > MAX_CONTENT_BYTES) {
    return 'Portfolio content must be smaller than 1 MB.';
  }
  return null;
}

function requireMongo(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Portfolio content storage is unavailable.');
  }
}

export class ContentStudioService {
  public async getSnapshot(fallbackContent: unknown): Promise<ContentStudioSnapshot> {
    requireMongo();
    const [publishedDoc, draftDoc] = await Promise.all([
      SiteContentModel.findOne({ key: CONTENT_KEY }).lean(),
      AdminContentDraftModel.findOne({ key: CONTENT_KEY }).lean(),
    ]);
    const published = publicContent(publishedDoc || fallbackContent);
    const draftContent = draftDoc
      ? publicContent(draftDoc.content)
      : published;
    const draft = draftDoc || await AdminContentDraftModel.create({
      key: CONTENT_KEY,
      content: draftContent,
      updatedBy: 'system-initialization',
    });

    return {
      draft: draftContent,
      draftUpdatedAt: draft.updatedAt,
      published,
      publishedAt: publishedDoc?.updatedAt ? String(publishedDoc.updatedAt) : null,
      isPublished: stableContentState(draftContent) === stableContentState(published),
    };
  }

  public async saveDraft(content: unknown, userId: string): Promise<ContentStudioSnapshot> {
    requireMongo();
    const safeContent = publicContent(content);
    const validationError = validateContent(safeContent);
    if (validationError) throw new Error(validationError);

    await AdminContentDraftModel.findOneAndUpdate(
      { key: CONTENT_KEY },
      { $set: { content: safeContent, updatedBy: userId } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
    return this.getSnapshot(safeContent);
  }

  public async discardDraft(userId: string): Promise<ContentStudioSnapshot> {
    requireMongo();
    const publishedDoc = await SiteContentModel.findOne({ key: CONTENT_KEY }).lean();
    const published = publicContent(publishedDoc);
    const validationError = validateContent(published);
    if (validationError) throw new Error(validationError);
    await AdminContentDraftModel.findOneAndUpdate(
      { key: CONTENT_KEY },
      { $set: { content: published, updatedBy: userId } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
    return this.getSnapshot(published);
  }

  public async restoreBackup(
    publishedContent: unknown,
    draftContent: unknown,
    userId: string,
    onRevisionCreated?: (revisionId: string) => void
  ): Promise<ContentStudioSnapshot> {
    requireMongo();
    const published = publicContent(publishedContent);
    const draft = publicContent(draftContent);
    const publishedError = validateContent(published);
    const draftError = validateContent(draft);
    if (publishedError || draftError) throw new Error(publishedError || draftError || 'Backup content is invalid.');

    const current = await SiteContentModel.findOne({ key: CONTENT_KEY }).lean();
    if (current) {
      const revision = await AdminContentRevisionModel.create({
        key: CONTENT_KEY,
        content: publicContent(current),
        publishedBy: userId,
        publishedAt: new Date(),
      });
      onRevisionCreated?.(String(revision._id));
    }
    const updatedAt = new Date().toISOString();
    const writes = await Promise.allSettled([
      SiteContentModel.findOneAndUpdate(
        { key: CONTENT_KEY },
        { $set: { ...published, key: CONTENT_KEY, updatedAt } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      ),
      AdminContentDraftModel.findOneAndUpdate(
        { key: CONTENT_KEY },
        { $set: { content: draft, updatedBy: userId } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      ),
    ]);
    const failedWrite = writes.find((result) => result.status === 'rejected');
    if (failedWrite?.status === 'rejected') throw failedWrite.reason;
    return this.getSnapshot(published);
  }

  public async publishDraft(userId: string): Promise<ContentStudioSnapshot> {
    requireMongo();
    const draft = await AdminContentDraftModel.findOne({ key: CONTENT_KEY }).lean();
    if (!draft) throw new Error('Save a draft before publishing.');
    const content = publicContent(draft.content);
    const validationError = validateContent(content);
    if (validationError) throw new Error(validationError);

    const [previousLiveDocument, previousProjectDocuments] = await Promise.all([
      SiteContentModel.findOne({ key: CONTENT_KEY }).lean(),
      ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean(),
    ]);
    const previousLiveContent = previousLiveDocument ? publicContent(previousLiveDocument) : null;
    const previousLiveProjects = previousProjectDocuments.map(({ _id: _mongoId, ...project }) => project as Record<string, unknown>);
    const publishedAt = new Date();
    const publishedDocument = await SiteContentModel.findOneAndUpdate(
      { key: CONTENT_KEY },
      { $set: { ...content, key: CONTENT_KEY, updatedAt: publishedAt.toISOString() } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    const publishedContent = publicContent(publishedDocument || { ...content, key: CONTENT_KEY, updatedAt: publishedAt.toISOString() });
    if (previousLiveDocument && previousLiveContent) {
      const latestRevision = await AdminContentRevisionModel.findOne({ key: CONTENT_KEY })
        .sort({ publishedAt: -1 })
        .lean();
      const previousState = stableContentState({ content: previousLiveContent, projects: previousLiveProjects });
      const latestRevisionState = latestRevision
        ? stableContentState({
            content: publicContent(latestRevision.content),
            projects: Array.isArray(latestRevision.projects) ? latestRevision.projects : [],
          })
        : '';
      if (previousState !== latestRevisionState) {
        const previousPublishedAt = previousLiveDocument.updatedAt
          ? new Date(previousLiveDocument.updatedAt)
          : publishedAt;
        await AdminContentRevisionModel.create({
          key: CONTENT_KEY,
          content: previousLiveContent,
          projects: previousLiveProjects,
          publishedBy: userId,
          publishedAt: Number.isNaN(previousPublishedAt.getTime()) ? publishedAt : previousPublishedAt,
        });
      }
    }
    // Keep the editable draft byte-for-byte aligned with what Mongo actually
    // persisted, so schema casting/defaults cannot make settings drift after refresh.
    await AdminContentDraftModel.findOneAndUpdate(
      { key: CONTENT_KEY },
      { $set: { content: publishedContent, updatedBy: userId } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    return this.getSnapshot(publishedContent);
  }

  public async listRevisions() {
    requireMongo();
    const storedRevisions = await AdminContentRevisionModel.find({ key: CONTENT_KEY })
      .sort({ publishedAt: -1 })
      .limit(50)
      .lean();
    const liveDocument = await SiteContentModel.findOne({ key: CONTENT_KEY }).lean();
    const liveProjectDocs = await ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean();
    const liveProjects = liveProjectDocs.map(({ _id: _mongoId, ...project }) => project as Record<string, unknown>);
    const liveContent = publicContent(liveDocument || {});
    const liveState = stableContentState({ content: liveContent, projects: liveProjects });
    const versions = [
      ...(liveDocument ? [{
        id: 'current-live',
        publishedAt: (liveDocument as any).updatedAt || new Date(),
        publishedBy: '',
        content: liveContent,
        projects: liveProjects,
        isCurrent: true,
      }] : []),
      ...storedRevisions
        .map((revision) => ({
          id: String(revision._id),
          publishedAt: revision.publishedAt,
          publishedBy: revision.publishedBy,
          content: publicContent(revision.content),
          projects: Array.isArray(revision.projects) ? revision.projects : [],
          isCurrent: false,
        }))
        .filter((revision) => stableContentState({
          content: revision.content,
          projects: revision.projects,
        }) !== liveState),
    ];
    return versions.map((revision, index) => {
      const content = revision.content;
      const profile = (content.profile || {}) as Record<string, unknown>;
      const revisionState = stableContentState({ content, projects: revision.projects || [] });
      // Skip duplicate publishes when finding the comparison point. This keeps
      // a version's history useful even when identical snapshots were saved in
      // between the version that actually changed and the current entry.
      const comparison = versions.slice(index + 1).find((candidate) =>
        stableContentState({ content: candidate.content, projects: candidate.projects || [] }) !== revisionState,
      );
      const comparisonContent = comparison?.content || {};
      const comparisonProjects = comparison?.projects || [];
      return {
        id: revision.id,
        isCurrent: revision.isCurrent,
        publishedAt: revision.publishedAt,
        publishedBy: revision.publishedBy,
        profileName: profile.name || '',
        profileTitle: profile.title || '',
        changes: comparison
          ? [
              ...summarizeChanges(comparisonContent, content),
              ...summarizeChanges({ projects: comparisonProjects }, { projects: revision.projects || [] }),
            ]
          : ['Initial published version'],
        snapshotDetails: [],
        sectionCounts: {
          skills: Array.isArray(content.skills) ? content.skills.length : 0,
          experiences: Array.isArray(content.experiences) ? content.experiences.length : 0,
          education: Array.isArray(content.education) ? content.education.length : 0,
        },
      };
    });
  }

  public async deleteRevision(revisionId: string): Promise<boolean> {
    requireMongo();
    if (!/^[a-f\d]{24}$/i.test(revisionId)) return false;
    const deleted = await AdminContentRevisionModel.findOneAndDelete({ _id: revisionId, key: CONTENT_KEY });
    return Boolean(deleted);
  }

  public async restoreRevision(revisionId: string, userId: string): Promise<ContentStudioSnapshot | null> {
    requireMongo();
    let revisionContent: unknown;
    let revisionProjects: unknown;
    if (revisionId === 'current-live') {
      const [liveContent, liveProjects] = await Promise.all([
        SiteContentModel.findOne({ key: CONTENT_KEY }).lean(),
        ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean(),
      ]);
      if (!liveContent) return null;
      revisionContent = liveContent;
      revisionProjects = liveProjects.map(({ _id: _mongoId, ...project }) => project);
    } else {
      if (!/^[a-f\d]{24}$/i.test(revisionId)) return null;
      const revision = await AdminContentRevisionModel.findOne({ _id: revisionId, key: CONTENT_KEY }).lean();
      if (!revision) return null;
      revisionContent = revision.content;
      revisionProjects = revision.projects;
    }

    const content = publicContent(revisionContent);
    const validationError = validateContent(content);
    if (validationError) throw new Error(validationError);
    const projects = Array.isArray(revisionProjects) ? revisionProjects : [];
    await Promise.all([
      AdminContentDraftModel.findOneAndUpdate(
        { key: CONTENT_KEY },
        { $set: { content, updatedBy: userId } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      ),
      AdminProjectDraftModel.findOneAndUpdate(
        { key: 'primary_portfolio_projects' },
        { $set: { projects, updatedBy: userId } },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      ),
    ]);
    return this.getSnapshot(content);
  }
}

export const contentStudioService = new ContentStudioService();
