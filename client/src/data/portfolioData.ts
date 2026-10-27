import { AppMetadata, ExperienceItem, EducationItem, ProjectData } from '../types';

export const PORTFOLIO_USER = {
  name: 'Anish Jethva',
  title: 'Full Stack & AI Engineer',
  avatar: '/avatar.png',
  location: 'India',
  email: 'anish.jethva2006@gmail.com',
  github: 'https://github.com/anishjethva18',
  instagram: 'https://www.instagram.com/anish_jethva18',
  linkedin: 'https://www.linkedin.com/in/anishjethva/',
  website: 'https://anishjethva.dev',
  tagline: 'Building intelligent software, agentic systems, and joyful web operating systems.',
  bio: `Passionate Full Stack & AI Engineer with expertise in architecting high-performance web applications, cloud systems, and generative AI interfaces. Obsessed with clean UI/UX, responsive systems design, and craft in frontend and backend technologies.`,
  goals: [
    'Master agentic AI systems and multi-modal integration',
    'Contribute to transformative open-source developer tooling',
    'Build intuitive, joyful software that solves real human problems',
  ],
};

export const APPS_LIST: AppMetadata[] = [
  { id: 'about', name: 'About Me', icon: 'About', category: 'Portfolio', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 800, defaultHeight: 620 },
  { id: 'projects', name: 'Projects', icon: 'Projects', category: 'Portfolio', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 920, defaultHeight: 650 },
  { id: 'resume', name: 'Resume CV', icon: 'Resume', category: 'Portfolio', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 820, defaultHeight: 680 },
  { id: 'contact', name: 'Contact Me', icon: 'Contact', category: 'Portfolio', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 700, defaultHeight: 560 },
  { id: 'explorer', name: 'File Explorer', icon: 'FileExplorer', category: 'System', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 900, defaultHeight: 600 },
  { id: 'terminal', name: 'Terminal', icon: 'Terminal', category: 'System', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 780, defaultHeight: 500 },
  { id: 'browser', name: 'Web Browser', icon: 'Globe', category: 'Utilities', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 960, defaultHeight: 650 },
  { id: 'notepad', name: 'Notepad', icon: 'Notepad', category: 'Utilities', pinnedToTaskbar: false, pinnedToStart: true, desktopShortcut: true, defaultWidth: 720, defaultHeight: 520 },
  { id: 'settings', name: 'Settings', icon: 'Settings', category: 'System', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 860, defaultHeight: 600 },
  { id: 'taskmanager', name: 'Task Manager', icon: 'TaskManager', category: 'System', pinnedToTaskbar: false, pinnedToStart: true, desktopShortcut: true, defaultWidth: 800, defaultHeight: 550 },
  { id: 'recycle', name: 'Recycle Bin', icon: 'Recycle', category: 'System', pinnedToTaskbar: false, pinnedToStart: false, desktopShortcut: true, defaultWidth: 750, defaultHeight: 500 },
  { id: 'minesweeper', name: 'Minesweeper', icon: 'Minesweeper', category: 'Games', pinnedToTaskbar: false, pinnedToStart: true, desktopShortcut: true, defaultWidth: 420, defaultHeight: 580 },
  { id: 'snake', name: 'Retro Snake', icon: 'Snake', category: 'Games', pinnedToTaskbar: false, pinnedToStart: true, desktopShortcut: true, defaultWidth: 500, defaultHeight: 600 },
  { id: 'calculator', name: 'Calculator', icon: 'Calculator', category: 'Utilities', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 340, defaultHeight: 520 },
  { id: 'camera', name: 'Camera', icon: 'Camera', category: 'Utilities', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 780, defaultHeight: 580 },
  { id: 'photos', name: 'Media', icon: 'Media', category: 'Utilities', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 860, defaultHeight: 620 },
  { id: 'admin', name: 'Admin Control Center', icon: 'ShieldCheck', category: 'System', pinnedToTaskbar: true, pinnedToStart: true, desktopShortcut: true, defaultWidth: 1120, defaultHeight: 740 },
];

export const PROJECTS_DATA: ProjectData[] = [
  {
    id: 'windows-11-portfolio-os',
    title: 'Windows 11 Portfolio OS',
    tagline: 'Interactive desktop web operating system with full VFS, native apps, and real-time services.',
    description: 'A desktop web experience reproducing the Windows 11 Fluent interface, complete with draggable snapped windows, an interactive terminal, Camera app with WebGL filters, Edge browser with CORS proxy, and persistent file system.',
    category: 'Full Stack',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    technologies: ['TypeScript', 'React', 'Node.js', 'Express', 'Tailwind CSS', 'Vite'],
    features: [
      'Authentic Windows 11 UI shell with Aero backdrop and Fluent motion',
      'Persistent VFS across IndexedDB, LocalStorage, and REST endpoints',
      'Real Camera API recording with video codecs and filter shaders',
      'Edge browser with CORS proxy and live web search'
    ],
    githubUrl: 'https://github.com/anishjethva18/windows-11-portfolio-os',
    liveUrl: 'https://anishjethva.dev',
    stars: 540,
    featured: true,
  },
  {
    id: 'ai-code-copilot',
    title: 'Aether Code AI',
    tagline: 'Real-time multi-file AI coding assistant with streaming AST refactoring.',
    description: 'A desktop & browser-based AI code agent that integrates LLM reasoning with real-time browser preview, static AST validation, and automated test suite execution.',
    category: 'AI / ML',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    technologies: ['TypeScript', 'React', 'Node.js', 'Gemini API', 'Tailwind CSS', 'Docker'],
    features: [
      'Multi-file contextual code editing',
      'Real-time WebSockets code execution pipeline',
      'Automated error diagnosis and auto-fixing',
      'Interactive visual DOM sandbox'
    ],
    githubUrl: 'https://github.com/anishjethva18/aether-code-ai',
    liveUrl: 'https://aether-code-demo.example.com',
    stars: 1240,
    featured: true,
  },
  {
    id: 'cloud-analytics-dash',
    title: 'Nexus Cloud Telemetry',
    tagline: 'High-throughput real-time metrics monitoring for microservices.',
    description: 'An enterprise cloud monitoring suite built for low-latency web metrics, customizable dashboard widgets, and instant anomaly detection alerts.',
    category: 'Full Stack',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    technologies: ['React', 'D3.js', 'Express', 'PostgreSQL', 'Redis', 'Tailwind CSS'],
    features: [
      'Live WebSockets telemetry streaming with D3 chart rendering',
      'Custom drag & drop dashboard grid manager',
      'Threshold alert notification webhooks',
      'Role-based security & audit log exporter'
    ],
    githubUrl: 'https://github.com/anishjethva18/nexus-cloud-telemetry',
    liveUrl: 'https://nexus-telemetry.example.com',
    stars: 850,
    featured: true,
  },
  {
    id: 'spatial-canvas-notes',
    title: 'MindCraft Canvas',
    tagline: 'Infinite spatial whiteboard for visual research and Markdown docs.',
    description: 'A spatial knowledge base application combining node graphs, rich text editing, visual PDF annotating, and local-first SQLite sync.',
    category: 'Frontend',
    image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
    technologies: ['React', 'TypeScript', 'Canvas / WebGL', 'Zustand', 'Tailwind CSS'],
    features: [
      'Infinite canvas panning with smooth 120fps zoom',
      'Bi-directional Markdown document links and graph view',
      'Offline-first IndexedDB persistent sync',
      'Export to high-res SVG, PNG, and PDF'
    ],
    githubUrl: 'https://github.com/anishjethva18/mindcraft-canvas',
    liveUrl: 'https://mindcraft-canvas.example.com',
    stars: 620,
    featured: true,
  },
  {
    id: 'vector-search-engine',
    title: 'HyperVector DB',
    tagline: 'Lightweight in-memory vector database for fast semantic document search.',
    description: 'An open-source high-speed vector storage engine with HNSW indexing, Cosine similarity evaluation, and RESTful API endpoints.',
    category: 'Open Source',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    technologies: ['Node.js', 'TypeScript', 'WebAssembly', 'Jest', 'Docker'],
    features: [
      'Fast HNSW vector index construction',
      'REST & gRPC interface with OpenAPI specs',
      'Supports OpenAI, Gemini, and Cohere embeddings',
      'Benchmark suite handling 100k+ embeddings under 5ms latency'
    ],
    githubUrl: 'https://github.com/anishjethva18/hypervector-db',
    stars: 1980,
    featured: false,
  },
];

export const EXPERIENCES: ExperienceItem[] = [
  {
    role: 'Senior Full Stack & AI Engineer',
    company: 'Apex Tech Solutions',
    period: '2023 - Present',
    location: 'India',
    description: [
      'Spearheaded the development of generative AI tools that improved developer productivity by 40%.',
      'Architected microservices processing 50M+ daily events using Node.js, Express, and PostgreSQL.',
      'Mentored engineers and established company-wide standards for TypeScript and automated testing.',
    ],
    skills: ['TypeScript', 'React', 'Node.js', 'Gemini API', 'Docker', 'PostgreSQL'],
  },
  {
    role: 'Full Stack Engineer',
    company: 'Vanguard Digital Labs',
    period: '2021 - 2023',
    location: 'India',
    description: [
      'Built interactive data visualization dashboards for enterprise cloud telemetry tools.',
      'Optimized React bundle size by 38% through code splitting and asset compression.',
      'Designed and deployed resilient serverless backend endpoints and caching layers.',
    ],
    skills: ['React', 'Redux', 'D3.js', 'Node.js', 'Tailwind CSS', 'Jest'],
  },
  {
    role: 'Frontend Developer',
    company: 'PixelCraft Interactive',
    period: '2019 - 2021',
    location: 'India',
    description: [
      'Developed responsive client web apps for modern SaaS products.',
      'Collaborated closely with UI/UX designers to translate Figma mockups into pixel-perfect components.',
    ],
    skills: ['JavaScript', 'React', 'CSS3 / SASS', 'REST APIs', 'Git'],
  },
];

export const EDUCATION: EducationItem[] = [
  {
    degree: 'B.Tech in Computer Science & Engineering',
    institution: 'Engineering Institute of Technology',
    period: '2019 - 2023',
    details: 'Graduated with Distinction. Focused on Distributed Computing, Full Stack Web Architecture, and Artificial Intelligence.',
  },
];
