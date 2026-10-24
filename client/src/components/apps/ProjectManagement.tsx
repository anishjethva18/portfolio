import React, { useEffect, useRef, useState } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, LoaderCircle, Eye, EyeOff, FolderKanban, ArrowUp, ArrowDown } from 'lucide-react';

interface Project {
    id: string;
    title: string;
    description: string;
    category: string;
    technologies: string[];
    features?: string[];
    image: string;
    githubUrl?: string;
    liveUrl?: string;
    featured: boolean;
    visible?: boolean;
    sortOrder?: number;
    tagline?: string;
    slug?: string;
    type?: string;
    stack?: string;
    screenshots?: string[];
    overview?: string;
    summary?: string;
    caseStudy?: {
        goal?: string;
        approach?: string;
        architecture?: string[];
        engineeringHighlights?: string[];
        delivered?: string;
    };
}

export const ProjectManagement: React.FC<{
    projects: Project[];
    loading?: boolean;
    onSave: (project: Partial<Project>) => Promise<boolean>;
    onToggleVisibility: (id: string, visible: boolean) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
    onUploadMedia: (file: File) => Promise<string>;
    onReorder: (orderedIds: string[]) => void;
    onDraftChange?: (dirty: boolean) => void;
}> = ({ projects, loading = false, onSave, onToggleVisibility, onDelete, onUploadMedia, onReorder, onDraftChange }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
    const [formData, setFormData] = useState<Partial<Project>>({
        title: '',
        description: '',
        category: 'Full Stack',
        technologies: [],
        features: [],
        image: '',
        githubUrl: '',
        liveUrl: '',
        featured: false,
        visible: true,
        screenshots: [],
        caseStudy: { goal: '', approach: '', architecture: [], engineeringHighlights: [], delivered: '' },
    });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<string | null>(null);
    const [visibilityError, setVisibilityError] = useState('');
    const [formError, setFormError] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [localImagePreview, setLocalImagePreview] = useState<string | null>(null);
    const [addingCategory, setAddingCategory] = useState(false);
    const initialFormDataRef = useRef<Partial<Project> | null>(null);
    const saveDraftRef = useRef<() => Promise<void>>(async () => undefined);
    const categories = Array.from(new Set([...projects.map((project) => project.category), formData.category].filter(Boolean)));

    useEffect(() => () => {
        if (localImagePreview) URL.revokeObjectURL(localImagePreview);
    }, [localImagePreview]);

    useEffect(() => {
        const dirty = Boolean(isModalOpen && initialFormDataRef.current && JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current));
        onDraftChange?.(dirty);
    }, [formData, isModalOpen, onDraftChange]);

    const handleOpenModal = (project?: Project) => {
        setLocalImagePreview(null);
        setAddingCategory(false);
        if (project) {
            setEditingProject(project);
            setFormData(project);
            initialFormDataRef.current = JSON.parse(JSON.stringify(project));
        } else {
            setEditingProject(null);
            const emptyProject: Partial<Project> = {
                title: '',
                description: '',
                category: 'Full Stack',
                technologies: [],
                features: [],
                image: '',
                githubUrl: '',
                liveUrl: '',
                featured: false,
                visible: true,
                screenshots: [],
                caseStudy: { goal: '', approach: '', architecture: [], engineeringHighlights: [], delivered: '' },
            };
            setFormData(emptyProject);
            initialFormDataRef.current = JSON.parse(JSON.stringify(emptyProject));
        }
        setIsModalOpen(true);
    };

    const saveCurrentDraft = async () => {
        if (saving || !isModalOpen) return;
        setSaving(true);
        setFormError('');
        try {
            const saved = await onSave(formData);
            if (saved) setIsModalOpen(false);
            else setFormError('Project was not saved. Review the error notification and try again.');
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : 'Project could not be saved.');
        } finally {
            setSaving(false);
        }
    };
    saveDraftRef.current = saveCurrentDraft;

    useEffect(() => {
        const saveDraft = () => { void saveDraftRef.current(); };
        const discardUnsavedEdits = () => {
            if (initialFormDataRef.current) setFormData(initialFormDataRef.current);
            setIsModalOpen(false);
            setFormError('');
            onDraftChange?.(false);
        };
        window.addEventListener('admin-save-content-draft', saveDraft);
        window.addEventListener('admin-discard-unsaved-edits', discardUnsavedEdits);
        return () => {
            window.removeEventListener('admin-save-content-draft', saveDraft);
            window.removeEventListener('admin-discard-unsaved-edits', discardUnsavedEdits);
            onDraftChange?.(false);
        };
    }, [onDraftChange]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void saveCurrentDraft();
    };

    const handleDelete = async (id: string) => {
        if (deletingId) return;
        setDeletingId(id);
        try {
            await onDelete(id);
        } finally {
            setDeletingId(null);
        }
    };

    const toggleVisibility = async (project: Project) => {
        if (visibilityUpdatingId) return;
        setVisibilityUpdatingId(project.id);
        setVisibilityError('');
        try {
            const saved = await onToggleVisibility(project.id, project.visible === false);
            if (!saved) setVisibilityError('Visibility was not saved. Review the error notification and try again.');
        } catch (cause) {
            setVisibilityError(cause instanceof Error ? cause.message : 'Project visibility could not be updated.');
        } finally {
            setVisibilityUpdatingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <section className="admin-content-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><FolderKanban className="h-4 w-4 text-sky-600" />Project library</h2>
                    <p className="mt-1 text-xs text-slate-500">Manage project stories, media, links, and public visibility. Changes stay in draft until published.</p>
                </div>
                <button 
                    type="button"
                    onClick={() => handleOpenModal()}
                    className="admin-action-button inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                    <Plus size={16} /> Add project
                </button>
            </div>
            {visibilityError && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{visibilityError}</div>}

            {loading ? (
                <div role="status" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-10 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading projects...</div>
            ) : projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-xs text-slate-500">No projects yet. Add a project to get started.</div>
            ) : (
            <div className="mt-5 space-y-2.5">
                {projects.map((project, projectIndex) => (
                    <article key={project.id} className={`admin-project-row flex flex-col gap-3 rounded-xl border p-3 transition sm:flex-row sm:items-center ${project.visible === false ? 'is-hidden border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-white'}`}>
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                {project.image ? <img src={project.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-slate-400" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="truncate text-xs font-semibold text-slate-900">{project.title}</h3>
                                    <span className="rounded-full bg-sky-50 px-2 py-1 text-[9px] font-semibold text-sky-700">{project.category}</span>
                                    <span aria-live="polite" className={`rounded-full px-2 py-1 text-[9px] font-bold ${project.visible === false ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{project.visible === false ? 'Hidden' : 'Visible'}</span>
                                </div>
                                <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{project.tagline || project.description}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                            <div className="flex items-center gap-0.5" aria-label={`Order controls for ${project.title}`}>
                                <button type="button" aria-label={`Move ${project.title} up`} title="Move project up" disabled={projectIndex === 0 || Boolean(deletingId)} onClick={() => { const ids = projects.map((item) => item.id); [ids[projectIndex - 1], ids[projectIndex]] = [ids[projectIndex], ids[projectIndex - 1]]; onReorder(ids); }} className="admin-action-button inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:opacity-35"><ArrowUp size={15} /></button>
                                <button type="button" aria-label={`Move ${project.title} down`} title="Move project down" disabled={projectIndex === projects.length - 1 || Boolean(deletingId)} onClick={() => { const ids = projects.map((item) => item.id); [ids[projectIndex + 1], ids[projectIndex]] = [ids[projectIndex], ids[projectIndex + 1]]; onReorder(ids); }} className="admin-action-button inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:opacity-35"><ArrowDown size={15} /></button>
                            </div>
                            <button type="button" onClick={() => void toggleVisibility(project)} disabled={Boolean(deletingId) || visibilityUpdatingId === project.id} aria-label={`${project.visible === false ? 'Show' : 'Hide'} ${project.title} in Projects app`} title={project.visible === false ? 'Show in Projects app' : 'Hide from Projects app'} className="admin-action-button project-visibility-toggle inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:opacity-50">
                                {visibilityUpdatingId === project.id ? <LoaderCircle size={13} className="animate-spin" /> : project.visible === false ? <Eye size={13} /> : <EyeOff size={13} />}
                                {project.visible === false ? 'Show' : 'Hide'}
                            </button>
                            <div className="flex gap-1">
                                <button 
                                    type="button"
                                    onClick={() => handleOpenModal(project)}
                                    aria-label={`Edit ${project.title}`}
                                    title={`Edit ${project.title}`}
                                    disabled={Boolean(deletingId)}
                                    className="admin-action-button project-card-action project-card-action--edit inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Edit size={14} /><span>Edit</span>
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => void handleDelete(project.id)}
                                    aria-label={`Delete ${project.title}`}
                                    title={`Delete ${project.title}`}
                                    disabled={Boolean(deletingId)}
                                    className="admin-action-button project-card-action project-card-action--delete inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-rose-500 bg-gradient-to-r from-rose-600 to-red-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {deletingId === project.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}<span>Delete</span>
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
            )}
            </section>

            {isModalOpen && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-5" role="presentation">
                            <div role="dialog" aria-modal="true" aria-labelledby="project-form-title" className="admin-project-editor admin-content-card flex max-h-full w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
                        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-6">
                            <div><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-sky-600">Project details</p><h3 id="project-form-title" className="mt-1 text-lg font-bold text-slate-900">{editingProject ? 'Edit project' : 'Add project'}</h3></div>
                            <button type="button" onClick={() => setIsModalOpen(false)} disabled={saving} aria-label="Close project form" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4 sm:p-6">
                            {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{formError}</div>}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="project-title" className="text-xs font-medium text-slate-600">Title</label>
                                    <input 
                                        id="project-title"
                                        type="text" 
                                        required 
                                        maxLength={120}
                                        value={formData.title} 
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="project-category" className="text-xs font-medium text-slate-600">Category</label>
                                    <select
                                        id="project-category"
                                        value={addingCategory || !categories.includes(formData.category || '') ? '__new_category__' : formData.category}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setAddingCategory(value === '__new_category__');
                                            if (value !== '__new_category__') setFormData({ ...formData, category: value });
                                            else setFormData({ ...formData, category: '' });
                                        }}
                                        className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500"
                                    >
                                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                                        <option value="__new_category__">+ Add a new category…</option>
                                    </select>
                                    {addingCategory && (
                                        <input
                                            id="project-new-category"
                                            type="text"
                                            value={formData.category || ''}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="admin-project-field mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500"
                                            placeholder="Enter a new category"
                                            maxLength={80}
                                            required
                                            autoFocus
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="project-slug" className="text-xs font-medium text-slate-600">Slug</label>
                                    <input id="project-slug" value={formData.slug || ''} maxLength={160} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="project-url-name" className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="project-type" className="text-xs font-medium text-slate-600">Project type</label>
                                    <input id="project-type" value={formData.type || ''} maxLength={120} onChange={(e) => setFormData({ ...formData, type: e.target.value })} placeholder="Web application" className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="project-tagline" className="text-xs font-medium text-slate-600">Tagline</label>
                                    <input id="project-tagline" value={formData.tagline || ''} maxLength={240} onChange={(e) => setFormData({ ...formData, tagline: e.target.value })} placeholder="A short project summary" className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="project-stack" className="text-xs font-medium text-slate-600">Stack</label>
                                    <input id="project-stack" value={formData.stack || ''} maxLength={500} onChange={(e) => setFormData({ ...formData, stack: e.target.value })} placeholder="React, Node.js, MongoDB" className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="project-description" className="text-xs font-medium text-slate-600">Description</label>
                                <textarea 
                                    id="project-description"
                                    required
                                    maxLength={10000}
                                    rows={3}
                                    value={formData.description} 
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    className="admin-project-field w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="project-overview" className="text-xs font-medium text-slate-600">Overview</label>
                                <textarea id="project-overview" rows={3} maxLength={10000} value={formData.overview || ''} onChange={(e) => setFormData({ ...formData, overview: e.target.value })} className="admin-project-field w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="project-technologies" className="text-xs font-medium text-slate-600">Technologies (comma separated)</label>
                                <input 
                                    id="project-technologies"
                                    type="text" 
                                    maxLength={2000}
                                    value={Array.isArray(formData.technologies) ? formData.technologies.join(', ') : ''} 
                                    onChange={(e) => setFormData({...formData, technologies: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                                    className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="project-features" className="text-xs font-medium text-slate-600">Key features (one per line)</label>
                                <textarea id="project-features" rows={3} maxLength={12000} value={(formData.features || []).join('\n')} onChange={(e) => setFormData({ ...formData, features: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} className="admin-project-field w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="project-screenshots" className="text-xs font-medium text-slate-600">Screenshots (one URL per line)</label>
                                <textarea id="project-screenshots" rows={3} maxLength={40000} value={(formData.screenshots || []).join('\n')} onChange={(e) => setFormData({ ...formData, screenshots: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} placeholder="/api/portfolio-media/..." className="admin-project-field w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                                <p className="text-[10px] text-slate-500">Upload screenshots in Resumes &amp; Media, then copy their secure URLs into this list.</p>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="project-image" className="text-xs font-medium text-slate-400">Project image</label>
                                {(localImagePreview || formData.image) && (
                                    <img
                                        src={localImagePreview || formData.image}
                                        alt="Project image preview"
                                        className="h-40 w-full rounded-lg border border-slate-800 bg-slate-900 object-cover"
                                    />
                                )}
                                <label className="flex min-h-10 items-center gap-3 text-xs text-slate-400">
                                    <span>{uploadingImage ? 'Uploading image…' : formData.image ? 'Replace image' : 'Upload image'}</span>
                                    <input
                                        id="project-image"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        disabled={uploadingImage || saving}
                                        onChange={async (event) => {
                                            const file = event.target.files?.[0];
                                            if (!file) return;
                                            setLocalImagePreview(URL.createObjectURL(file));
                                            setUploadingImage(true);
                                            setFormError('');
                                            try {
                                                const image = await onUploadMedia(file);
                                                setFormData((current) => ({ ...current, image }));
                                                setLocalImagePreview(null);
                                            } catch (cause) {
                                                setFormError(cause instanceof Error ? cause.message : 'Project image upload failed.');
                                            } finally {
                                                setUploadingImage(false);
                                                event.target.value = '';
                                            }
                                        }}
                                        className="min-w-0 flex-1 text-[11px] file:mr-3 file:h-8 file:border-0 file:bg-slate-800 file:px-3 file:text-[11px] file:font-semibold file:text-slate-200"
                                    />
                                    {uploadingImage && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="project-github" className="text-xs font-medium text-slate-600">GitHub URL</label>
                                    <input 
                                        id="project-github"
                                        type="url" 
                                        value={formData.githubUrl} 
                                        onChange={(e) => setFormData({...formData, githubUrl: e.target.value})}
                                        className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="project-live" className="text-xs font-medium text-slate-600">Live URL</label>
                                    <input 
                                        id="project-live"
                                        type="url" 
                                        value={formData.liveUrl} 
                                        onChange={(e) => setFormData({...formData, liveUrl: e.target.value})}
                                        className="admin-project-field w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500" 
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="featured"
                                    checked={formData.featured} 
                                    onChange={(e) => setFormData({...formData, featured: e.target.checked})}
                                    className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-blue-600" 
                                />
                                <label htmlFor="featured" className="text-xs font-medium text-slate-400">Featured Project</label>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={saving || uploadingImage}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={saving || uploadingImage}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
