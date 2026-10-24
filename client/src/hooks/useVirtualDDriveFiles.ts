import { useEffect, useMemo, useRef, useState } from 'react';
import { publicMedia } from 'virtual:portfolio-public-media';
import { FileItem } from '../types';
import {
  buildVirtualDDriveFiles,
  D_DRIVE_FOLDER_PATHS,
  isCanonicalDDrivePath,
  isLegacyDDrivePath,
  type PublishedDriveContent,
  type PublishedDriveProject,
} from '../utils/virtualDDrive';

type LoadErrorHandler = (title: string, message: string) => void;

export const useVirtualDDriveFiles = (
  storedFiles: FileItem[],
  onLoadError?: LoadErrorHandler,
  enabled = true
): FileItem[] => {
  const [publishedDriveContent, setPublishedDriveContent] = useState<PublishedDriveContent | null>(null);
  const [publishedProjects, setPublishedProjects] = useState<PublishedDriveProject[]>([]);
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    if (!enabled) return;
    const applyPublishedContent = (content: PublishedDriveContent | null | undefined) => {
      if (content && typeof content === 'object') setPublishedDriveContent(content);
    };
    const handlePublishedContent = (event: Event) => {
      applyPublishedContent((event as CustomEvent<PublishedDriveContent>).detail);
    };
    const controller = new AbortController();
    const refreshPublishedProjects = () => {
      fetch('/api/projects', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || payload?.success !== true || !Array.isArray(payload.projects)) {
            throw new Error(payload?.error || `Published projects could not be loaded (HTTP ${response.status}).`);
          }
          setPublishedProjects(payload.projects);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : 'Published project files could not be loaded.';
          console.error('[VirtualDDrive] Could not load published projects.', error);
          onLoadErrorRef.current?.('D: projects unavailable', message);
        });
    };
    const refreshPublishedContent = () => {
      fetch('/api/portfolio-content', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || payload?.success !== true || !payload.content) {
            throw new Error(payload?.error || `Published portfolio content could not be loaded (HTTP ${response.status}).`);
          }
          applyPublishedContent(payload.content);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : 'Published D: file references could not be loaded.';
          console.error('[VirtualDDrive] Could not load published portfolio content.', error);
          onLoadErrorRef.current?.('D: content unavailable', message);
        });
    };

    window.addEventListener('portfolio-content-published', handlePublishedContent);
    window.addEventListener('portfolio-data-updated', handlePublishedContent);
    window.addEventListener('portfolio-content-published', refreshPublishedProjects);
    window.addEventListener('portfolio-data-updated', refreshPublishedProjects);
    refreshPublishedProjects();
    refreshPublishedContent();

    return () => {
      controller.abort();
      window.removeEventListener('portfolio-content-published', handlePublishedContent);
      window.removeEventListener('portfolio-data-updated', handlePublishedContent);
      window.removeEventListener('portfolio-content-published', refreshPublishedProjects);
      window.removeEventListener('portfolio-data-updated', refreshPublishedProjects);
    };
  }, [enabled]);

  const virtualDDriveFiles = useMemo(
    () => buildVirtualDDriveFiles(storedFiles, publishedDriveContent, publishedProjects, publicMedia),
    [storedFiles, publishedDriveContent, publishedProjects]
  );

  return useMemo(
    () => [
      ...storedFiles.filter((file) =>
        !file.legacyDHidden &&
        (!isLegacyDDrivePath(file.path) || isCanonicalDDrivePath(file.path)) &&
        !file.path.replace(/\\/g, '/').toLowerCase().startsWith(`${D_DRIVE_FOLDER_PATHS.projects.toLowerCase()}/`)
      ),
      ...virtualDDriveFiles.filter((virtualFile) =>
        !storedFiles.some((storedFile) => storedFile.path.toLowerCase() === virtualFile.path.toLowerCase())
      ),
    ],
    [storedFiles, virtualDDriveFiles]
  );
};
