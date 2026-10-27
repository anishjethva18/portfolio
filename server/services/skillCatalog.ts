import { randomUUID } from 'crypto';
import * as SimpleIcons from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';

const CATEGORY_ICONS = new Set([
  'LayoutGrid', 'Monitor', 'Code2', 'Server', 'Smartphone', 'Database',
  'BrainCircuit', 'Cloud', 'Wrench', 'ShieldCheck', 'ChartNoAxesCombined',
  'GraduationCap', 'MessagesSquare', 'HardDrive', 'Sparkles', 'Sliders',
]);

const IT_ICON_SLUGS = new Set([
  'android', 'angular', 'anaconda', 'ansible', 'apache', 'apollographql', 'apachekafka', 'astro', 'anthropic',
  'apple', 'babel', 'bitbucket', 'bootstrap', 'bun', 'c', 'capacitor', 'cplusplus', 'chakraui', 'cloudflare',
  'clojure', 'css', 'cypress', 'dart', 'debian', 'deno', 'django', 'docker', 'dotnet',
  'claude', 'claudecode', 'cursor', 'deepseek', 'elasticsearch', 'elixir', 'express', 'fastapi',
  'fastify', 'fedora', 'figma', 'firebase',
  'flask', 'flutter', 'fsharp', 'git', 'github', 'githubactions', 'githubcopilot', 'gitlab', 'go',
  'googlegemini', 'googlecloud', 'graphql', 'haskell', 'html5', 'huggingface',
  'insomnia', 'intellijidea', 'ios', 'java', 'javascript', 'jest', 'jupyter',
  'kafka', 'keras', 'kotlin', 'kubernetes', 'langchain', 'laravel', 'less', 'linux',
  'lua', 'mariadb', 'materialdesign', 'mongodb', 'mocha', 'mysql', 'nestjs', 'netlify',
  'neovim', 'neo4j', 'nginx', 'nodedotjs', 'nextdotjs', 'numpy', 'nuxt', 'ollama', 'openjdk', 'opencv',
  'openrouter', 'pandas', 'perl', 'perplexity', 'php', 'postman', 'postgresql', 'prisma', 'pytorch', 'python',
  'r', 'react', 'redis', 'render', 'replit', 'replicate', 'ruby', 'rust', 'sass', 'scikitlearn', 'scipy',
  'selenium', 'solid', 'spring', 'sqlite', 'svelte', 'supabase', 'swift', 'symfony',
  'tailwindcss', 'tensorflow', 'terraform', 'testinglibrary', 'threedotjs', 'typescript', 'ubuntu',
  'vuedotjs', 'vercel', 'vim', 'vite', 'vitest', 'webpack', 'xcode', 'yarn', 'zsh', 'mistralai',
]);

function isSimpleIcon(value: unknown): value is SimpleIcon {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'slug' in value &&
    'title' in value &&
    'path' in value &&
    typeof (value as SimpleIcon).slug === 'string' &&
    typeof (value as SimpleIcon).title === 'string' &&
    typeof (value as SimpleIcon).path === 'string'
  );
}

export const SIMPLE_ICON_CATALOG = Object.values(SimpleIcons)
  .filter(isSimpleIcon)
  .filter((icon) => IT_ICON_SLUGS.has(icon.slug))
  .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }));

export const SIMPLE_ICON_BY_SLUG = new Map(
  SIMPLE_ICON_CATALOG.map((icon) => [icon.slug, icon] as const)
);

const SIMPLE_ICON_SLUGS = new Set(SIMPLE_ICON_CATALOG.map((icon) => icon.slug));

const LUCIDE_SKILL_ICONS = new Set([
  'BrainCircuit', 'Code2', 'Lightbulb', 'ShieldCheck', 'MessagesSquare', 'ChartNoAxesCombined',
  'Database', 'Network',
]);
const CUSTOM_SKILL_ICONS = new Set(['vscode', 'java', 'openai', 'aws', 'linux', 'csharp']);

const SKILL_ALIASES: Record<string, string> = {
  angular: 'angular',
  aws: 'custom:aws',
  'amazon web services': 'custom:aws',
  amazonaws: 'custom:aws',
  anthropic: 'anthropic',
  android: 'android',
  anaconda: 'anaconda',
  apple: 'apple',
  astro: 'astro',
  bun: 'bun',
  bootstrap: 'bootstrap',
  capacitor: 'capacitor',
  c: 'c',
  'c#': 'custom:csharp',
  'c sharp': 'custom:csharp',
  'c++': 'cplusplus',
  chatgpt: 'custom:openai',
  'chat gpt': 'custom:openai',
  openai: 'custom:openai',
  'claude code': 'claudecode',
  cursor: 'cursor',
  deepseek: 'deepseek',
  css: 'css',
  css3: 'css',
  deno: 'deno',
  django: 'django',
  docker: 'docker',
  dotnet: 'dotnet',
  '.net': 'dotnet',
  elasticsearch: 'elasticsearch',
  express: 'express',
  'express.js': 'express',
  fastapi: 'fastapi',
  figma: 'figma',
  firebase: 'firebase',
  flask: 'flask',
  flutter: 'flutter',
  go: 'go',
  git: 'git',
  github: 'github',
  'github actions': 'githubactions',
  'github copilot': 'githubcopilot',
  gemini: 'googlegemini',
  claude: 'anthropic',
  'google gemini': 'googlegemini',
  graphql: 'graphql',
  huggingface: 'huggingface',
  'hugging face': 'huggingface',
  html: 'html5',
  html5: 'html5',
  java: 'custom:java',
  openjdk: 'openjdk',
  insomnia: 'insomnia',
  jest: 'jest',
  kotlin: 'kotlin',
  kafka: 'apachekafka',
  kubernetes: 'kubernetes',
  javascript: 'javascript',
  js: 'javascript',
  langchain: 'langchain',
  linux: 'custom:linux',
  mongodb: 'mongodb',
  mysql: 'mysql',
  mistral: 'mistralai',
  'mistral ai': 'mistralai',
  'next.js': 'nextdotjs',
  'next js': 'nextdotjs',
  nextjs: 'nextdotjs',
  'node.js': 'nodedotjs',
  'node js': 'nodedotjs',
  node: 'nodedotjs',
  nodejs: 'nodedotjs',
  numpy: 'numpy',
  nuxt: 'nuxt',
  ollama: 'ollama',
  openrouter: 'openrouter',
  pandas: 'pandas',
  perplexity: 'perplexity',
  php: 'php',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  postman: 'postman',
  prisma: 'prisma',
  python: 'python',
  pytorch: 'pytorch',
  react: 'react',
  'react.js': 'react',
  'react native': 'react',
  redis: 'redis',
  replit: 'replit',
  replicate: 'replicate',
  sass: 'sass',
  sqlite: 'sqlite',
  svelte: 'svelte',
  supabase: 'supabase',
  swift: 'swift',
  tailwind: 'tailwindcss',
  'tailwind css': 'tailwindcss',
  typescript: 'typescript',
  ts: 'typescript',
  tensorflow: 'tensorflow',
  terraform: 'terraform',
  'three.js': 'threedotjs',
  threejs: 'threedotjs',
  vercel: 'vercel',
  vite: 'vite',
  vitest: 'vitest',
  vue: 'vuedotjs',
  vuejs: 'vuedotjs',
  webpack: 'webpack',
  yarn: 'yarn',
  'visual studio code': 'custom:vscode',
  'vs code': 'custom:vscode',
  vscode: 'custom:vscode',
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function generatedIdentifier(prefix: string, value: string, suffix: string): string {
  const slug = normalizeName(value).replace(/\s/g, '-') || 'item';
  const trailing = `-${suffix}`;
  const slugLimit = Math.max(1, 100 - prefix.length - trailing.length - 1);
  return `${prefix}-${slug.slice(0, slugLimit)}${trailing}`;
}

export function getSkillIconIdentifier(name: string): string {
  const normalized = normalizeName(name);
  const rawNormalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/(^|\s)c#(?=$|\s)/.test(rawNormalized) || normalized === 'c sharp') return 'custom:csharp';
  if (/^c(?:\s+(?:programming|language|lang))?$/.test(rawNormalized)) return 'simple:c';
  const exact = SKILL_ALIASES[rawNormalized] || SKILL_ALIASES[normalized];
  if (exact) return exact.startsWith('custom:') || exact.startsWith('lucide:') ? exact : `simple:${exact}`;
  const paddedName = ` ${normalized} `;
  const matchingAlias = Object.entries(SKILL_ALIASES)
    .map(([alias, identifier]) => ({ alias: normalizeName(alias), identifier }))
    .map((entry) => ({ ...entry, index: paddedName.indexOf(` ${entry.alias} `) }))
    .filter((entry) => entry.alias.length > 1 && entry.index >= 0)
    .sort((left, right) => right.alias.length - left.alias.length || left.index - right.index)[0]?.identifier;
  if (matchingAlias) return matchingAlias.startsWith('custom:') || matchingAlias.startsWith('lucide:') ? matchingAlias : `simple:${matchingAlias}`;
  if (/\b(problem solving|critical thinking|innovation)\b/.test(normalized)) return 'lucide:Lightbulb';
  if (/\b(openai|chatgpt|claude|llm|machine learning|artificial intelligence)\b/.test(normalized)) return 'lucide:BrainCircuit';
  if (/\b(security|authentication|authorization|cybersecurity)\b/.test(normalized)) return 'lucide:ShieldCheck';
  if (/\b(communication|teamwork|collaboration)\b/.test(normalized)) return 'lucide:MessagesSquare';
  if (/\b(analytics|data analysis|visualization)\b/.test(normalized)) return 'lucide:ChartNoAxesCombined';
  if (/\b(database|sql|query)\b/.test(normalized)) return 'lucide:Database';
  if (/\b(api|websocket|network|graphql|rest)\b/.test(normalized)) return 'lucide:Network';
  return 'lucide:Code2';
}

export function getCategoryIconIdentifier(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (/\b(security|secure|cybersecurity)\b/.test(normalized)) return 'ShieldCheck';
  if (/\b(analytics|data|metrics)\b/.test(normalized)) return 'ChartNoAxesCombined';
  if (/\b(education|learning|academic)\b/.test(normalized)) return 'GraduationCap';
  if (/\b(communication|social|messaging)\b/.test(normalized)) return 'MessagesSquare';
  if (/\b(frontend|front end|ui|web development)\b/.test(normalized)) return 'Monitor';
  if (/\b(backend|back end|server)\b/.test(normalized)) return 'Server';
  if (/\b(mobile|android|ios)\b/.test(normalized)) return 'Smartphone';
  if (/\b(database|databases|sql|storage)\b/.test(normalized)) return 'Database';
  if (/\b(ai|machine learning|ml|artificial intelligence)\b/.test(normalized)) return 'BrainCircuit';
  if (/\b(cloud|devops|infrastructure)\b/.test(normalized)) return 'Cloud';
  if (/\b(tool|ecosystem|developer tools)\b/.test(normalized)) return 'Wrench';
  if (/\b(other|miscellaneous)\b/.test(normalized)) return 'LayoutGrid';
  return 'Code2';
}

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function normalizedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeSkillCategories(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const now = new Date().toISOString();
  return value.map((rawCategory, categoryIndex) => {
    const category = normalizedObject(rawCategory);
    const title = typeof category.title === 'string' ? category.title.trim() : '';
    const normalizedTitle = normalizeName(title);
    const categoryId = validIdentifier(category.id)
      ? category.id
      : generatedIdentifier('category', title, String(categoryIndex + 1));
    const categoryCreatedAt = typeof category.createdAt === 'string' ? category.createdAt : now;
    const categoryIcon = typeof category.icon === 'string' && CATEGORY_ICONS.has(category.icon)
      ? category.icon
      : getCategoryIconIdentifier(title);
    const skills = Array.isArray(category.skills) ? category.skills : [];
    return {
      id: categoryId,
      title,
      normalizedName: normalizedTitle,
      icon: categoryIcon,
      iconImage: typeof category.iconImage === 'string' ? category.iconImage : '',
      order: Number.isInteger(category.order) ? category.order : categoryIndex,
      active: typeof category.active === 'boolean' ? category.active : true,
      createdAt: categoryCreatedAt,
      updatedAt: typeof category.updatedAt === 'string' ? category.updatedAt : categoryCreatedAt,
      skills: skills.map((rawSkill, skillIndex) => {
        const skill = normalizedObject(rawSkill);
        const name = typeof skill.name === 'string' ? skill.name.trim() : '';
        const normalizedSkillName = normalizeName(name);
        const skillId = validIdentifier(skill.id)
          ? skill.id
          : generatedIdentifier('skill', name, `${categoryIndex + 1}-${skillIndex + 1}`);
        const skillCreatedAt = typeof skill.createdAt === 'string' ? skill.createdAt : now;
        const iconCandidate = typeof skill.iconIdentifier === 'string'
          ? skill.iconIdentifier
          : typeof skill.iconId === 'string'
            ? skill.iconId
            : '';
        const detectedIcon = getSkillIconIdentifier(name);
        const iconIdentifier = isSupportedSkillIcon(iconCandidate)
          && !shouldRefreshDetectedIcon(name, iconCandidate, detectedIcon)
          ? iconCandidate
          : detectedIcon;
        return {
          id: skillId,
          name,
          normalizedName: normalizedSkillName,
          categoryId,
          iconIdentifier,
          order: Number.isInteger(skill.order) ? skill.order : skillIndex,
          active: typeof skill.active === 'boolean' ? skill.active : true,
          createdAt: skillCreatedAt,
          updatedAt: typeof skill.updatedAt === 'string' ? skill.updatedAt : skillCreatedAt,
        };
      }),
    };
  });
}

export function getPublicSkillCategories(value: unknown): unknown[] {
  const categories = normalizeSkillCategories(value) as Array<Record<string, unknown>>;
  return categories
    .filter((category) => category.active === true)
    .map((category) => ({
      ...category,
      skills: (category.skills as Array<Record<string, unknown>>)
        .filter((skill) => skill.active === true)
        .sort((left, right) => Number(left.order) - Number(right.order)),
    }))
    .filter((category) => Array.isArray(category.skills) && category.skills.length > 0);
}

const LEGACY_SKILL_EXPANSIONS: Record<string, string[]> = {
  'typescript javascript': ['TypeScript', 'JavaScript'],
  'react 18 19': ['React'],
  'next js vite': ['Next.js', 'Vite'],
  'html5 canvas webgl': ['HTML5', 'Canvas', 'WebGL'],
  'node js express': ['Node.js', 'Express.js'],
  'postgresql sql': ['PostgreSQL', 'SQL'],
  'redis caching': ['Redis', 'Caching'],
  'docker containers': ['Docker', 'Containers'],
  'graphql rest': ['GraphQL', 'REST API'],
  'gemini llm apis': ['Gemini', 'LLM APIs'],
  'langchain llamaindex': ['LangChain', 'LlamaIndex'],
  'function calling agents': ['Function Calling', 'AI Agents'],
  'git github': ['Git', 'GitHub'],
  'vs code linux cli': ['VS Code', 'Linux'],
  'vite webpack': ['Vite', 'Webpack'],
  'jest vitest': ['Jest', 'Vitest'],
};

function migrateCategoryTitle(title: string): string {
  const normalized = normalizeName(title);
  if (normalized.includes('frontend') || normalized.includes('front end')) return 'Frontend';
  if (normalized.includes('ai') || normalized.includes('machine learning')) return 'AI & Machine Learning';
  if (normalized.includes('tools') || normalized.includes('ecosystem')) return 'Tools & Ecosystem';
  return title;
}

function migrateTechnologyCategory(name: string, originalCategory: string): string {
  const normalized = normalizeName(name);
  if (/\b(postgresql|postgres|sql|mysql|mongodb|redis|sqlite|database|caching)\b/.test(normalized)) return 'Database';
  if (/\b(docker|container|cloud|devops|aws|azure|kubernetes|terraform)\b/.test(normalized)) return 'Cloud & DevOps';
  if (/\b(node|express|fastapi|django|flask|php|laravel|graphql|rest api|websocket|backend)\b/.test(normalized)) return 'Backend';
  if (/\b(android|ios|mobile|flutter|react native|capacitor)\b/.test(normalized)) return 'Mobile Development';
  if (/ai|machine learning/.test(originalCategory.toLowerCase()) || /\b(gemini|llm|langchain|llamaindex|vector database|agents|openai)\b/.test(normalized)) return 'AI & Machine Learning';
  if (/tools|ecosystem/i.test(originalCategory)) return 'Tools & Ecosystem';
  if (/front/i.test(originalCategory)) return 'Frontend';
  return migrateCategoryTitle(originalCategory) || 'Other';
}

export function migrateLegacySkillCategories(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const categories = new Map<string, Record<string, unknown>>();
  const seenSkills = new Set<string>();
  const now = new Date().toISOString();
  let generatedOrder = 0;

  for (const [categoryIndex, rawCategory] of value.entries()) {
    const sourceCategory = normalizedObject(rawCategory);
    const sourceTitle = typeof sourceCategory.title === 'string' ? sourceCategory.title.trim() : '';
    const sourceSkills = Array.isArray(sourceCategory.skills) ? sourceCategory.skills : [];
    if (!sourceSkills.length) {
      const title = migrateCategoryTitle(sourceTitle);
      const key = normalizeName(title);
      if (title && !categories.has(key)) {
        categories.set(key, {
          id: validIdentifier(sourceCategory.id) ? sourceCategory.id : generatedIdentifier('category', title, String(categoryIndex + 1)),
          title,
          normalizedName: key,
          icon: typeof sourceCategory.icon === 'string' && CATEGORY_ICONS.has(sourceCategory.icon) ? sourceCategory.icon : getCategoryIconIdentifier(title),
          iconImage: typeof sourceCategory.iconImage === 'string' ? sourceCategory.iconImage : '',
          order: generatedOrder++,
          active: typeof sourceCategory.active === 'boolean' ? sourceCategory.active : true,
          createdAt: typeof sourceCategory.createdAt === 'string' ? sourceCategory.createdAt : now,
          updatedAt: typeof sourceCategory.updatedAt === 'string' ? sourceCategory.updatedAt : now,
          skills: [],
        });
      }
    }

    for (const [skillIndex, rawSkill] of sourceSkills.entries()) {
      const sourceSkill = normalizedObject(rawSkill);
      const originalName = typeof sourceSkill.name === 'string' ? sourceSkill.name.trim() : '';
      if (!originalName) continue;
      const expansionKey = normalizeName(originalName);
      const names = LEGACY_SKILL_EXPANSIONS[expansionKey] || [originalName];

      for (const name of names) {
        const normalizedSkillName = normalizeName(name);
        if (!normalizedSkillName || seenSkills.has(normalizedSkillName)) continue;
        const targetTitle = migrateTechnologyCategory(name, sourceTitle);
        const categoryKey = normalizeName(targetTitle);
        let target = categories.get(categoryKey);
        if (!target) {
          const sourceCategoryId = validIdentifier(sourceCategory.id) && targetTitle === migrateCategoryTitle(sourceTitle)
            ? sourceCategory.id
            : generatedIdentifier('category', targetTitle, String(generatedOrder + 1));
          target = {
            id: sourceCategoryId,
            title: targetTitle,
            normalizedName: categoryKey,
            icon: getCategoryIconIdentifier(targetTitle),
            iconImage: targetTitle === migrateCategoryTitle(sourceTitle) && typeof sourceCategory.iconImage === 'string' ? sourceCategory.iconImage : '',
            order: generatedOrder++,
            active: typeof sourceCategory.active === 'boolean' ? sourceCategory.active : true,
            createdAt: typeof sourceCategory.createdAt === 'string' ? sourceCategory.createdAt : now,
            updatedAt: typeof sourceCategory.updatedAt === 'string' ? sourceCategory.updatedAt : now,
            skills: [],
          };
          categories.set(categoryKey, target);
        }
        const targetSkills = target.skills as Array<Record<string, unknown>>;
        const skillCreatedAt = typeof sourceSkill.createdAt === 'string' ? sourceSkill.createdAt : now;
        const iconCandidate = typeof sourceSkill.iconIdentifier === 'string' ? sourceSkill.iconIdentifier : '';
        const detectedIcon = getSkillIconIdentifier(name);
        const iconIdentifier = isSupportedSkillIcon(iconCandidate)
          && !shouldRefreshDetectedIcon(name, iconCandidate, detectedIcon)
          ? iconCandidate
          : detectedIcon;
        targetSkills.push({
          id: validIdentifier(sourceSkill.id) && names[0] === name
            ? sourceSkill.id
            : generatedIdentifier('skill', name, `${categoryIndex + 1}-${skillIndex + 1}-${targetSkills.length + 1}`),
          name,
          normalizedName: normalizedSkillName,
          categoryId: String(target.id),
          iconIdentifier,
          order: targetSkills.length,
          active: typeof sourceSkill.active === 'boolean' ? sourceSkill.active : true,
          createdAt: skillCreatedAt,
          updatedAt: typeof sourceSkill.updatedAt === 'string' ? sourceSkill.updatedAt : skillCreatedAt,
        });
        seenSkills.add(normalizedSkillName);
      }
    }
  }

  return [...categories.values()].map((category, order) => ({ ...category, order }));
}

export function validateSkillCategories(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Skills must be an array.';
  if (value.length > 50) return 'Skills must contain no more than 50 categories.';
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  const skillIds = new Set<string>();
  const skillNames = new Set<string>();

  for (const [categoryIndex, rawCategory] of value.entries()) {
    if (!rawCategory || typeof rawCategory !== 'object' || Array.isArray(rawCategory)) {
      return `Skill category ${categoryIndex + 1} must be an object.`;
    }
    const category = rawCategory as Record<string, unknown>;
    const title = typeof category.title === 'string' ? category.title.trim() : '';
    const normalizedTitle = normalizeName(title);
    if (!title || title.length > 100) return `Skill category ${categoryIndex + 1} must have a name of 1 to 100 characters.`;
    if (categoryNames.has(normalizedTitle)) return `A category named "${title}" already exists.`;
    categoryNames.add(normalizedTitle);
    if (!validIdentifier(category.id) || categoryIds.has(category.id)) return `Skill category ${categoryIndex + 1} must have a unique valid identifier.`;
    categoryIds.add(category.id);
    if (category.normalizedName !== normalizedTitle) return `Skill category "${title}" has an invalid normalized name.`;
    if (typeof category.icon !== 'string' || !CATEGORY_ICONS.has(category.icon)) return `Skill category "${title}" has an unsupported icon.`;
    if (typeof category.active !== 'boolean' || typeof category.order !== 'number' || !Number.isInteger(category.order) || category.order < 0) {
      return `Skill category "${title}" has an invalid active state or display order.`;
    }
    if (!Array.isArray(category.skills) || category.skills.length > 200) return `Skills in "${title}" must be an array containing no more than 200 entries.`;

    for (const [skillIndex, rawSkill] of category.skills.entries()) {
      if (!rawSkill || typeof rawSkill !== 'object' || Array.isArray(rawSkill)) return `Skill ${skillIndex + 1} in "${title}" must be an object.`;
      const skill = rawSkill as Record<string, unknown>;
      const name = typeof skill.name === 'string' ? skill.name.trim() : '';
      const normalizedSkillName = normalizeName(name);
      if (!name || name.length > 100) return `Skill ${skillIndex + 1} in "${title}" must have a name of 1 to 100 characters.`;
      if (skillNames.has(normalizedSkillName)) return `The skill "${name}" already exists in another category.`;
      skillNames.add(normalizedSkillName);
      if (!validIdentifier(skill.id) || skillIds.has(skill.id)) return `Skill "${name}" must have a unique valid identifier.`;
      skillIds.add(skill.id);
      if (skill.normalizedName !== normalizedSkillName || skill.categoryId !== category.id) return `Skill "${name}" has an invalid normalized name or category reference.`;
      if (typeof skill.iconIdentifier !== 'string' || !isSupportedSkillIcon(skill.iconIdentifier)) return `Skill "${name}" has an unsupported icon identifier.`;
      if (typeof skill.active !== 'boolean' || typeof skill.order !== 'number' || !Number.isInteger(skill.order) || skill.order < 0) return `Skill "${name}" has an invalid active state or display order.`;
    }
  }
  return null;
}

function isSupportedSkillIcon(identifier: string): boolean {
  if (identifier.startsWith('simple:')) return SIMPLE_ICON_SLUGS.has(identifier.slice('simple:'.length));
  if (identifier.startsWith('lucide:')) return LUCIDE_SKILL_ICONS.has(identifier.slice('lucide:'.length));
  if (identifier.startsWith('custom:')) return CUSTOM_SKILL_ICONS.has(identifier.slice('custom:'.length));
  if (identifier.startsWith('image:') && identifier.length <= 2048) {
    const value = identifier.slice('image:'.length).trim();
    if (/^\/api\/portfolio-media\/[A-Za-z0-9._~-]+$/.test(value)) return true;
    try {
      const parsed = new URL(value);
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }
  return false;
}

function shouldRefreshDetectedIcon(name: string, candidate: string, detected: string): boolean {
  if (candidate.startsWith('lucide:') && (detected.startsWith('simple:') || detected.startsWith('custom:'))) return true;
  const normalized = normalizeName(name);
  return (
    (normalized === 'java' && candidate === 'simple:openjdk' && detected === 'custom:java') ||
    (normalized === 'linux' && candidate === 'simple:linux' && detected === 'custom:linux')
  );
}

export function createSkillId(): string {
  return randomUUID();
}
