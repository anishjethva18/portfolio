import React, { useState, useEffect } from 'react';
import { PORTFOLIO_USER, EXPERIENCES, EDUCATION } from '../../data/portfolioData';
import {
  Download,
  ZoomIn,
  ZoomOut,
  FileText,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { PdfDocumentViewer } from './PdfDocumentViewer';
import { isPortfolioMediaUrl } from '../../utils/portfolioMedia';
import {
  getCachedPublishedContent,
  getCachedResumeBytes,
  loadPublishedContent,
} from '../../utils/publishedPortfolioCache';

interface ResumeData {
  name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  summary: string;
  experiences: Array<{
    role: string;
    company: string;
    period: string;
    description: string[];
  }>;
  skills: Array<{
    category: string;
    items: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    period: string;
  }>;
}

interface PublishedResumeOption {
  id: string;
  title: string;
  file: string;
  active: boolean;
}

const RESUME_SELECTION_KEY = 'portfolio_selected_resume_file';

interface ResumeViewerAppProps {
  initialResumeUrl?: string;
}

function choosePublishedResume(resumes: PublishedResumeOption[]) {
  let preferredFile = '';
  try { preferredFile = localStorage.getItem(RESUME_SELECTION_KEY) || ''; } catch {}
  return resumes.find((resume) => resume.file === preferredFile) || resumes.find((resume) => resume.active) || resumes[0];
}

function getResumePdfUrl(value: unknown): string | null {
  const resumeUrl = typeof value === 'string' ? value.trim() : '';
  const isLegacyPortfolioMediaUrl = /^\/api\/portfolio-media\/file-[A-Za-z0-9-]+$/.test(resumeUrl);
  const isPortfolioPdf = isPortfolioMediaUrl(resumeUrl) &&
    (isLegacyPortfolioMediaUrl || /\.pdf(?:$|[?#])/i.test(resumeUrl.split('?')[0]));
  const isHostedPdf = /^https:\/\//i.test(resumeUrl) && /\.pdf(?:$|[?#])/i.test(resumeUrl);
  return isPortfolioPdf || isHostedPdf ? resumeUrl : null;
}

function getPublishedResumeChoices(value: unknown): PublishedResumeOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((resume: any) => resume?.visible !== false)
    .map((resume: any) => ({
      id: String(resume.id || resume.file),
      title: String(resume.title || 'Resume'),
      file: getResumePdfUrl(resume.file) || '',
      active: resume.active === true,
    }))
    .filter((resume: PublishedResumeOption) => Boolean(resume.file))
    .sort((left: PublishedResumeOption, right: PublishedResumeOption) => Number(right.active) - Number(left.active));
}

const DEFAULT_RESUME_DATA: ResumeData = {
  name: PORTFOLIO_USER.name,
  title: PORTFOLIO_USER.title,
  location: PORTFOLIO_USER.location,
  email: PORTFOLIO_USER.email,
  phone: '+91 98765 43210',
  website: PORTFOLIO_USER.website,
  summary: PORTFOLIO_USER.bio,
  experiences: EXPERIENCES.map((e) => ({
    role: e.role,
    company: e.company,
    period: e.period,
    description: e.description,
  })),
  skills: [],
  education: EDUCATION.map((edu) => ({
    degree: edu.degree,
    institution: edu.institution,
    period: edu.period,
  })),
};

export const ResumeViewerApp: React.FC<ResumeViewerAppProps> = ({ initialResumeUrl }) => {
  const { addNotification, settings } = useOS();
  const [zoom, setZoom] = useState(100);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [fitWidth, setFitWidth] = useState(true);
  const [publishedResumeUrl, setPublishedResumeUrl] = useState<string | null>(() => getResumePdfUrl(initialResumeUrl));
  const [publishedResumeChoices, setPublishedResumeChoices] = useState<PublishedResumeOption[]>([]);
  const [resumeData, setResumeData] = useState<ResumeData>(DEFAULT_RESUME_DATA);

  // Sync live resume data from API
  useEffect(() => {
    let active = true;
    const syncFromPublishedContent = (data?: any) => {
      if (!data) return;
      const profile = data.profile || data;
      if (!profile?.name) return;
      const contactVisibility = profile.contactVisibility || {};
      setResumeData((prev) => ({
        ...prev,
        name: profile.name,
        title: profile.title ?? prev.title,
        location: contactVisibility.location === false ? '' : profile.location ?? prev.location,
        email: contactVisibility.email === false ? '' : profile.email ?? prev.email,
        phone: contactVisibility.phone === false ? '' : profile.phone ?? prev.phone,
        website: profile.website ?? prev.website,
        summary: profile.bio ?? prev.summary,
        experiences: Array.isArray(data.experiences) ? data.experiences.filter((item: any) => item?.visible !== false).map((item: any) => ({ role: item.role, company: item.company, period: item.period, description: item.description || [] })) : prev.experiences,
        education: Array.isArray(data.education) ? data.education.filter((item: any) => item?.visible !== false).map((item: any) => ({ degree: item.degree, institution: item.institution, period: item.period })) : prev.education,
        skills: Array.isArray(data.skills) ? data.skills.map((category: any) => ({ category: category.title, items: (category.skills || []).map((skill: any) => skill.name).join(', ') })) : prev.skills,
      }));
      const availableResumes = getPublishedResumeChoices(data.resumes);
      setPublishedResumeChoices(availableResumes);
      setPublishedResumeUrl(
        getResumePdfUrl(initialResumeUrl) ||
        choosePublishedResume(availableResumes)?.file ||
        (!Array.isArray(data.resumes) ? getResumePdfUrl(profile.resumeUrl) : null)
      );
    };

    syncFromPublishedContent(getCachedPublishedContent());
    void loadPublishedContent().then((content) => {
      if (active) syncFromPublishedContent(content);
    }).catch((error: unknown) => {
      if (active) console.error('[ResumeViewer] Published resumes could not be loaded.', error);
    });
    const handlePublish = (event: Event) => {
      syncFromPublishedContent((event as CustomEvent).detail);
    };
    window.addEventListener('portfolio-content-published', handlePublish);
    window.addEventListener('portfolio-data-updated', handlePublish);
    return () => {
      active = false;
      window.removeEventListener('portfolio-content-published', handlePublish);
      window.removeEventListener('portfolio-data-updated', handlePublish);
    };
  }, [initialResumeUrl]);

  const handleDownload = async () => {
    if (!publishedResumeUrl) return;
    setDownloading(true);
    try {
      const bytes = await getCachedResumeBytes(publishedResumeUrl);
      const objectUrl = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      const safeResumeTitle = selectedResumeTitle.replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Resume';
      const safeOwnerName = (resumeData.name || 'Anish Jethva').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
      link.download = `${safeOwnerName} - ${safeResumeTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 3000);
    } catch {
      addNotification({ title: 'Download Failed', message: 'Could not download the published resume.', type: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const renderHighlighted = (text: string) => text;
  const selectedResumeTitle = publishedResumeChoices.find((resume) => resume.file === publishedResumeUrl)?.title || (publishedResumeUrl ? 'Anish_Jethva_Resume.pdf' : 'No resume available');
  const viewerUrl = publishedResumeUrl || '';

  return (
    <div className={`flex h-full min-h-0 flex-col text-slate-800 dark:text-slate-100 select-text overflow-hidden font-sans ${settings.theme === 'light' ? 'bg-white' : 'bg-[#0b0f19]'}`}>
      {/* Toolbar follows the document; the app's outer pane owns scrolling. */}
      <div className="relative z-10 grid shrink-0 grid-cols-1 items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white/95 px-2.5 py-2.5 text-xs shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95 min-[700px]:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            {publishedResumeChoices.length > 1 ? (
              <div role="tablist" aria-label="Choose resume" className="flex max-w-full items-center gap-1.5 overflow-x-auto py-0.5">
                {publishedResumeChoices.map((resume) => {
                  const selected = resume.file === publishedResumeUrl;
                  return <button key={resume.id} type="button" role="tab" aria-selected={selected} onClick={() => { setPublishedResumeUrl(resume.file); try { localStorage.setItem(RESUME_SELECTION_KEY, resume.file); } catch {} }} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors sm:text-xs ${selected ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white'}`}>{resume.title}</button>;
                })}
              </div>
            ) : (
              <span className="block max-w-[140px] truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white xs:max-w-[200px] sm:max-w-xs sm:text-sm">{selectedResumeTitle}</span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 max-w-full items-center gap-1.5 min-[700px]:col-start-2 min-[700px]:row-start-1 min-[700px]:justify-end sm:gap-2">
          {/* Zoom & View Controls */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            className="rounded-md p-0.5 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={!publishedResumeUrl}
            onClick={() => {
              setFitWidth(false);
              setZoom((z) => Math.max(40, z - 10));
            }}
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-7 text-center font-mono text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
            {fitWidth ? 'Fit' : `${zoom}%`}
          </span>
          <button
            className="rounded-md p-0.5 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={!publishedResumeUrl}
            onClick={() => {
              setFitWidth(false);
              setZoom((z) => Math.min(180, z + 10));
            }}
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            className={`rounded-md p-0.5 transition-colors ${
              fitWidth
                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
            } disabled:cursor-not-allowed disabled:opacity-35`}
            disabled={!publishedResumeUrl}
            onClick={() => setFitWidth(!fitWidth)}
            title={fitWidth ? 'Disable fit to width' : 'Fit to width'}
            aria-label={fitWidth ? 'Disable fit to width' : 'Fit to width'}
            aria-pressed={fitWidth}
          >
            {fitWidth ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          </div>

          {/* Public CV is read-only; resume files are managed in the admin panel. */}
          <button
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-cyan-900/30 text-xs shrink-0"
            onClick={handleDownload}
            disabled={downloading || !publishedResumeUrl}
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : downloaded ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden xs:inline">{downloading ? 'Exporting...' : downloaded ? 'Saved!' : 'Download PDF'}</span>
            <span className="xs:hidden">{downloading ? '...' : downloaded ? 'Saved' : 'PDF'}</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-white">
        {publishedResumeUrl ? (
          <section className="h-full min-h-[min(80vh,720px)] w-full bg-white">
            <PdfDocumentViewer
              key={viewerUrl}
              url={viewerUrl}
              fitWidth={fitWidth}
              zoom={zoom}
              onZoomChange={(nextZoom) => {
                setFitWidth(false);
                setZoom(nextZoom);
              }}
              className="h-full min-h-[min(80vh,720px)] w-full overflow-hidden bg-white px-0 py-2 sm:px-6 sm:py-3"
            />
          </section>
        ) : <div className="flex min-h-[min(60vh,520px)] items-center justify-center px-5 py-12 text-center">
          <div className="max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"><FileText className="h-6 w-6" /></span>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">No resume available</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">There is no published resume PDF to display right now.</p>
          </div>
        </div>}
      </div>

    </div>
  );
};
