const sortObjectKeys = (value: unknown): unknown => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
};

const projectMetadataKeys = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'id']);
const projectTextFields = [
  'title', 'tagline', 'description', 'category', 'image', 'githubUrl', 'liveUrl',
  'slug', 'type', 'stack', 'overview', 'summary',
];
const projectListFields = ['technologies', 'features', 'screenshots'];
const caseStudyTextFields = ['goal', 'approach', 'delivered'];
const caseStudyListFields = ['architecture', 'engineeringHighlights'];

export interface ProjectDraftChange {
  label: string;
  projectId?: string;
  action: 'field' | 'added' | 'removed' | 'order';
  field?: string;
}

const getComparableProjectContent = (project: Record<string, unknown>) => {
  const content = Object.fromEntries(
    Object.entries(project).filter(([key, value]) =>
      !projectMetadataKeys.has(key) && key !== 'sortOrder' && value !== undefined
    ),
  ) as Record<string, unknown>;

  for (const field of projectTextFields) {
    if (content[field] == null) content[field] = '';
  }
  for (const field of projectListFields) {
    if (!Array.isArray(content[field])) content[field] = [];
  }
  if (content.stars == null) content.stars = 0;
  if (content.featured == null) content.featured = false;
  if (content.visible == null) content.visible = true;

  const caseStudy = content.caseStudy && typeof content.caseStudy === 'object' && !Array.isArray(content.caseStudy)
    ? { ...(content.caseStudy as Record<string, unknown>) }
    : {};
  for (const field of caseStudyTextFields) {
    if (caseStudy[field] == null) caseStudy[field] = '';
  }
  for (const field of caseStudyListFields) {
    if (!Array.isArray(caseStudy[field])) caseStudy[field] = [];
  }
  content.caseStudy = caseStudy;
  return sortObjectKeys(content);
};

export const getProjectState = (projects: unknown): string => {
  if (!Array.isArray(projects)) return '';
  const orderedProjects = projects.map((entry, index) => {
    const project: Record<string, unknown> = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : { value: entry };
    return { id: project.id, order: project.sortOrder ?? index, index, content: getComparableProjectContent(project) };
  }).sort((left, right) => Number(left.order) - Number(right.order) || left.index - right.index);
  return JSON.stringify(orderedProjects.map(({ id, content }, order) => ({ id, order, content }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id))));
};

export const getProjectChangeEntries = (draftValue: unknown, publishedValue: unknown): ProjectDraftChange[] => {
  const draft = Array.isArray(draftValue) ? draftValue as Array<Record<string, any>> : [];
  const published = Array.isArray(publishedValue) ? publishedValue as Array<Record<string, any>> : [];
  const draftById = new Map(draft.map((project) => [String(project.id || project._id), project]));
  const publishedById = new Map(published.map((project) => [String(project.id || project._id), project]));
  const fields: Record<string, string> = {
    title: 'Title',
    tagline: 'Tagline',
    description: 'Description',
    category: 'Category',
    image: 'Image',
    technologies: 'Technologies',
    features: 'Features',
    githubUrl: 'Repository link',
    liveUrl: 'Live link',
    stars: 'Stars',
    featured: 'Featured status',
    visible: 'Visibility',
    slug: 'Slug',
    type: 'Type',
    stack: 'Stack',
    screenshots: 'Screenshots',
    overview: 'Overview',
    summary: 'Summary',
    caseStudy: 'Case study',
  };
  const changes: ProjectDraftChange[] = [];

  for (const [id, project] of draftById) {
    const prior = publishedById.get(id);
    if (!prior) {
      changes.push({ label: `Projects / ${project.title || 'Untitled'} / Added`, projectId: id, action: 'added' });
      continue;
    }
    const projectName = project.title || prior.title || 'Project';
    const comparableProject = getComparableProjectContent(project) as Record<string, unknown>;
    const comparablePrior = getComparableProjectContent(prior) as Record<string, unknown>;
    const keys = new Set([...Object.keys(prior), ...Object.keys(project)]);
    for (const field of keys) {
      if (projectMetadataKeys.has(field) || field === 'sortOrder') continue;
      if (getContentState(comparableProject[field]) !== getContentState(comparablePrior[field])) {
        const label = fields[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
        changes.push({ label: `Projects / ${projectName} / ${label}`, projectId: id, action: 'field', field });
      }
    }
  }
  for (const [id, project] of publishedById) {
    if (!draftById.has(id)) {
      changes.push({ label: `Projects / ${project.title || 'Untitled'} / Removed`, projectId: id, action: 'removed' });
    }
  }

  const projectOrder = (projects: Array<Record<string, any>>) => projects
    .map((project, index) => ({ id: String(project.id || project._id), order: project.sortOrder ?? index }))
    .sort((left, right) => Number(left.order) - Number(right.order))
    .map((project) => project.id);
  const draftOrder = projectOrder(draft);
  const publishedOrder = projectOrder(published);
  if (
    draftOrder.length === publishedOrder.length &&
    new Set(draftOrder).size === new Set(publishedOrder).size &&
    draftOrder.every((id) => publishedOrder.includes(id)) &&
    draftOrder.some((id, index) => id !== publishedOrder[index])
  ) {
    changes.push({ label: 'Projects / Display order', action: 'order' });
  }

  return changes;
};

export const getProjectChanges = (draftValue: unknown, publishedValue: unknown): string[] =>
  getProjectChangeEntries(draftValue, publishedValue).map((change) => change.label);

export const getContentState = (content: unknown): string => JSON.stringify(sortObjectKeys(content));
