export const getProjectState = (projects: unknown): string => {
  if (!Array.isArray(projects)) return '';
  return JSON.stringify(projects.map((entry) => {
    const project = entry as Record<string, unknown>;
    return {
      id: project.id,
      title: project.title,
      tagline: project.tagline ?? '',
      description: project.description,
      features: project.features ?? [],
      technologies: project.technologies ?? [],
      category: project.category,
      image: project.image,
      githubUrl: project.githubUrl ?? '',
      liveUrl: project.liveUrl ?? '',
      stars: project.stars,
      featured: project.featured,
      visible: project.visible !== false,
      createdAt: project.createdAt,
    };
  }).sort((left, right) => String(left.id).localeCompare(String(right.id))));
};

const sortObjectKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
};

export const getContentState = (content: unknown): string => JSON.stringify(sortObjectKeys(content));
