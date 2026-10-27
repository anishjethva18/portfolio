import type { FileItem } from '../types';
import { APPS_LIST } from '../data/portfolioData';

export const D_DRIVE_FOLDER_PATHS = {
  desktop: 'D:/Desktop',
  downloads: 'D:/Downloads',
  documents: 'D:/Documents',
  resumes: 'D:/Documents/Resumes',
  pictures: 'D:/Pictures',
  wallpapers: 'D:/Pictures/Wallpapers',
  photoCaptures: 'D:/Pictures/Camera',
  videos: 'D:/Videos',
  videoCaptures: 'D:/Videos/Camera',
  audio: 'D:/Audio',
  projects: 'D:/Projects',
  certificates: 'D:/Certificates',
  aboutMe: 'D:/About Me',
} as const;

type PublishedFileRecord = {
  id?: string;
  title?: string;
  name?: string;
  file?: string;
  image?: string;
  document?: string;
  documentUrl?: string;
  active?: boolean;
  visible?: boolean;
  modified?: string;
  size?: string;
};

export type PublicMediaAsset = { name: string; url: string };
export type PublicMediaManifest = {
  audio: PublicMediaAsset[];
  videos: PublicMediaAsset[];
  wallpapers: PublicMediaAsset[];
  downloads: PublicMediaAsset[];
};

export type PublishedDriveContent = {
  profile?: { resumeUrl?: unknown; avatar?: unknown };
  resumes?: PublishedFileRecord[];
  certifications?: PublishedFileRecord[];
  siteSettings?: {
    defaultWallpaperUrl?: unknown;
    defaultWallpaperName?: unknown;
    socialImageUrl?: unknown;
    faviconUrl?: unknown;
    disabledApps?: unknown;
    adminAppEnabledInStart?: unknown;
  };
};

export type PublishedDriveProject = {
  id?: string;
  title?: string;
  tagline?: string;
  description?: string;
  category?: string;
  technologies?: string[];
  features?: string[];
  githubUrl?: string;
  liveUrl?: string;
  overview?: string;
  summary?: string;
  visible?: boolean;
  caseStudy?: {
    goal?: string;
    approach?: string;
    architecture?: string[];
    engineeringHighlights?: string[];
    delivered?: string;
  };
};

const folders: Array<{ id: string; name: string; path: string; parentId: string }> = [
  { id: 'virtual-d-desktop', name: 'Desktop', path: D_DRIVE_FOLDER_PATHS.desktop, parentId: 'D:' },
  { id: 'virtual-d-downloads', name: 'Downloads', path: D_DRIVE_FOLDER_PATHS.downloads, parentId: 'D:' },
  { id: 'virtual-d-documents', name: 'Documents', path: D_DRIVE_FOLDER_PATHS.documents, parentId: 'D:' },
  { id: 'virtual-d-resumes', name: 'Resumes', path: D_DRIVE_FOLDER_PATHS.resumes, parentId: D_DRIVE_FOLDER_PATHS.documents },
  { id: 'virtual-d-pictures', name: 'Pictures', path: D_DRIVE_FOLDER_PATHS.pictures, parentId: 'D:' },
  { id: 'virtual-d-wallpapers', name: 'Wallpapers', path: D_DRIVE_FOLDER_PATHS.wallpapers, parentId: D_DRIVE_FOLDER_PATHS.pictures },
  { id: 'virtual-d-photo-camera', name: 'Camera Picture', path: D_DRIVE_FOLDER_PATHS.photoCaptures, parentId: D_DRIVE_FOLDER_PATHS.pictures },
  { id: 'virtual-d-videos', name: 'Videos', path: D_DRIVE_FOLDER_PATHS.videos, parentId: 'D:' },
  { id: 'virtual-d-video-camera', name: 'Camera Video', path: D_DRIVE_FOLDER_PATHS.videoCaptures, parentId: D_DRIVE_FOLDER_PATHS.videos },
  { id: 'virtual-d-audio', name: 'Audio', path: D_DRIVE_FOLDER_PATHS.audio, parentId: 'D:' },
  { id: 'virtual-d-projects', name: 'Projects', path: D_DRIVE_FOLDER_PATHS.projects, parentId: 'D:' },
  { id: 'virtual-d-certificates', name: 'Certificates', path: D_DRIVE_FOLDER_PATHS.certificates, parentId: 'D:' },
  { id: 'virtual-d-about-me', name: 'About Me', path: D_DRIVE_FOLDER_PATHS.aboutMe, parentId: 'D:' },
];

const dDriveRoots = [
  D_DRIVE_FOLDER_PATHS.desktop,
  D_DRIVE_FOLDER_PATHS.downloads,
  D_DRIVE_FOLDER_PATHS.documents,
  D_DRIVE_FOLDER_PATHS.pictures,
  D_DRIVE_FOLDER_PATHS.videos,
  D_DRIVE_FOLDER_PATHS.audio,
  D_DRIVE_FOLDER_PATHS.projects,
  D_DRIVE_FOLDER_PATHS.certificates,
  D_DRIVE_FOLDER_PATHS.aboutMe,
].map((path) => path.toLowerCase());

const MEDIA_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'm4v']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
const HIDDEN_WALLPAPER_NAMES = new Set([
  'cloud_architecture.png',
  'data_flow.png',
  'developer_network.png',
  'midnight_sports_car.jpg',
  'mountain_lake_landscape.jpg',
  'neural_code.png',
  'stadium_night.jpg',
  'superbike_sunset.jpg',
]);

const isHiddenWallpaperName = (name: string): boolean =>
  HIDDEN_WALLPAPER_NAMES.has(name.trim().toLowerCase());

const isSafeFileUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value.trim()) return false;
  const url = value.trim();
  return url.startsWith('/api/portfolio-media/') ||
    url.startsWith('/downloads/') ||
    /^https?:\/\//i.test(url);
};

const getUrlExtension = (value: string, fallback: string): string => {
  try {
    const pathname = new URL(value, 'https://portfolio.invalid').pathname;
    const basename = pathname.split('/').filter(Boolean).pop() || '';
    const dot = basename.lastIndexOf('.');
    if (dot < 0) return fallback;
    const extension = basename.slice(dot + 1).toLowerCase();
    return /^[a-z0-9]{1,8}$/.test(extension) ? extension : fallback;
  } catch {
    return fallback;
  }
};

const safeName = (value: string, fallback: string): string => {
  const name = value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '');
  return name || fallback;
};

const pathFileName = (url: string): string => {
  try {
    const pathname = new URL(url, 'https://portfolio.invalid').pathname;
    const segment = pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
};

const referenceFile = (
  id: string,
  name: string,
  extension: string,
  content: string,
  parentId: string,
  modified = 'Published'
): FileItem => ({
  id,
  name,
  path: `${parentId}/${name}`,
  type: 'file',
  extension,
  content,
  parentId,
  modified,
  readOnly: true,
});

const mapStoredFile = (source: FileItem, parentId: string): FileItem => ({
  ...source,
  id: `virtual-ref-${source.id}`,
  path: `${parentId}/${source.name}`,
  parentId,
  readOnly: true,
});

const isBelow = (path: string, parent: string): boolean =>
  path.toLowerCase().startsWith(`${parent.toLowerCase()}/`);

const hasCameraCaptureName = (file: Pick<FileItem, 'name'>): boolean =>
  /^(photo|video)_\d{4}[-_]?\d{2}[-_]?\d{2}[_-]\d{2}[-_]?\d{2}[-_]?\d{2}/i.test(file.name);

const publicMediaDestinations = {
  audio: { path: D_DRIVE_FOLDER_PATHS.audio, extensions: AUDIO_EXTENSIONS },
  videos: { path: D_DRIVE_FOLDER_PATHS.videos, extensions: VIDEO_EXTENSIONS },
  wallpapers: { path: D_DRIVE_FOLDER_PATHS.wallpapers, extensions: MEDIA_EXTENSIONS },
  downloads: { path: D_DRIVE_FOLDER_PATHS.downloads, extensions: undefined },
} as const;

const createBundledMediaFiles = (manifest: PublicMediaManifest): FileItem[] =>
  Object.entries(publicMediaDestinations).flatMap(([group, destination]) => {
    const assets = manifest[group as keyof PublicMediaManifest] || [];
    return assets.flatMap((asset) => {
      if (group === 'wallpapers' && isHiddenWallpaperName(asset.name)) return [];
      const extension = getUrlExtension(asset.name, '').toLowerCase();
      if (!extension || destination.extensions && !destination.extensions.has(extension)) return [];
      const safeName = safeNameForBundledMedia(asset.name);
      if (!safeName || !asset.url.startsWith(`/${group}/`)) return [];
      return [{
        id: `bundled-${group}-${safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: safeName,
        path: `${destination.path}/${safeName}`,
        type: 'file' as const,
        extension,
        content: asset.url,
        parentId: destination.path,
        modified: 'Bundled',
        readOnly: true,
      }];
    });
  });

const safeNameForBundledMedia = (value: string): string =>
  value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '');

export const isCanonicalCameraCapture = (file: FileItem): boolean => {
  const parent = file.parentId.replace(/\\/g, '/').toLowerCase();
  return (
    (parent === D_DRIVE_FOLDER_PATHS.photoCaptures.toLowerCase() ||
      parent === D_DRIVE_FOLDER_PATHS.videoCaptures.toLowerCase()) &&
    hasCameraCaptureName(file)
  );
};

export const isLegacyDDrivePath = (path: string): boolean => /^D:\//i.test(path.replace(/\\/g, '/'));

export const isCanonicalDDriveFolderPath = (path: string): boolean =>
  isCanonicalDDrivePath(path);

export const isCanonicalDDrivePath = (path: string): boolean => {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return dDriveRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
};

export const normalizeVfsDestinationPath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const lower = normalized.toLowerCase();
  return lower === 'c:' || /^c:\//i.test(normalized)
    ? D_DRIVE_FOLDER_PATHS.documents
    : normalized;
};

export const normalizeVirtualDriveFiles = (
  sourceFiles: FileItem[],
  ensureFolders = true,
  hideLegacyDEntries = false
): FileItem[] => {
  const migrated = sourceFiles.flatMap((source) => {
    const normalizedSourcePath = source.path.replace(/\\/g, '/').replace(/\/+$/, '');
    if (/^C:\//i.test(normalizedSourcePath) || isMarkedDocumentsDemoFile(source)) return [];
    const obsoleteVideosPath = `${D_DRIVE_FOLDER_PATHS.videos}/Videos`;
    if (normalizedSourcePath.toLowerCase() === obsoleteVideosPath.toLowerCase()) return [];
    if (normalizedSourcePath.toLowerCase().startsWith(`${obsoleteVideosPath.toLowerCase()}/`)) {
      const path = `${D_DRIVE_FOLDER_PATHS.videos}${normalizedSourcePath.slice(obsoleteVideosPath.length)}`;
      return [{
        ...source,
        path,
        parentId: path.slice(0, path.lastIndexOf('/')),
        readOnly: false,
        legacyDHidden: false,
      }];
    }
    if (isLegacyDDrivePath(source.path)) {
      return hideLegacyDEntries && !source.legacyDHidden
        ? [{ ...source, legacyDHidden: true }]
        : [source];
    }
    return [source];
  });

  if (ensureFolders) {
    const existingPaths = new Set(migrated.map((file) => file.path.replace(/\\/g, '/').toLowerCase()));
    for (const folder of folders) {
      const key = folder.path.toLowerCase();
      if (existingPaths.has(key)) continue;
      migrated.push({ ...folder, type: 'folder', modified: '2026-10-19', readOnly: false });
      existingPaths.add(key);
    }
  }
  return migrated;
};

export const isMarkedDocumentsDemoFile = (file: FileItem): boolean => {
  const documentsPrefix = `${D_DRIVE_FOLDER_PATHS.documents}/`.toLowerCase();
  const normalizedPath = file.path.replace(/\\/g, '/').toLowerCase();
  if (file.type !== 'file' || !normalizedPath.startsWith(documentsPrefix)) return false;
  if (normalizedPath.slice(documentsPrefix.length).includes('/')) return false;
  return /^(about_anish_jethva|alex_rivera_resume|anish_jethva_resume|career_goals_2026|technical_portfolio_a)/i
    .test(file.name);
};

export const getLegacyDDriveChildren = (sourceFiles: FileItem[], folderPath: string): FileItem[] => {
  const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  if (!isLegacyDDrivePath(folderPath) || isCanonicalDDriveFolderPath(folderPath)) return [];
  return sourceFiles
    .filter((file) =>
      !file.deletedAt &&
      !file.legacyDHidden &&
      file.parentId.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() === normalizedPath
    )
    .map((file) => ({ ...file, readOnly: true }));
};

export const buildVirtualDDriveFiles = (
  sourceFiles: FileItem[],
  publishedContent: PublishedDriveContent | null,
  publishedProjects: PublishedDriveProject[] = [],
  publicMedia: PublicMediaManifest = { audio: [], videos: [], wallpapers: [], downloads: [] }
): FileItem[] => {
  const virtualFiles: FileItem[] = folders.map((folder) => {
    const storedFolder = sourceFiles.find((source) =>
      source.type === 'folder' &&
      !source.legacyDHidden &&
      source.path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() === folder.path.toLowerCase()
    );
    return storedFolder
      ? { ...storedFolder, readOnly: false }
      : { ...folder, type: 'folder', modified: '2026-10-19', readOnly: false };
  });
  const knownPaths = new Set<string>();

  const addReference = (item: FileItem) => {
    if (
      item.type === 'file' &&
      item.parentId.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() === D_DRIVE_FOLDER_PATHS.wallpapers.toLowerCase() &&
      isHiddenWallpaperName(item.name)
    ) return;
    const key = item.path.toLowerCase();
    if (knownPaths.has(key)) return;
    knownPaths.add(key);
    virtualFiles.push(item);
  };

  createBundledMediaFiles(publicMedia).forEach(addReference);

  const addPublishedImage = (id: string, value: unknown) => {
    if (!isSafeFileUrl(value)) return;
    const extension = getUrlExtension(value, '').toLowerCase();
    if (!MEDIA_EXTENSIONS.has(extension)) return;
    const urlName = pathFileName(value);
    const name = safeName(urlName, `Image.${extension}`);
    const fileName = /\.[a-z0-9]{1,8}$/i.test(name) ? name : `${name}.${extension}`;
    addReference(referenceFile(
      `virtual-d-${id}`,
      fileName,
      extension,
      value,
      D_DRIVE_FOLDER_PATHS.pictures
    ));
  };

  addPublishedImage('profile-picture', publishedContent?.profile?.avatar);
  addPublishedImage('social-preview-image', publishedContent?.siteSettings?.socialImageUrl);
  addPublishedImage('website-favicon', publishedContent?.siteSettings?.faviconUrl);

  const disabledApps = new Set(
    Array.isArray(publishedContent?.siteSettings?.disabledApps)
      ? publishedContent.siteSettings.disabledApps.filter((id): id is string => typeof id === 'string')
      : []
  );
  APPS_LIST
    .filter((app) =>
      app.desktopShortcut &&
      !disabledApps.has(app.id) &&
      (app.id !== 'admin' || publishedContent?.siteSettings?.adminAppEnabledInStart === true)
    )
    .forEach((app) => {
      const name = `${app.name}.lnk`;
      addReference({
        id: `virtual-d-desktop-shortcut-${app.id}`,
        name,
        path: `${D_DRIVE_FOLDER_PATHS.desktop}/${name}`,
        type: 'file',
        extension: 'lnk',
        content: `app:${app.id}`,
        parentId: D_DRIVE_FOLDER_PATHS.desktop,
        modified: 'Published',
        readOnly: true,
      });
    });

  const publishedResumes = Array.isArray(publishedContent?.resumes)
    ? publishedContent.resumes.filter((resume) =>
        resume?.visible !== false && isSafeFileUrl(resume.file)
      )
    : [];
  const resumes = Array.isArray(publishedContent?.resumes)
    ? publishedResumes.map((resume) => ({ id: resume.id, title: resume.title, url: resume.file as string }))
    : isSafeFileUrl(publishedContent?.profile?.resumeUrl)
      ? [{ id: 'primary', title: 'Resume', url: publishedContent.profile.resumeUrl }]
      : [];

  resumes.forEach((resume, index) => {
    const extension = getUrlExtension(resume.url, 'pdf');
    if (extension !== 'pdf') return;
    const urlName = pathFileName(resume.url);
    const baseName = safeName(resume.title || urlName.replace(/\.pdf$/i, '') || 'Resume', 'Resume');
    const name = /\.pdf$/i.test(baseName) ? baseName : `${baseName}.pdf`;
    addReference(referenceFile(
      `virtual-d-resume-${safeName(String(resume.id || index), String(index))}`,
      name,
      'pdf',
      resume.url,
      D_DRIVE_FOLDER_PATHS.resumes
    ));
  });

  const wallpaperUrl = publishedContent?.siteSettings?.defaultWallpaperUrl;
  if (isSafeFileUrl(wallpaperUrl)) {
    const wallpaperName = typeof publishedContent?.siteSettings?.defaultWallpaperName === 'string'
      ? publishedContent.siteSettings.defaultWallpaperName
      : '';
    const extension = getUrlExtension(wallpaperUrl, getUrlExtension(wallpaperName, 'jpg'));
    if (MEDIA_EXTENSIONS.has(extension)) {
      const urlName = pathFileName(wallpaperUrl);
      const preferredName = wallpaperName || urlName;
      const baseName = safeName(preferredName.replace(/\.[^.]+$/, '') || 'Wallpaper', 'Wallpaper');
      const name = `${baseName}.${extension}`;
      addReference(referenceFile(
        'virtual-d-published-wallpaper',
        name,
        extension,
        wallpaperUrl,
        D_DRIVE_FOLDER_PATHS.wallpapers
      ));
    }
  }

  const certifications = Array.isArray(publishedContent?.certifications)
    ? publishedContent.certifications.filter((certification) => certification?.visible !== false)
    : [];
  certifications.forEach((certification, index) => {
    const url = [certification.image, certification.document, certification.documentUrl, certification.file]
      .find(isSafeFileUrl);
    if (!url) return;
    const extension = getUrlExtension(url, certification.image === url ? 'png' : 'pdf');
    if (!MEDIA_EXTENSIONS.has(extension) && extension !== 'pdf') return;
    const fallback = `Certificate_${index + 1}.${extension}`;
    const urlName = pathFileName(url);
    const baseName = safeName(certification.title || certification.name || urlName.replace(/\.[^.]+$/, '') || fallback, fallback);
    const name = /\.[a-z0-9]{1,8}$/i.test(baseName) ? baseName : `${baseName}.${extension}`;
    addReference(referenceFile(
      `virtual-d-certificate-${safeName(String(certification.id || index), String(index))}`,
      name,
      extension,
      url,
      D_DRIVE_FOLDER_PATHS.certificates,
      certification.modified || 'Published'
    ));
  });

  publishedProjects
    .filter((project) => project.visible !== false && typeof project.title === 'string' && project.title.trim())
    .forEach((project, index) => {
      const title = safeName(project.title || `Project ${index + 1}`, `Project ${index + 1}`);
      const details = [
        `# ${project.title}`,
        project.tagline && `> ${project.tagline}`,
        project.category && `**Category:** ${project.category}`,
        project.summary && `## Summary\n${project.summary}`,
        project.overview && `## Overview\n${project.overview}`,
        project.description && `## Description\n${project.description}`,
        project.technologies?.length && `## Technologies\n${project.technologies.map((technology) => `- ${technology}`).join('\n')}`,
        project.features?.length && `## Features\n${project.features.map((feature) => `- ${feature}`).join('\n')}`,
        project.caseStudy?.goal && `## Goal\n${project.caseStudy.goal}`,
        project.caseStudy?.approach && `## Approach\n${project.caseStudy.approach}`,
        project.caseStudy?.architecture?.length && `## Architecture\n${project.caseStudy.architecture.map((item) => `- ${item}`).join('\n')}`,
        project.caseStudy?.engineeringHighlights?.length && `## Engineering Highlights\n${project.caseStudy.engineeringHighlights.map((item) => `- ${item}`).join('\n')}`,
        project.caseStudy?.delivered && `## Delivered\n${project.caseStudy.delivered}`,
        project.githubUrl && `## Links\n- [GitHub](${project.githubUrl})`,
        project.liveUrl && `- [Live site](${project.liveUrl})`,
      ].filter((line): line is string => Boolean(line));
      const name = `${title}.md`;
      addReference({
        id: `virtual-d-project-${safeName(project.id || String(index), String(index))}`,
        name,
        path: `${D_DRIVE_FOLDER_PATHS.projects}/${name}`,
        type: 'file',
        extension: 'md',
        content: details.join('\n\n'),
        parentId: D_DRIVE_FOLDER_PATHS.projects,
        modified: 'Published',
        readOnly: true,
      });
    });

  sourceFiles.forEach((source) => {
    if (source.type !== 'file' || source.deletedAt || source.legacyDHidden) return;
    const sourcePath = source.path.replace(/\\/g, '/');
    const lowerPath = sourcePath.toLowerCase();
    const extension = (source.extension || '').toLowerCase();
    if (/^C:\//i.test(sourcePath) || isMarkedDocumentsDemoFile(source)) return;
    const obsoleteVideosPath = `${D_DRIVE_FOLDER_PATHS.videos}/Videos`;
    if (lowerPath === obsoleteVideosPath.toLowerCase()) return;
    if (lowerPath.startsWith(`${obsoleteVideosPath.toLowerCase()}/`)) {
      const path = `${D_DRIVE_FOLDER_PATHS.videos}${sourcePath.slice(obsoleteVideosPath.length)}`;
      addReference({
        ...source,
        id: `virtual-ref-${source.id}`,
        path,
        parentId: path.slice(0, path.lastIndexOf('/')),
        readOnly: true,
      });
      return;
    }
    if (lowerPath.startsWith(`${D_DRIVE_FOLDER_PATHS.projects.toLowerCase()}/`)) return;
    if (isCanonicalDDrivePath(sourcePath)) {
      addReference({ ...source, readOnly: false });
      return;
    }

    const cameraSource =
      (lowerPath.includes('/pictures/') || lowerPath.includes('/videos/')) &&
      (lowerPath.includes('/camera') || hasCameraCaptureName(source));
    if (cameraSource && (MEDIA_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension))) {
      const destination = VIDEO_EXTENSIONS.has(extension)
        ? D_DRIVE_FOLDER_PATHS.videoCaptures
        : D_DRIVE_FOLDER_PATHS.photoCaptures;
      addReference(mapStoredFile(source, destination));
      return;
    }

    if (
      (lowerPath.includes('/certificates/') || lowerPath.includes('/certificate/')) &&
      (MEDIA_EXTENSIONS.has(extension) || extension === 'pdf')
    ) {
      addReference(mapStoredFile(source, D_DRIVE_FOLDER_PATHS.certificates));
      return;
    }

    if (lowerPath.includes('/about me/') || lowerPath.includes('/about-me/')) {
      addReference(mapStoredFile(source, D_DRIVE_FOLDER_PATHS.aboutMe));
      return;
    }

    if (AUDIO_EXTENSIONS.has(extension) && lowerPath.includes('/music/')) {
      addReference(mapStoredFile(source, D_DRIVE_FOLDER_PATHS.audio));
    }
  });

  addReference({
    id: 'virtual-d-about-me-shortcut',
    name: 'About Me.lnk',
    path: `${D_DRIVE_FOLDER_PATHS.aboutMe}/About Me.lnk`,
    type: 'file',
    extension: 'lnk',
    content: 'app:about',
    parentId: D_DRIVE_FOLDER_PATHS.aboutMe,
    modified: '2026-10-19',
    readOnly: true,
  });

  return virtualFiles;
};
