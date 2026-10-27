import React, { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, ExternalLink, Github, GraduationCap, LoaderCircle, MapPin, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import type { ProjectData, SkillCategory } from '../../../types';

interface PreviewContent {
  profile?: {
    name?: string;
    title?: string;
    tagline?: string;
    bio?: string;
    location?: string;
    email?: string;
    avatar?: string;
    resumeUrl?: string;
    github?: string;
    linkedin?: string;
    website?: string;
    stats?: { publicRepos?: number; totalStars?: number; followers?: number };
    goals?: string[];
  };
  skills?: SkillCategory[];
  experiences?: Array<{ role?: string; company?: string; location?: string; period?: string; description?: string[]; skills?: string[] }>;
  education?: Array<{ degree?: string; institution?: string; period?: string; details?: string }>;
  resumes?: Array<{ id?: string; title?: string; file?: string; active?: boolean }>;
  siteSettings?: {
    siteTitle?: string;
    announcementBanner?: { enabled?: boolean; message?: string; type?: string; link?: string };
  };
}

export const AdminDraftPreviewPage: React.FC = () => {
  const { user, isLoading: authLoading, apiFetch } = useAuth();
  const [content, setContent] = useState<PreviewContent | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    let active = true;
    Promise.all([
      apiFetch('/api/admin/content-studio'),
      apiFetch('/api/admin/projects'),
    ])
      .then(async ([contentResponse, projectsResponse]) => {
        const [contentData, projectsData] = await Promise.all([contentResponse.json(), projectsResponse.json()]);
        if (!contentResponse.ok || !contentData.success || !contentData.draft) {
          throw new Error(contentData.error || 'The saved portfolio draft could not be loaded.');
        }
        if (!projectsResponse.ok || !projectsData.success || !Array.isArray(projectsData.projects)) {
          throw new Error(projectsData.error || 'The saved project draft could not be loaded.');
        }
        if (active) {
          setContent(contentData.draft);
          setProjects(projectsData.projects.filter((project: ProjectData) => project.visible !== false));
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Draft preview could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [apiFetch, authLoading, user?.role]);

  const profile = content?.profile || {};
  const skills = content?.skills || [];
  const experiences = content?.experiences || [];
  const education = content?.education || [];
  const activeResumes = (content?.resumes || []).filter((resume) => resume.active && resume.file);
  const announcement = content?.siteSettings?.announcementBanner;
  const internalPreviewUrl = (url?: string) => url?.startsWith('/api/portfolio-media/') ? url : url || '';

  if (authLoading || loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-200"><p className="flex items-center gap-3 text-sm"><LoaderCircle className="h-5 w-5 animate-spin" />Loading private draft preview…</p></main>;
  }

  if (user?.role !== 'admin' || !content) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
        <section className="max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-400">{error || 'Sign in as an administrator to preview the unpublished portfolio draft.'}</p>
          <a href="/#admin" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><ArrowLeft size={16} />Open Admin Panel</a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white"><Sparkles size={18} /></span>
            <div><p className="text-sm font-bold">Draft preview</p><p className="text-[11px] text-slate-500">Private view · Not published</p></div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={14} />Visit live site</a>
            <a href="/#admin" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500"><ArrowLeft size={14} />Back to Admin</a>
          </div>
        </div>
      </div>
      {announcement?.enabled && announcement.message && (
        <div className="bg-blue-700 px-4 py-2 text-center text-xs font-semibold text-white">{announcement.message}</div>
      )}
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-8 sm:py-12">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-7 text-white shadow-2xl sm:p-12">
          <div className="flex flex-col items-start gap-7 sm:flex-row sm:items-center">
            <img src={internalPreviewUrl(profile.avatar) || '/avatar.png'} alt={profile.name || 'Profile'} className="h-28 w-28 rounded-3xl border-4 border-white/20 object-cover shadow-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{content.siteSettings?.siteTitle || 'Portfolio'}</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">{profile.name || 'Your name'}</h1>
              <p className="mt-2 text-lg font-semibold text-blue-200">{profile.title || 'Professional title'}</p>
              {profile.tagline && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">{profile.tagline}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.location && <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs"><MapPin size={14} />{profile.location}</span>}
                {profile.email && <a className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs" href={`mailto:${profile.email}`}><Mail size={14} />{profile.email}</a>}
                {profile.github && <a className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs" href={profile.github} target="_blank" rel="noreferrer"><Github size={14} />GitHub</a>}
                {activeResumes.length ? activeResumes.map((resume, index) => <a key={resume.id || resume.file} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-900" href={internalPreviewUrl(resume.file)} target="_blank" rel="noreferrer">View {resume.title || `Resume ${index + 1}`}</a>) : profile.resumeUrl && <a className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-900" href={internalPreviewUrl(profile.resumeUrl)} target="_blank" rel="noreferrer">View resume</a>}
              </div>
            </div>
          </div>
        </section>

        {profile.bio && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-bold">About</h2><p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-7 text-slate-600">{profile.bio}</p></section>}

        {skills.length > 0 && <section>
          <h2 className="mb-4 text-2xl font-bold">Skills</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((group, index) => <article key={`${group.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold">{group.title}</h3>
              <div className="mt-4 flex flex-wrap gap-2">{group.skills?.map((skill) => <span key={skill.name} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800">{skill.name}</span>)}</div>
            </article>)}
          </div>
        </section>}

        <section>
          <h2 className="mb-4 text-2xl font-bold">Projects</h2>
          {projects.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{projects.map((project) => <article key={project.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {project.image && <img src={internalPreviewUrl(project.image)} alt={project.title} className="h-44 w-full bg-slate-100 object-cover" />}
            <div className="p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{project.category}{project.type ? ` · ${project.type}` : ''}</p><h3 className="mt-1 text-lg font-bold">{project.title}</h3>{project.tagline && <p className="mt-1 text-xs font-medium text-slate-500">{project.tagline}</p>}<p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{project.description}</p>{project.overview && <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-600">{project.overview}</p>}{project.summary && <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-600">{project.summary}</p>}{project.caseStudy?.goal && <p className="mt-3 text-xs leading-5 text-slate-600"><strong>Goal:</strong> {project.caseStudy.goal}</p>}{project.caseStudy?.approach && <p className="mt-2 text-xs leading-5 text-slate-600"><strong>Approach:</strong> {project.caseStudy.approach}</p>}{project.caseStudy?.architecture?.length ? <ul className="mt-2 list-inside list-disc text-xs leading-5 text-slate-600">{project.caseStudy.architecture.map((item, index) => <li key={`architecture-${index}`}>{item}</li>)}</ul> : null}{project.caseStudy?.engineeringHighlights?.length ? <ul className="mt-2 list-inside list-disc text-xs leading-5 text-slate-600">{project.caseStudy.engineeringHighlights.map((item, index) => <li key={`highlight-${index}`}>{item}</li>)}</ul> : null}{project.caseStudy?.delivered && <p className="mt-2 text-xs leading-5 text-slate-600"><strong>Delivered:</strong> {project.caseStudy.delivered}</p>}{project.screenshots?.length ? <div className="mt-3 grid grid-cols-2 gap-2">{project.screenshots.map((screenshot, index) => <img key={`${screenshot}-${index}`} src={internalPreviewUrl(screenshot)} alt={`${project.title} screenshot ${index + 1}`} className="aspect-video w-full rounded-lg object-cover" />)}</div> : null}<div className="mt-3 flex flex-wrap gap-1.5">{project.technologies.map((technology) => <span key={technology} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{technology}</span>)}</div><div className="mt-4 flex gap-3">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-600"><Github size={16} /></a>}{project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-600"><ExternalLink size={16} /></a>}</div></div>
          </article>)}</div> : <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No projects in the draft.</p>}
        </section>

        {experiences.length > 0 && <section><h2 className="mb-4 text-2xl font-bold">Experience</h2><div className="space-y-4">{experiences.map((item, index) => <article key={`${item.company}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><BriefcaseBusiness className="mt-1 h-5 w-5 text-blue-600" /><div><h3 className="font-bold">{item.role}</h3><p className="text-sm text-slate-600">{item.company}{item.location ? ` · ${item.location}` : ''}</p><p className="mt-1 text-xs text-slate-500">{item.period}</p>{item.description?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{item.description.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul> : null}</div></div></article>)}</div></section>}

        {education.length > 0 && <section><h2 className="mb-4 text-2xl font-bold">Education</h2><div className="grid gap-4 sm:grid-cols-2">{education.map((item, index) => <article key={`${item.institution}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><GraduationCap className="mb-3 h-5 w-5 text-blue-600" /><h3 className="font-bold">{item.degree}</h3><p className="mt-1 text-sm text-slate-600">{item.institution}</p><p className="mt-1 text-xs text-slate-500">{item.period}</p>{item.details && <p className="mt-3 text-sm text-slate-600">{item.details}</p>}</article>)}</div></section>}

        <footer className="rounded-3xl bg-slate-900 p-7 text-center text-white"><p className="text-lg font-bold">This is a private preview of the saved draft</p><p className="mt-2 text-sm text-slate-300">Changes will not appear on the public portfolio until you publish them.</p><a href="/#admin" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500"><ArrowLeft size={16} />Return to Admin</a></footer>
      </div>
    </main>
  );
};
