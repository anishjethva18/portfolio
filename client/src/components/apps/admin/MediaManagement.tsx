import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Eye, FileText, LoaderCircle, Plus, Save, Trash2, UploadCloud, X, Music, Film } from 'lucide-react';
import { useConfirmDialog } from '../../../context/ConfirmDialogContext';
import { AdminPagination } from '../AdminPagination';
import { PdfDocumentViewer } from '../PdfDocumentViewer';
import { useResponsivePageSize } from '../../../hooks/useResponsivePageSize';
import { formatAdminDateTime } from '../../../utils/dateTime';
import { buildPortfolioMediaUrl, getPortfolioMediaId } from '../../../utils/portfolioMedia';

interface MediaManagementProps {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onDraftChange?: (dirty: boolean) => void;
  onSaved?: () => void | Promise<void>;
}

interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: string;
  extension?: string;
  size?: string;
  modified?: string;
  uploadedAt?: string;
  storagePath?: string;
}

const MEDIA_FOLDER = 'Portfolio/Media';

interface ResumeEntry {
  id: string;
  title: string;
  file: string;
  active: boolean;
}

const mediaManagementCache: {
  files: MediaFile[];
  filesLoaded: boolean;
  resumes: ResumeEntry[];
  savedResumes: ResumeEntry[];
  resumesLoaded: boolean;
  referencedMediaText: string;
} = {
  files: [],
  filesLoaded: false,
  resumes: [],
  savedResumes: [],
  resumesLoaded: false,
  referencedMediaText: '',
};

const MediaThumbnail: React.FC<{
  file: MediaFile;
  onOpen: () => void;
}> = ({ file, onOpen }) => {
  const [url, setUrl] = useState('');
  const extension = (file.extension || '').toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension);
  const isPdf = extension === 'pdf';
  const isVideo = ['mp4', 'webm', 'mov'].includes(extension);
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (isPdf) return () => { active = false; };
    void fetch(`/api/files/download/${encodeURIComponent(file.id)}`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Preview request failed (${response.status}).`);
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error: unknown) => console.error(`Could not load media thumbnail for ${file.name}.`, error));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.name, isPdf]);

  return (
    <div className="admin-media-preview-stage relative grid h-[230px] w-full place-items-center overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-50 to-sky-50/60">
      {isImage && url && <img src={url} alt={`Preview of ${file.name}`} className="h-full w-full object-cover" />}
      {isPdf && <PdfDocumentViewer url={`/api/files/preview/${encodeURIComponent(file.id)}`} firstPageOnly className="h-full w-full overflow-hidden px-3 py-2" />}
      {isVideo && url && <video src={url} muted preload="metadata" className="h-full w-full object-cover" />}
      {!isImage && !isPdf && !isVideo && <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sky-600 shadow-sm">{isAudio ? <Music className="h-6 w-6" /> : <Film className="h-6 w-6" />}</span>}
      {!url && (isImage || isVideo) && <span className="absolute inset-0 grid place-items-center bg-slate-100"><FileText className="h-6 w-6 text-sky-500" /><span className="sr-only">Media preview loading</span></span>}
      <button type="button" onClick={onOpen} aria-label={`Open preview of ${file.name}`} className="absolute inset-0 cursor-pointer bg-transparent" />
    </div>
  );
};

export const MediaManagement: React.FC<MediaManagementProps> = ({ apiFetch, onDraftChange, onSaved }) => {
  const confirm = useConfirmDialog();
  const [files, setFiles] = useState<MediaFile[]>(() => mediaManagementCache.files);
  const [filesLoaded, setFilesLoaded] = useState(() => mediaManagementCache.filesLoaded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<{ name: string; url: string; extension: string; id?: string } | null>(null);
  const [resumes, setResumes] = useState<ResumeEntry[]>(() => mediaManagementCache.resumes);
  const [savedResumes, setSavedResumes] = useState<ResumeEntry[]>(() => mediaManagementCache.savedResumes);
  const [resumesLoaded, setResumesLoaded] = useState(() => mediaManagementCache.resumesLoaded);
  const [resumeLoading, setResumeLoading] = useState(() => !mediaManagementCache.resumesLoaded);
  const [resumeSaving, setResumeSaving] = useState(false);
  const [resumeUploadingId, setResumeUploadingId] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState('');
  const [resumeTargets, setResumeTargets] = useState<Record<string, string>>({});
  const [referencedMediaText, setReferencedMediaText] = useState(() => mediaManagementCache.referencedMediaText);
  const [uploadedResumePage, setUploadedResumePage] = useState(1);
  const [mediaPage, setMediaPage] = useState(1);
  const [resumePage, setResumePage] = useState(1);
  const uploadedResumeListRef = useRef<HTMLDivElement>(null);
  const mediaListRef = useRef<HTMLDivElement>(null);
  const configuredResumeListRef = useRef<HTMLDivElement>(null);
  const uploadedResumePageSize = useResponsivePageSize(3, 380, uploadedResumeListRef);
  const mediaPageSize = useResponsivePageSize(3, 380, mediaListRef);
  const resumePageSize = useResponsivePageSize(2, 150, configuredResumeListRef);
  const uploadedResumes = files.filter((file) => (file.extension || '').toLowerCase() === 'pdf');
  const uploadedMedia = files.filter((file) => (file.extension || '').toLowerCase() !== 'pdf');
  const uploadedResumePageCount = Math.max(1, Math.ceil(uploadedResumes.length / uploadedResumePageSize));
  const currentUploadedResumePage = Math.min(uploadedResumePage, uploadedResumePageCount);
  const visibleUploadedResumes = uploadedResumes.slice((currentUploadedResumePage - 1) * uploadedResumePageSize, currentUploadedResumePage * uploadedResumePageSize);
  const mediaPageCount = Math.max(1, Math.ceil(uploadedMedia.length / mediaPageSize));
  const currentMediaPage = Math.min(mediaPage, mediaPageCount);
  const visibleFiles = uploadedMedia.slice((currentMediaPage - 1) * mediaPageSize, currentMediaPage * mediaPageSize);
  const resumePageCount = Math.max(1, Math.ceil(resumes.length / resumePageSize));
  const currentResumePage = Math.min(resumePage, resumePageCount);
  const visibleResumes = resumes.slice((currentResumePage - 1) * resumePageSize, currentResumePage * resumePageSize);
  const saveResumeRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => () => {
    if (preview?.url.startsWith('blob:')) URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    onDraftChange?.(JSON.stringify(resumes) !== JSON.stringify(savedResumes));
  }, [resumes, savedResumes, onDraftChange]);

  useEffect(() => {
    mediaManagementCache.files = files;
    mediaManagementCache.filesLoaded = filesLoaded;
  }, [files, filesLoaded]);

  useEffect(() => {
    mediaManagementCache.resumes = resumes;
    mediaManagementCache.savedResumes = savedResumes;
    mediaManagementCache.resumesLoaded = resumesLoaded;
    mediaManagementCache.referencedMediaText = referencedMediaText;
  }, [resumes, savedResumes, resumesLoaded, referencedMediaText]);

  useEffect(() => {
    setMediaPage((current) => Math.min(current, mediaPageCount));
  }, [mediaPageCount]);

  useEffect(() => {
    setUploadedResumePage((current) => Math.min(current, uploadedResumePageCount));
  }, [uploadedResumePageCount]);

  useEffect(() => {
    setResumePage((current) => Math.min(current, resumePageCount));
  }, [resumePageCount]);

  const loadResumes = useCallback(async (silent = false) => {
    if (!silent) setResumeLoading(true);
    try {
      const response = await apiFetch('/api/admin/content-studio');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load resume settings.');
      const [draftProjectsResponse, projectsResponse] = await Promise.all([
        apiFetch('/api/admin/projects'),
        apiFetch('/api/projects'),
      ]);
      const [draftProjects, publishedProjects] = await Promise.all([
        draftProjectsResponse.json(),
        projectsResponse.json(),
      ]);
      if (!draftProjectsResponse.ok || !draftProjects.success) throw new Error(draftProjects.error || 'Could not verify project media references.');
      if (!projectsResponse.ok || !publishedProjects.success) throw new Error(publishedProjects.error || 'Could not verify published project media references.');
      const content = data.draft || {};
      const nextReferences = JSON.stringify([content, data.published || {}, draftProjects.projects || [], publishedProjects.projects || []]);
      setReferencedMediaText((current) => current === nextReferences ? current : nextReferences);
      const configured = Array.isArray(content.resumes) ? content.resumes : [];
      const entries: ResumeEntry[] = configured.length
        ? configured.map((entry: ResumeEntry) => ({ id: entry.id, title: entry.title, file: entry.file, active: entry.active }))
        : content.profile?.resumeUrl
          ? [{ id: 'legacy-resume', title: 'General resume', file: content.profile.resumeUrl, active: true }]
          : [];
      setResumes((current) => JSON.stringify(current) === JSON.stringify(entries) ? current : entries);
      setSavedResumes((current) => JSON.stringify(current) === JSON.stringify(entries) ? current : entries);
      setResumesLoaded(true);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load resume settings.');
    } finally {
      if (!silent) setResumeLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void loadResumes(); }, [loadResumes]);

  useEffect(() => {
    const refreshResumeReferences = () => { void loadResumes(true); };
    window.addEventListener('portfolio-content-published', refreshResumeReferences);
    window.addEventListener('portfolio-draft-restored', refreshResumeReferences);
    return () => {
      window.removeEventListener('portfolio-content-published', refreshResumeReferences);
      window.removeEventListener('portfolio-draft-restored', refreshResumeReferences);
    };
  }, [loadResumes]);

  const saveResumes = async () => {
    if (resumeSaving) return;
    setResumeSaving(true);
    setError('');
    setResumeMessage('');
    try {
      const response = await apiFetch('/api/admin/content-studio');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load the current draft.');
      const content = data.draft || {};
      const cleanResumes = resumes.map((resume) => ({
        ...resume,
        title: resume.title.trim(),
        file: resume.file.trim(),
      }));
      if (cleanResumes.some((resume) => !resume.title || !resume.file)) throw new Error('Each resume needs a title and file URL before saving.');
      const updated = {
        ...content,
        resumes: cleanResumes,
        profile: {
          ...content.profile,
          resumeUrl: cleanResumes.length
            ? cleanResumes.find((resume) => resume.active)?.file || ''
            : '',
        },
      };
      const saveResponse = await apiFetch('/api/admin/content-studio/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: updated }),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok || !saved.success) throw new Error(saved.error || 'Resume draft could not be saved.');
      const persisted = Array.isArray(saved.draft?.resumes) ? saved.draft.resumes : cleanResumes;
      setResumes(persisted);
      setSavedResumes(persisted);
      setResumeMessage('Resume changes saved to draft. Publish separately to update the public CV app.');
      await loadResumes();
      await onSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Resume draft could not be saved.');
    } finally {
      setResumeSaving(false);
    }
  };
  saveResumeRef.current = saveResumes;

  useEffect(() => {
    const handleSaveDraft = () => { void saveResumeRef.current(); };
    window.addEventListener('admin-save-content-draft', handleSaveDraft);
    return () => {
      window.removeEventListener('admin-save-content-draft', handleSaveDraft);
      onDraftChange?.(false);
    };
  }, [onDraftChange]);

  useEffect(() => {
    const handleDiscardUnsavedEdits = () => {
      setResumes(savedResumes);
      setError('');
      setResumeMessage('');
    };
    window.addEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
    return () => window.removeEventListener('admin-discard-unsaved-edits', handleDiscardUnsavedEdits);
  }, [savedResumes]);

  const uploadResume = async (id: string, file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Resume files must be PDF documents.');
      return;
    }
    setResumeUploadingId(id);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetFolder', MEDIA_FOLDER);
      formData.append('path', `${MEDIA_FOLDER}/${file.name}`);
      formData.append('storageCategory', 'resume');
      const response = await apiFetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data.success || !data.file?.url) throw new Error(data.error || 'Resume upload failed.');
      setResumes((current) => current.map((resume) => resume.id === id ? { ...resume, file: data.file.url } : resume));
      setNotice(`${file.name} uploaded and selected. Save the draft, then publish it to replace the live CV.`);
      window.dispatchEvent(new CustomEvent('portfolio-media-changed'));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Resume upload failed.');
    } finally {
      setResumeUploadingId(null);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const query = new URLSearchParams({ pathPrefix: MEDIA_FOLDER });
      const response = await apiFetch(`/api/admin/vfs-files?${query}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load media files.');
      const nextFiles = data.files || [];
      setFiles((current) => JSON.stringify(current) === JSON.stringify(nextFiles) ? current : nextFiles);
      setFilesLoaded(true);
      setError('');
    } catch (cause: any) {
      setError(cause.message || 'Media storage is unavailable.');
    }
  }, [apiFetch]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const handlePortfolioSync = () => { void refresh(); };
    window.addEventListener('portfolio-data-updated', handlePortfolioSync);
    return () => window.removeEventListener('portfolio-data-updated', handlePortfolioSync);
  }, [refresh]);

  const remove = async (file: MediaFile) => {
    const mediaUrl = `/api/portfolio-media/${encodeURIComponent(file.id)}`;
    const isReferenced = referencedMediaText.includes(mediaUrl) ||
      referencedMediaText.includes(`id=${encodeURIComponent(file.id)}`);
    const message = isReferenced
      ? `${file.name} is currently used by portfolio content or a project. Deleting it will remove those references from the live portfolio and saved draft before permanently deleting the file. This change to the live portfolio happens immediately. Continue?`
      : `Permanently delete ${file.name}?`;
    if (!await confirm({ title: isReferenced ? 'Unlink and delete media file?' : 'Delete media file?', message, confirmLabel: isReferenced ? 'Unlink & delete' : 'Delete file', destructive: true })) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`/api/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Delete failed.');
      setFiles((current) => current.filter((entry) => entry.id !== file.id));
      setResumes((current) => current.map((resume) => getPortfolioMediaId(resume.file) === file.id ? { ...resume, file: '' } : resume));
      setSavedResumes((current) => current.map((resume) => getPortfolioMediaId(resume.file) === file.id ? { ...resume, file: '' } : resume));
      setReferencedMediaText((current) => current
        .replaceAll(mediaUrl, '')
        .replaceAll(buildPortfolioMediaUrl(file), ''));
      setNotice(data.unlinkedRecords
        ? `${file.name} was unlinked from ${data.unlinkedRecords} portfolio record${data.unlinkedRecords === 1 ? '' : 's'} and deleted.`
        : `${file.name} deleted.`);
      window.dispatchEvent(new CustomEvent('portfolio-media-changed'));
      window.dispatchEvent(new Event('portfolio-data-updated'));
    } catch (cause: any) {
      setError(cause.message || 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (file: MediaFile) => {
    const extension = (file.extension || '').toLowerCase();
    setBusy(true);
    setError('');
    try {
      if (extension === 'pdf') {
        setPreview({
          name: file.name,
          url: `/api/files/preview/${encodeURIComponent(file.id)}#toolbar=1&navpanes=0&scrollbar=1`,
          extension,
          id: file.id,
        });
        return;
      }
      const response = await apiFetch(`/api/files/download/${encodeURIComponent(file.id)}`);
      if (!response.ok) throw new Error(`Preview could not be loaded (HTTP ${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      setPreview({ name: file.name, url, extension, id: file.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preview could not be loaded.');
    } finally {
      setBusy(false);
    }
  };

  const openConfiguredResumePreview = (resume: ResumeEntry) => {
    const id = getPortfolioMediaId(resume.file);
    setPreview({
      name: resume.title || 'Resume PDF',
      url: id
        ? `/api/files/preview/${encodeURIComponent(id)}#toolbar=1&navpanes=0&scrollbar=1`
        : resume.file,
      extension: 'pdf',
      ...(id ? { id } : {}),
    });
  };

  const copyPortfolioMediaUrl = async (file: MediaFile) => {
    try {
      await navigator.clipboard.writeText(buildPortfolioMediaUrl(file));
      setNotice(`Secure media URL copied for ${file.name}.`);
    } catch {
      setError('Clipboard access is unavailable. Copy the filename URL with its ?id=… query from this field.');
    }
  };

  const replaceConfiguredResume = (file: MediaFile) => {
    const targetId = resumeTargets[file.id];
    const target = resumes.find((resume) => resume.id === targetId);
    if (!target) return;
    const fileUrl = buildPortfolioMediaUrl(file);
    setResumes((current) => current.map((resume) => resume.id === targetId ? { ...resume, file: fileUrl } : resume));
    setNotice(`${file.name} is selected for "${target.title || 'Resume'}". Save the draft, then publish to update the live CV.`);
  };

  const renderFileCards = (visibleFiles: MediaFile[], emptyMessage: string, listRef: { readonly current: HTMLDivElement | null }) => visibleFiles.length > 0 ? (
    <div ref={listRef} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visibleFiles.map((file) => {
        const isReferenced = referencedMediaText.includes(`/api/portfolio-media/${encodeURIComponent(file.id)}`) ||
          referencedMediaText.includes(`id=${encodeURIComponent(file.id)}`);
        return <article key={file.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-sky-200 hover:shadow-sm">
          <MediaThumbnail file={file} onOpen={() => void openPreview(file)} />
          <div className="p-3.5">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{file.name}</p><p className="mt-1 truncate font-mono text-[9px] text-slate-500">{file.storagePath || file.path}</p></div>
              {isReferenced && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">IN USE</span>}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate text-[9px] text-slate-500">{(file.extension || file.type || 'file').toUpperCase()} · {file.uploadedAt || file.modified ? formatAdminDateTime(file.uploadedAt || file.modified!) : '—'}</span>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => void openPreview(file)} disabled={busy} title="View file" aria-label={`View ${file.name}`} className="admin-action-button inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"><Eye className="h-3.5 w-3.5" />View file</button>
                <button type="button" onClick={() => void copyPortfolioMediaUrl(file)} title="Copy secure portfolio media URL" aria-label={`Copy secure media URL for ${file.name}`} className="admin-action-button grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Copy className="h-3.5 w-3.5" /></button>
                <a href={`/api/files/download/${encodeURIComponent(file.id)}`} title="Download asset" aria-label={`Download ${file.name}`} className="admin-action-button grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Download className="h-3.5 w-3.5" /></a>
                <button type="button" onClick={() => void remove(file)} disabled={busy} title={isReferenced ? 'Unlink portfolio references and delete this asset' : 'Delete asset'} aria-label={`Delete ${file.name}`} className="admin-action-button grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {(file.extension || '').toLowerCase() === 'pdf' && resumes.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <select
                aria-label={`Choose a configured resume to replace with ${file.name}`}
                value={resumeTargets[file.id] || ''}
                onChange={(event) => setResumeTargets((current) => ({ ...current, [file.id]: event.target.value }))}
                disabled={resumeSaving}
                className="admin-media-field min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="">Choose CV entry to replace…</option>
                {resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title || 'Untitled resume'}{resume.active ? ' · Available in CV app' : ' · Inactive'}</option>)}
              </select>
              <button
                type="button"
                onClick={() => replaceConfiguredResume(file)}
                disabled={resumeSaving || !resumeTargets[file.id]}
                className="admin-action-button inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-[10px] font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UploadCloud className="h-3.5 w-3.5" />Use for selected CV
              </button>
            </div>}
          </div>
        </article>;
      })}
    </div>
  ) : filesLoaded
    ? <div className="px-3 py-9 text-center text-xs text-slate-500">{emptyMessage}</div>
    : <div className="min-h-14" aria-hidden="true" />;

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-3 pb-6">
      {resumeMessage && <div role="status" aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">{resumeMessage}</div>}
      <section className="admin-content-card space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-slate-900">Resume files</h3><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Add role specific PDFs, set which resumes appear in the CV app, and arrange their visitor selection order. Save draft, then publish to make changes live.</p></div>
          <button type="button" onClick={() => { setResumePage(Math.ceil((resumes.length + 1) / resumePageSize)); setResumes((current) => [...current, { id: `resume_${Date.now().toString(36)}`, title: '', file: '', active: false }]); }} disabled={resumeSaving} className="admin-action-button inline-flex h-9 items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-[10px] font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Add resume</button>
        </div>
        {resumes.length === 0 && resumesLoaded ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center text-xs text-slate-500">No resumes configured. Add a resume and upload a PDF or provide a secure media URL.</div>
        ) : resumes.length > 0 ? <div ref={configuredResumeListRef} className="space-y-3">
          {visibleResumes.map((resume, pageIndex) => {
            const index = (currentResumePage - 1) * resumePageSize + pageIndex;
            const resumeMediaId = getPortfolioMediaId(resume.file);
            const resumeMedia = files.find((file) => file.id === resumeMediaId);
            return (
            <article key={resume.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-sky-600" /><span className="truncate text-xs font-semibold text-slate-800">{resume.title || `Resume ${index + 1}`}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${resume.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{resume.active ? 'Active' : 'Inactive'}</span></div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label={`Move ${resume.title || 'resume'} up`} title="Move up" disabled={index === 0 || resumeSaving} onClick={() => setResumes((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="admin-action-button grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Move ${resume.title || 'resume'} down`} title="Move down" disabled={index === resumes.length - 1 || resumeSaving} onClick={() => setResumes((current) => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })} className="admin-action-button grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Remove ${resume.title || 'resume'}`} onClick={() => setResumes((current) => current.filter((entry) => entry.id !== resume.id))} disabled={resumeSaving} className="admin-action-button grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[10px] font-semibold text-slate-600">Resume title
                  <input value={resume.title} maxLength={120} onChange={(event) => setResumes((current) => current.map((entry) => entry.id === resume.id ? { ...entry, title: event.target.value } : entry))} className="admin-media-field mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-sky-400" placeholder="e.g. Product Designer" />
                </label>
                <label className="space-y-1 text-[10px] font-semibold text-slate-600">PDF URL
                  <input value={resume.file} maxLength={2048} onChange={(event) => setResumes((current) => current.map((entry) => entry.id === resume.id ? { ...entry, file: event.target.value } : entry))} className="admin-media-field mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-sky-400" placeholder="/api/portfolio-media/resume.pdf?id=file-id" />
                  {resumeMedia?.storagePath && <span className="mt-1 block truncate font-mono text-[9px] font-normal text-slate-500">Stored at: {resumeMedia.storagePath}</span>}
                </label>
              </div>
              {resume.file && <button
                type="button"
                onClick={() => openConfiguredResumePreview(resume)}
                className="admin-action-button mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
              ><Eye className="h-3.5 w-3.5" />View file</button>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={resume.active} onChange={(event) => setResumes((current) => current.map((entry) => entry.id === resume.id ? { ...entry, active: event.target.checked } : entry))} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />Available in CV app</label>
                <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-700">
                  {resumeUploadingId === resume.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}{resume.file ? 'Replace PDF' : 'Upload PDF'}
                  <input type="file" accept="application/pdf,.pdf" disabled={Boolean(resumeUploadingId) || resumeSaving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadResume(resume.id, file); event.currentTarget.value = ''; }} className="sr-only" />
                </label>
              </div>
            </article>
          );})}
        </div> : <div className="min-h-14" aria-hidden="true" />}
        <AdminPagination page={currentResumePage} pageSize={resumePageSize} totalItems={resumes.length} onPageChange={setResumePage} showItemProgress />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {JSON.stringify(resumes) !== JSON.stringify(savedResumes) && <p className="text-[10px] text-slate-500">Unsaved resume changes</p>}
          <button type="button" onClick={() => void saveResumes()} disabled={resumeLoading || resumeSaving || JSON.stringify(resumes) === JSON.stringify(savedResumes)} className="admin-action-button inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">{resumeSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{resumeSaving ? 'Saving draft…' : 'Save resume draft'}</button>
        </div>
      </section>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</div>}

      <section className="admin-content-card space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Uploaded resumes</h3>
          <p className="mt-1 text-[11px] text-slate-500">PDF files stored in your portfolio media folder.</p>
        </div>
        {renderFileCards(visibleUploadedResumes, 'No uploaded resume PDFs yet.', uploadedResumeListRef)}
        <AdminPagination page={currentUploadedResumePage} pageSize={uploadedResumePageSize} totalItems={uploadedResumes.length} onPageChange={setUploadedResumePage} />
      </section>

      <section className="admin-content-card space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Uploaded media</h3>
          <p className="mt-1 text-[11px] text-slate-500">Browse and preview images, documents, audio, and video files separately from resumes.</p>
        </div>
        {renderFileCards(visibleFiles, 'No uploaded portfolio media yet.', mediaListRef)}
        <AdminPagination page={currentMediaPage} pageSize={mediaPageSize} totalItems={uploadedMedia.length} onPageChange={setMediaPage} />
      </section>
      {preview && (
        <div className="fixed inset-x-0 top-0 bottom-12 z-[100] flex items-center justify-center overflow-hidden bg-black/80 p-2 sm:p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`} className="relative flex max-h-full min-h-0 w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-[#11141c] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="truncate text-sm font-semibold text-white">{preview.name}</h3>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex h-[65vh] max-h-[calc(100dvh-11rem)] min-h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/30">
              {['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(preview.extension) && <img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" />}
              {preview.extension === 'pdf' && <PdfDocumentViewer url={preview.url} fitWidth className="h-full w-full overflow-hidden bg-white px-3 py-3 sm:px-6" />}
              {['mp4', 'webm', 'mov'].includes(preview.extension) && <video src={preview.url} controls playsInline className="max-h-full max-w-full" />}
              {['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(preview.extension) && <audio src={preview.url} controls className="w-full max-w-xl" />}
              {!['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(preview.extension) && <div className="space-y-3 p-8 text-center text-sm text-slate-300"><FileText className="mx-auto h-10 w-10 text-sky-400" /><p>Preview is not available for this file type.</p>{preview.id && <a href={preview.url} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white"><Download className="h-4 w-4" />Download file</a>}</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
