import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { ProjectData } from '../../types';
import { PROJECTS_DATA } from '../../data/portfolioData';
import { uploadPortfolioMedia } from '../../utils/uploadPortfolioMedia';
import { trackPortfolioAnalytics } from '../../utils/analytics';
import {
  Search,
  ExternalLink,
  Github,
  X,
  Trash2,
  LayoutGrid,
  List,
  FolderGit2,
  FolderOpen,
} from 'lucide-react';

const PROJECT_CACHE_KEY = 'win11_published_projects_cache_v1';

function loadCachedProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(PROJECT_CACHE_KEY);
    if (!raw) return PROJECTS_DATA;
    const value: unknown = JSON.parse(raw);
    if (
      Array.isArray(value) &&
      value.every((project) =>
        project &&
        typeof project === 'object' &&
        typeof project.id === 'string' &&
        typeof project.title === 'string' &&
        Array.isArray(project.technologies) &&
        Array.isArray(project.features)
      )
    ) {
      return value as ProjectData[];
    }
    console.warn('[ProjectsApp] Ignoring invalid locally cached project data.');
  } catch (error) {
    console.warn('[ProjectsApp] Could not read locally cached project data.', error);
  }
  return PROJECTS_DATA;
}

export const ProjectsApp: React.FC = () => {
  const { openApp, addNotification } = useOS();
  const { apiFetch, isAdmin } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>(loadCachedProjects);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectLoadAttempt, setProjectLoadAttempt] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeProject, setActiveProject] = useState<ProjectData | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Management Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formCategory, setFormCategory] = useState<ProjectData['category']>('Full Stack');
  const [formTechInput, setFormTechInput] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFeaturesInput, setFormFeaturesInput] = useState('');
  const [formGithubUrl, setFormGithubUrl] = useState('');
  const [formLiveUrl, setFormLiveUrl] = useState('');
  const [formImage, setFormImage] = useState('');
  const [localImagePreview, setLocalImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => () => {
    if (localImagePreview) URL.revokeObjectURL(localImagePreview);
  }, [localImagePreview]);

  useEffect(() => {
    const refreshProjects = () => fetch('/api/projects')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success || !Array.isArray(data.projects)) {
          throw new Error(data.error || 'Unable to load projects from MongoDB.');
        }
        const publishedProjects = data.projects.filter((project: ProjectData) => project.visible !== false);
        setProjects(publishedProjects);
        try {
          localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(publishedProjects));
        } catch (error) {
          console.warn('[ProjectsApp] Could not cache published projects for offline use.', error);
        }
        setProjectsError(null);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to load projects.';
        setProjectsError(message);
        if (!projects.length) addNotification({ title: 'Projects unavailable', message, type: 'error' });
      })
      .finally(() => setLoadingProjects(false));
    void refreshProjects();
    window.addEventListener('portfolio-data-updated', refreshProjects);
    window.addEventListener('portfolio-content-published', refreshProjects);
    return () => {
      window.removeEventListener('portfolio-data-updated', refreshProjects);
      window.removeEventListener('portfolio-content-published', refreshProjects);
    };
  }, [addNotification, projectLoadAttempt]);

  const categories = ['All', ...new Set(projects.map((project) => project.category).filter(Boolean))];

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.technologies || []).some((tech) => tech.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const openProjectDetails = (project: ProjectData) => {
    if (!isAdmin) {
      trackPortfolioAnalytics('PROJECT_CLICK', 'interaction', '/projects', { projectId: project.id, projectTitle: project.title });
      trackPortfolioAnalytics('PROJECT_VIEW', 'interaction', '/projects', { projectId: project.id, projectTitle: project.title });
    }
    setActiveProject(project);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormTagline('');
    setFormCategory('Full Stack');
    setFormTechInput('');
    setFormDescription('');
    setFormFeaturesInput('');
    setFormGithubUrl('');
    setFormLiveUrl('');
    setFormImage('');
    setLocalImagePreview(null);
    setEditingProjectId(null);
  };

  const handleOpenEditModal = (project: ProjectData, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalImagePreview(null);
    setEditingProjectId(project.id);
    setFormTitle(project.title);
    setFormTagline(project.tagline || '');
    setFormCategory(project.category);
    setFormTechInput(project.technologies.join(', '));
    setFormDescription(project.description);
    setFormFeaturesInput((project.features || []).join('\n'));
    setFormGithubUrl(project.githubUrl || '');
    setFormLiveUrl(project.liveUrl || '');
    setFormImage(project.image || '');
    setIsAddModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId || !formTitle.trim()) return;

    const technologies = formTechInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const features = formFeaturesInput
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    const projectPayload = {
      title: formTitle.trim(),
      tagline: formTagline.trim() || undefined,
      category: formCategory,
      technologies,
      description: formDescription.trim(),
      features,
      githubUrl: formGithubUrl.trim() || undefined,
      liveUrl: formLiveUrl.trim() || undefined,
      image: formImage.trim(),
      featured: true,
    };

    try {
      const response = await apiFetch(`/api/admin/projects/${editingProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectPayload),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.project) {
        throw new Error(data.error || 'Project could not be saved to MongoDB.');
      }
      addNotification({
        title: 'Project Draft Saved',
        message: `"${formTitle}" stays private until you publish it from Admin Panel.`,
        type: 'success',
      });
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      addNotification({ title: 'Project save failed', message: error.message, type: 'error' });
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    try {
      const response = await apiFetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Project could not be deleted from MongoDB.');
      }
      addNotification({
        title: 'Project Draft Updated',
        message: `"${title}" stays on the public portfolio until you publish from Admin Panel.`,
        type: 'warning',
      });
    } catch (error: any) {
      addNotification({ title: 'Project delete failed', message: error.message, type: 'error' });
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pb-20 max-w-6xl mx-auto space-y-6 select-text">
      {/* Top Banner & Management Toolbar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-lg">
            <FolderGit2 className="w-6 h-6 text-cyan-300" />
            <span>Portfolio Project Management</span>
          </div>
          <p className="text-xs text-blue-100 max-w-xl">
            Explore live production builds, inspect repositories, and browse the selected work.
          </p>
        </div>


      </div>

      {/* Search, Filter & View Mode Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects or technologies..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Category Pills & View Switcher */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10">
            <button
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'
              }`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'
              }`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Display (Grid or List) */}
      {loadingProjects && projects.length === 0 ? (
        <div role="status" className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/70 px-5 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/50">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Loading projects…
        </div>
      ) : projectsError && projects.length === 0 ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-8 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Projects could not be loaded</p>
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{projectsError}</p>
          <button type="button" onClick={() => { setLoadingProjects(true); setProjectLoadAttempt((attempt) => attempt + 1); }} className="mt-4 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500">Try again</button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-16 text-center text-slate-400 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 mx-auto flex items-center justify-center">
            {projects.length === 0 ? <FolderOpen className="w-8 h-8 text-slate-400" /> : <Search className="w-8 h-8 text-slate-400" />}
          </div>
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{projects.length === 0 ? 'No projects have been published yet' : 'No matching projects'}</p>
          <p className="text-xs text-slate-500">{projects.length === 0 ? 'Published projects will appear here when they are available.' : 'Try changing your search keywords or category filters.'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group relative flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-200 cursor-pointer"
              onClick={() => openProjectDetails(project)}
            >
              {/* Image Banner */}
              <div className="relative h-44 overflow-hidden bg-slate-100 dark:bg-slate-800">
                {project.image ? <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                /> : <div className="grid h-full w-full place-items-center bg-slate-100 text-slate-400 dark:bg-slate-800"><FolderOpen className="h-8 w-8" /></div>}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1">
                  {project.category}
                </div>

              </div>

              {/* Card Body */}
              <div className="flex-1 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors truncate">
                    {project.title}
                  </h3>
                  {project.tagline && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {project.tagline}
                  </p>}
                </div>

                {/* Tech Tags */}
                {(project.technologies || []).some((tech) => tech.trim()) && <div className="flex flex-wrap gap-1.5 pt-2">
                  {(project.technologies || []).filter((tech) => tech.trim()).slice(0, 4).map((tech) => (
                    <span
                      key={tech}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                  {(project.technologies || []).filter((tech) => tech.trim()).length > 4 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
                      +{(project.technologies || []).filter((tech) => tech.trim()).length - 4}
                    </span>
                  )}
                </div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-blue-500/50 shadow-sm cursor-pointer transition-all"
              onClick={() => openProjectDetails(project)}
            >
              <div className="flex items-center gap-4">
                {project.image ? <img
                  src={project.image}
                  alt={project.title}
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                  referrerPolicy="no-referrer"
                /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800"><FolderOpen className="h-6 w-6" /></div>}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{project.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">
                      {project.category}
                    </span>
                  </div>
                  {project.tagline && <p className="text-xs text-slate-500 line-clamp-1">{project.tagline}</p>}
                  {(project.technologies || []).some((tech) => tech.trim()) && <div className="flex flex-wrap gap-1">
                    {(project.technologies || []).filter((tech) => tech.trim()).slice(0, 5).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                        {t}
                      </span>
                    ))}
                  </div>}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isAdmin && deleteConfirmId && (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-500">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Delete Project?</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to permanently remove this project from your MongoDB portfolio?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white cursor-pointer"
                onClick={() => {
                  const target = projects.find((p) => p.id === deleteConfirmId);
                  if (target) {
                    void handleDeleteProject(target.id, target.title);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Existing Project Modal */}
      {isAdmin && isAddModalOpen && (
        <div
          className="fixed inset-0 z-[2050] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2 font-bold text-base text-slate-900 dark:text-white">
                <FolderGit2 className="w-5 h-5 text-blue-500" />
                <span>Edit Portfolio Project</span>
              </div>
              <button
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Project Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. AI Workflow Orchestrator"
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ProjectData['category'])}
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {Array.from(new Set([...categories.filter((category) => category !== 'All'), formCategory])).map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tagline / Subtitle</label>
                <input
                  type="text"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="Short, punchy summary of what the project does"
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Technologies / Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formTechInput}
                  onChange={(e) => setFormTechInput(e.target.value)}
                  placeholder="TypeScript, React, Tailwind CSS, Node.js, PostgreSQL"
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="In-depth explanation of problem statement, architecture, performance, and outcomes..."
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Key Features (one per line)
                </label>
                <textarea
                  rows={3}
                  value={formFeaturesInput}
                  onChange={(e) => setFormFeaturesInput(e.target.value)}
                  placeholder="Real-time multi-agent execution pipeline&#10;Sub-millisecond Redis caching&#10;Containerized microservices"
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">GitHub URL</label>
                  <input
                    type="url"
                    value={formGithubUrl}
                    onChange={(e) => setFormGithubUrl(e.target.value)}
                    placeholder="https://github.com/username/project"
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Live Demo URL</label>
                  <input
                    type="url"
                    value={formLiveUrl}
                    onChange={(e) => setFormLiveUrl(e.target.value)}
                    placeholder="https://demo.example.com"
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <label htmlFor="project-cover-upload" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Project image</label>
                  {(localImagePreview || formImage) && (
                    <img
                      src={localImagePreview || formImage}
                      alt="Project image preview"
                      className="h-36 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 object-cover"
                    />
                  )}
                  <label className="flex min-h-10 items-center gap-3 text-slate-600 dark:text-slate-300">
                    <span>{uploadingImage ? 'Uploading image…' : formImage ? 'Replace image' : 'Upload image'}</span>
                    <input
                      id="project-cover-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploadingImage}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setLocalImagePreview(URL.createObjectURL(file));
                        setUploadingImage(true);
                        try {
                          const imageUrl = await uploadPortfolioMedia(file, 'project');
                          setFormImage(imageUrl);
                          setLocalImagePreview(null);
                        } catch (error: any) {
                          addNotification({ title: 'Image upload failed', message: error.message || 'Project image could not be uploaded.', type: 'error' });
                        } finally {
                          setUploadingImage(false);
                          event.target.value = '';
                        }
                      }}
                      className="min-w-0 flex-1 text-[11px] file:mr-2 file:h-8 file:border-0 file:bg-slate-200 dark:file:bg-slate-800 file:px-2 file:text-[10px] file:font-semibold file:text-slate-700 dark:file:text-slate-200"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer"
                >
                  {editingProjectId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Detail Viewer Modal */}
      {activeProject && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-6 md:p-8 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveProject(null)}
        >
          <div
            className="relative w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-5 sm:p-7 space-y-5 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              onClick={() => setActiveProject(null)}
            >
              <X className="w-4 h-4" />
            </button>

            {activeProject.image && <img
              src={activeProject.image}
              alt={activeProject.title}
              className="w-full h-48 sm:h-60 rounded-2xl object-cover shadow-md"
              referrerPolicy="no-referrer"
            />}

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500">
                  {activeProject.category}
                </span>
                {activeProject.type && <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{activeProject.type}</span>}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
                {activeProject.title}
              </h2>
              {activeProject.tagline && <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">{activeProject.tagline}</p>}
            </div>

            {activeProject.description && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {activeProject.description}
            </p>}
            {activeProject.overview && <section className="space-y-1.5"><h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Overview</h4><p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">{activeProject.overview}</p></section>}
            {activeProject.summary && <section className="space-y-1.5"><h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Case study</h4><p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">{activeProject.summary}</p></section>}

            {activeProject.caseStudy && (activeProject.caseStudy.goal || activeProject.caseStudy.approach || activeProject.caseStudy.architecture?.some((item) => item.trim()) || activeProject.caseStudy.engineeringHighlights?.some((item) => item.trim()) || activeProject.caseStudy.delivered) && (
              <section className="space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 p-3.5 sm:p-4">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Project case study</h4>
                {activeProject.caseStudy.goal && <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Goal</p><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">{activeProject.caseStudy.goal}</p></div>}
                {activeProject.caseStudy.approach && <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Approach</p><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">{activeProject.caseStudy.approach}</p></div>}
                {activeProject.caseStudy.architecture?.length ? <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Architecture</p><ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-600 dark:text-slate-300">{activeProject.caseStudy.architecture.map((item, index) => <li key={`architecture-${index}`}>{item}</li>)}</ul></div> : null}
                {activeProject.caseStudy.engineeringHighlights?.length ? <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Engineering highlights</p><ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-600 dark:text-slate-300">{activeProject.caseStudy.engineeringHighlights.map((item, index) => <li key={`highlight-${index}`}>{item}</li>)}</ul></div> : null}
                {activeProject.caseStudy.delivered && <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Delivered</p><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">{activeProject.caseStudy.delivered}</p></div>}
              </section>
            )}

            {activeProject.screenshots?.filter((screenshot) => screenshot.trim()).length ? <section className="space-y-2"><h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Screenshots</h4><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{activeProject.screenshots.filter((screenshot) => screenshot.trim()).map((screenshot, index) => <img key={`${screenshot}-${index}`} src={screenshot} alt={`${activeProject.title} screenshot ${index + 1}`} loading="lazy" className="aspect-video w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 object-cover" />)}</div></section> : null}

            {/* Key Features */}
            {activeProject.features?.some((feature) => feature.trim()) && (
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Key Features</h4>
                <ul className="space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 list-disc list-inside">
                  {activeProject.features.filter((feature) => feature.trim()).map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tech Stack */}
            {activeProject.technologies?.some((tech) => tech.trim()) && <div className="space-y-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Tech Stack</h4>
              <div className="flex flex-wrap gap-1.5">
                {activeProject.technologies.filter((tech) => tech.trim()).map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>}

            {/* Footer Action Links */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {activeProject.githubUrl && (
                <a
                  href={activeProject.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <Github className="w-4 h-4" /> GitHub Repository
                </a>
              )}

              {activeProject.liveUrl && (
                <button
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  onClick={() => {
                    openApp('browser', { initialUrl: activeProject.liveUrl });
                    setActiveProject(null);
                  }}
                >
                  <ExternalLink className="w-4 h-4" /> Open Live Demo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
