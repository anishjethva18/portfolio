const SKILL_ICON_ALIASES: Record<string, string> = {
  angular: 'angular',
  anaconda: 'anaconda',
  aws: 'custom:aws',
  'amazon web services': 'custom:aws',
  amazonaws: 'custom:aws',
  anthropic: 'anthropic',
  android: 'android',
  astro: 'astro',
  apple: 'apple',
  bun: 'bun',
  bootstrap: 'bootstrap',
  c: 'c',
  'c#': 'custom:csharp',
  'c sharp': 'custom:csharp',
  capacitor: 'capacitor',
  'c++': 'cplusplus',
  chatgpt: 'custom:openai',
  'chat gpt': 'custom:openai',
  openai: 'custom:openai',
  'claude code': 'claudecode',
  cursor: 'cursor',
  deepseek: 'deepseek',
  css: 'css',
  css3: 'css',
  django: 'django',
  deno: 'deno',
  docker: 'docker',
  dotnet: 'dotnet',
  elasticsearch: 'elasticsearch',
  express: 'express',
  'express.js': 'express',
  fastapi: 'fastapi',
  figma: 'figma',
  firebase: 'firebase',
  flask: 'flask',
  flutter: 'flutter',
  go: 'go',
  gemini: 'googlegemini',
  claude: 'anthropic',
  git: 'git',
  github: 'github',
  'github actions': 'githubactions',
  'github copilot': 'githubcopilot',
  gitlab: 'gitlab',
  googlecloud: 'googlecloud',
  'google cloud': 'googlecloud',
  'google gemini': 'googlegemini',
  graphql: 'graphql',
  huggingface: 'huggingface',
  'hugging face': 'huggingface',
  html: 'html5',
  html5: 'html5',
  insomnia: 'insomnia',
  jest: 'jest',
  'jupyter notebook': 'jupyter',
  kafka: 'apachekafka',
  kubernetes: 'kubernetes',
  javascript: 'javascript',
  js: 'javascript',
  langchain: 'langchain',
  linux: 'custom:linux',
  nestjs: 'nestjs',
  laravel: 'laravel',
  mysql: 'mysql',
  mistral: 'mistralai',
  'mistral ai': 'mistralai',
  netlify: 'netlify',
  nginx: 'nginx',
  numpy: 'numpy',
  nuxt: 'nuxt',
  ollama: 'ollama',
  openrouter: 'openrouter',
  mongodb: 'mongodb',
  'next.js': 'nextdotjs',
  nextjs: 'nextdotjs',
  'node.js': 'nodedotjs',
  node: 'nodedotjs',
  nodejs: 'nodedotjs',
  pandas: 'pandas',
  perplexity: 'perplexity',
  php: 'php',
  postman: 'postman',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  prisma: 'prisma',
  pytorch: 'pytorch',
  python: 'python',
  react: 'react',
  'react.js': 'react',
  'react native': 'react',
  redis: 'redis',
  replit: 'replit',
  replicate: 'replicate',
  render: 'render',
  rust: 'rust',
  svelte: 'svelte',
  supabase: 'supabase',
  sass: 'sass',
  tailwind: 'tailwindcss',
  'tailwind css': 'tailwindcss',
  typescript: 'typescript',
  ts: 'typescript',
  tensorflow: 'tensorflow',
  terraform: 'terraform',
  'three.js': 'threedotjs',
  threejs: 'threedotjs',
  vitest: 'vitest',
  vercel: 'vercel',
  vue: 'vuedotjs',
  vuejs: 'vuedotjs',
  vite: 'vite',
  webpack: 'webpack',
  yarn: 'yarn',
  'visual studio code': 'custom:vscode',
  'vs code': 'custom:vscode',
  vscode: 'custom:vscode',
  kotlin: 'kotlin',
  swift: 'swift',
  sqlite: 'sqlite',
  java: 'custom:java',
  openjdk: 'openjdk',
};

const ICON_NORMALIZATION = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const GENERIC_SKILL_ICON_OPTIONS: Array<readonly [string, string]> = [
  ['custom:aws', 'Amazon Web Services (AWS)'] as const,
  ['simple:anaconda', 'Anaconda'] as const,
  ['lucide:Code2', 'Code'] as const,
  ['custom:csharp', 'C#'] as const,
  ['simple:c', 'C'] as const,
  ['custom:openai', 'ChatGPT / OpenAI'] as const,
  ['custom:java', 'Java'] as const,
  ['custom:linux', 'Linux'] as const,
  ['custom:vscode', 'Visual Studio Code'] as const,
  ['lucide:BrainCircuit', 'AI / machine learning'] as const,
  ['lucide:Database', 'Database'] as const,
  ['lucide:Network', 'Network'] as const,
  ['lucide:ShieldCheck', 'Security'] as const,
  ['lucide:ChartNoAxesCombined', 'Analytics'] as const,
].sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: 'base' }));

export const CATEGORY_ICON_OPTIONS = [
  'LayoutGrid', 'Monitor', 'Code2', 'Server', 'Smartphone', 'Database',
  'BrainCircuit', 'Cloud', 'Wrench', 'ShieldCheck', 'ChartNoAxesCombined',
  'GraduationCap', 'MessagesSquare', 'HardDrive', 'Sparkles',
  'Sliders',
].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

export function getSkillIconIdentifier(name: string): string {
  const normalized = ICON_NORMALIZATION(name);
  const rawNormalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/(^|\s)c#(?=$|\s)/.test(rawNormalized) || rawNormalized === 'c sharp' || normalized === 'c sharp') return 'custom:csharp';
  if (/^c(?:\s+(?:programming|language|lang))?$/.test(rawNormalized)) return 'simple:c';
  const exact = SKILL_ICON_ALIASES[rawNormalized] || SKILL_ICON_ALIASES[normalized];
  if (exact) return exact.startsWith('custom:') || exact.startsWith('lucide:') ? exact : `simple:${exact}`;
  const paddedName = ` ${normalized} `;
  const matchingAlias = Object.entries(SKILL_ICON_ALIASES)
    .map(([alias, identifier]) => ({ alias: ICON_NORMALIZATION(alias), identifier }))
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
  const normalized = ICON_NORMALIZATION(name);
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
