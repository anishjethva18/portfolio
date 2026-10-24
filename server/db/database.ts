import mongoose from 'mongoose';
import {
  UserModel,
  TaskModel,
  ContactModel,
  AnalyticsModel,
  ProjectModel,
  FileMetadataModel,
  RevokedTokenModel,
} from '../models';
import { CaptureModel } from '../models/Capture';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  disabled?: boolean;
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  settings?: {
    theme?: 'light' | 'dark';
    wallpaper?: string;
    soundEnabled?: boolean;
    accentColor?: string;
  };
}

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'Work' | 'Portfolio' | 'Personal' | 'Bug' | 'Feature';
  dueDate?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StoredContact {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  status: 'delivered' | 'failed' | 'queued' | 'simulated' | 'replied';
  emailSent: boolean;
  replied?: boolean;
  repliedAt?: string;
  replyMessage?: string;
  replyHistory?: Array<{ message: string; repliedAt: string }>;
  notes?: string;
  error?: string;
}

export interface AnalyticsEvent {
  id: string;
  userId?: string;
  eventName: string;
  page?: string;
  category: 'navigation' | 'interaction' | 'auth' | 'api' | 'system';
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  expiresAt?: Date;
}

export interface ProjectData {
  id: string;
  title: string;
  tagline?: string;
  description: string;
  features?: string[];
  technologies: string[];
  category: string;
  image: string;
  githubUrl?: string;
  liveUrl?: string;
  stars: number;
  featured: boolean;
  visible?: boolean;
  sortOrder?: number;
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
  createdAt: string;
}

export interface StoredFileMetadata {
  id: string;
  userId?: string;
  name: string;
  path: string;
  parentId: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: string;
  sizeBytes?: number;
  modified: string;
  url?: string;
  diskPath?: string;
  content?: string;
  uploadedAt: string;
}

export interface CaptureData {
  id: string;
  userId: string;
  mediaType: 'photo' | 'video';
  fileName: string;
  userCapturePath: string;
  adminArchivePath: string;
  fileSize: number;
  userSaved: boolean;
  adminArchived: boolean;
  archiveExpiry: string;
  archiveConsentAt?: string;
  deleted: boolean;
  deletedAt?: string;
  error?: string;
  timestamp: string;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * MongoDB-backed Database Manager with Mongoose Models and Fast Local Cache
 */
export class DatabaseManager {
  public users: Map<string, User> = new Map();
  public tasks: Map<string, TaskItem> = new Map();
  public contacts: Map<string, StoredContact> = new Map();
  public analytics: AnalyticsEvent[] = [];
  public projects: Map<string, ProjectData> = new Map();
  public files: Map<string, StoredFileMetadata> = new Map();
  public captures: Map<string, CaptureData> = new Map();
  public revokedTokens: Set<string> = new Set();

  private syncPromise: Promise<void> | null = null;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const defaultProjects: ProjectData[] = [
      {
        id: 'windows-11-portfolio-os',
        title: 'Windows 11 Web OS Portfolio',
        description: 'A full-stack Windows 11 desktop web operating system with full VFS, native apps, and real-time services.',
        technologies: ['TypeScript', 'React', 'Node.js', 'Express', 'Tailwind CSS', 'Vite', 'MongoDB'],
        category: 'Full Stack',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
        githubUrl: 'https://github.com/anishjethva18/windows-11-portfolio-os',
        liveUrl: 'https://anishjethva.dev',
        stars: 540,
        featured: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'aether-code-ai',
        title: 'Aether Code AI Copilot',
        description: 'Real-time multi-file AI coding assistant with streaming AST refactoring and browser preview sandbox.',
        technologies: ['TypeScript', 'React', 'Node.js', 'Gemini API', 'Tailwind CSS', 'Docker'],
        category: 'AI / ML',
        image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
        githubUrl: 'https://github.com/anishjethva18/aether-code-ai',
        liveUrl: 'https://aether-code-demo.example.com',
        stars: 1240,
        featured: true,
        createdAt: '2026-01-10T00:00:00.000Z',
      },
      {
        id: 'nexus-cloud-telemetry',
        title: 'Nexus Cloud Telemetry',
        description: 'High-throughput real-time metrics monitoring for microservices with customizable D3 charts.',
        technologies: ['React', 'D3.js', 'Express', 'PostgreSQL', 'Redis', 'Tailwind CSS'],
        category: 'Full Stack',
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        githubUrl: 'https://github.com/anishjethva18/nexus-cloud-telemetry',
        liveUrl: 'https://nexus-telemetry.example.com',
        stars: 850,
        featured: true,
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ];
    defaultProjects.forEach((p) => this.projects.set(p.id, p));

    const defaultTasks: TaskItem[] = [
      {
        id: 'task-1',
        userId: 'usr_admin_anish',
        title: 'Deploy Production Windows 11 Portfolio with Docker & CI/CD',
        description: 'Set up multi-stage container build and automated unit/e2e testing suite.',
        status: 'completed',
        priority: 'high',
        category: 'Portfolio',
        dueDate: '2026-08-20',
        tags: ['DevOps', 'Docker', 'CI/CD'],
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-15T12:00:00.000Z',
        completedAt: '2026-08-15T12:00:00.000Z',
      },
      {
        id: 'task-2',
        userId: 'usr_admin_anish',
        title: 'Implement Multi-tab VSCode IDE Application',
        description: 'Provide developer environment with syntax preview, terminal link, and code runner.',
        status: 'in_progress',
        priority: 'urgent',
        category: 'Feature',
        dueDate: '2026-08-18',
        tags: ['React', 'Monaco/VSCode', 'VFS'],
        createdAt: '2026-08-10T14:00:00.000Z',
        updatedAt: '2026-08-16T08:00:00.000Z',
      },
      {
        id: 'task-3',
        userId: 'usr_admin_anish',
        title: 'Integrate Real-time Telemetry & Security Audit Monitoring',
        description: 'Log API response times, visitor flows, and geographic points of origin in Admin Dashboard.',
        status: 'pending',
        priority: 'medium',
        category: 'Portfolio',
        dueDate: '2026-08-25',
        tags: ['Analytics', 'Security', 'Telemetry'],
        createdAt: '2026-08-12T09:00:00.000Z',
        updatedAt: '2026-08-12T09:00:00.000Z',
      },
    ];
    defaultTasks.forEach((t) => this.tasks.set(t.id, t));
  }

  /**
   * Initializes MongoDB synchronization and hydrates cached collections
   */
  public async initMongoSync(): Promise<void> {
    if (mongoose.connection.readyState !== 1) return;
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = this.syncFromMongo().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  /**
   * Hydrates memory map cache from MongoDB collections
   */
  public async syncFromMongo(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1) return;

      // 1. Users
      const mongoUsers = await UserModel.find().lean();
      if (mongoUsers.length === 0) {
        // Seed default users to MongoDB
        for (const u of this.users.values()) {
          await UserModel.updateOne({ id: u.id }, { $set: u }, { upsert: true });
        }
      } else {
        this.users.clear();
        mongoUsers.forEach((u: any) => this.users.set(u.id, u as User));
      }

      // 2. Tasks
      const mongoTasks = await TaskModel.find().lean();
      if (mongoTasks.length === 0) {
        for (const t of this.tasks.values()) {
          await TaskModel.updateOne({ id: t.id }, { $set: t }, { upsert: true });
        }
      } else {
        this.tasks.clear();
        mongoTasks.forEach((t: any) => this.tasks.set(t.id, t as TaskItem));
      }

      // 3. Contacts
      const mongoContacts = await ContactModel.find().lean();
      this.contacts.clear();
      mongoContacts.forEach((c: any) => this.contacts.set(c.id, c as StoredContact));

      // 4. Projects
      const mongoProjects = await ProjectModel.find().lean();
      if (mongoProjects.length === 0) {
        for (const p of this.projects.values()) {
          await ProjectModel.updateOne({ id: p.id }, { $set: p }, { upsert: true });
        }
      } else {
        this.projects.clear();
        mongoProjects.forEach((p: any) => this.projects.set(p.id, p as ProjectData));
      }

      // 5. Files
      const mongoFiles = await FileMetadataModel.find().lean();
      this.files.clear();
      mongoFiles.forEach((f: any) => this.files.set(f.id, f as StoredFileMetadata));

      // 6. Analytics
      await AnalyticsModel.updateMany(
        { expiresAt: { $exists: false } },
        [{
          $set: {
            expiresAt: {
              $dateAdd: {
                startDate: {
                  $convert: {
                    input: '$timestamp',
                    to: 'date',
                    onError: '$$NOW',
                    onNull: '$$NOW',
                  },
                },
                unit: 'day',
                amount: 90,
              },
            },
          },
        }],
        { updatePipeline: true }
      );
      const mongoAnalytics = await AnalyticsModel.find().sort({ timestamp: -1 }).limit(1000).lean();
      this.analytics = mongoAnalytics as AnalyticsEvent[];

      // 7. Revoked Tokens
      const mongoRevoked = await RevokedTokenModel.find().lean();
      this.revokedTokens.clear();
      mongoRevoked.forEach((r: any) => this.revokedTokens.add(r.token));

      // 9. Captures
      const mongoCaptures = await CaptureModel.find().lean();
      this.captures.clear();
      mongoCaptures.forEach((c: any) => this.captures.set(c.id, c as CaptureData));

      console.log(`[DB] MongoDB cache synchronized: ${this.users.size} users, ${this.tasks.size} tasks, ${this.contacts.size} contacts, ${this.files.size} files, ${this.projects.size} projects, ${this.captures.size} captures.`);
    } catch (err: any) {
      console.error('[DB] Error during syncFromMongo:', err);
    }
  }

  // --- User Repository Methods ---
  public getUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  public getUserByEmail(email: string): User | undefined {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase().trim() === normalized) {
        return user;
      }
    }
    return undefined;
  }

  public async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      ...userData,
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: userData.email.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(user.id, user);

    if (mongoose.connection.readyState === 1) {
      try {
        await UserModel.create(user);
      } catch (err: any) {
        console.error('[DB] Error saving user to MongoDB:', err.message);
      }
    }

    return user;
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated: User = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.users.set(id, updated);

    if (mongoose.connection.readyState === 1) {
      try {
        await UserModel.updateOne({ id }, { $set: updated });
      } catch (err: any) {
        console.error('[DB] Error updating user in MongoDB:', err.message);
      }
    }

    return updated;
  }

  public async deleteUser(id: string): Promise<boolean> {
    const deleted = this.users.delete(id);

    if (mongoose.connection.readyState === 1) {
      try {
        await UserModel.deleteOne({ id });
      } catch (err: any) {
        console.error('[DB] Error deleting user from MongoDB:', err.message);
      }
    }

    return deleted;
  }

  // --- Task Repository Methods with Filtering, Sorting & Pagination ---
  public getTasks(): TaskItem[] {
    return Array.from(this.tasks.values());
  }

  public getTaskById(id: string): TaskItem | undefined {
    return this.tasks.get(id);
  }

  public getTasksFiltered(options: {
    userId?: string;
    isAdmin?: boolean;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): PaginationResult<TaskItem> {
    const {
      userId,
      isAdmin = false,
      status,
      priority,
      category,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 50,
    } = options;

    let items = Array.from(this.tasks.values()).filter((t) => {
      if (!isAdmin && userId && t.userId !== userId) return false;
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      if (category && t.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
        const matchTag = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchTag) return false;
      }
      return true;
    });

    items.sort((a, b) => {
      let valA: any = (a as any)[sortBy] ?? '';
      let valB: any = (b as any)[sortBy] ?? '';
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return order === 'asc' ? cmp : -cmp;
      }
      return order === 'asc' ? valA - valB : valB - valA;
    });

    const total = items.length;
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const startIdx = (safePage - 1) * safeLimit;
    const paginatedItems = items.slice(startIdx, startIdx + safeLimit);

    return {
      items: paginatedItems,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  public async createTask(data: {
    userId: string;
    title: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'completed';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    category?: 'Work' | 'Portfolio' | 'Personal' | 'Bug' | 'Feature';
    dueDate?: string;
    tags?: string[];
  }): Promise<TaskItem> {
    const task: TaskItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: data.userId,
      title: data.title.trim(),
      description: data.description?.trim() || '',
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      category: data.category || 'Portfolio',
      dueDate: data.dueDate,
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);

    if (mongoose.connection.readyState === 1) {
      try {
        await TaskModel.create(task);
      } catch (err: any) {
        console.error('[DB] Error saving task to MongoDB:', err.message);
      }
    }

    return task;
  }

  public async updateTask(id: string, updates: Partial<TaskItem>): Promise<TaskItem | null> {
    const task = this.tasks.get(id);
    if (!task) return null;

    let completedAt = task.completedAt;
    if (updates.status === 'completed' && !completedAt && !updates.completedAt) {
      completedAt = new Date().toISOString();
    } else if (updates.completedAt !== undefined) {
      completedAt = updates.completedAt;
    } else if (updates.status && updates.status !== 'completed') {
      completedAt = undefined;
    }

    const updated: TaskItem = {
      ...task,
      ...updates,
      completedAt,
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(id, updated);

    if (mongoose.connection.readyState === 1) {
      try {
        await TaskModel.updateOne({ id }, { $set: updated });
      } catch (err: any) {
        console.error('[DB] Error updating task in MongoDB:', err.message);
      }
    }

    return updated;
  }

  public async deleteTask(id: string): Promise<boolean> {
    const deleted = this.tasks.delete(id);

    if (mongoose.connection.readyState === 1) {
      try {
        await TaskModel.deleteOne({ id });
      } catch (err: any) {
        console.error('[DB] Error deleting task from MongoDB:', err.message);
      }
    }

    return deleted;
  }

  // --- Contact Repository Methods ---
  public getContacts(): StoredContact[] {
    return Array.from(this.contacts.values());
  }

  public getContactById(id: string): StoredContact | undefined {
    return this.contacts.get(id);
  }

  public async createContact(data: Omit<StoredContact, 'id' | 'timestamp'>): Promise<StoredContact> {
    const contact: StoredContact = {
      ...data,
      id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    this.contacts.set(contact.id, contact);

    if (mongoose.connection.readyState === 1) {
      try {
        await ContactModel.create(contact);
      } catch (err: any) {
        console.error('[DB] Error creating contact in MongoDB:', err.message);
      }
    }

    return contact;
  }

  public getContactsFiltered(options: {
    status?: string;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): PaginationResult<StoredContact> {
    const {
      status,
      search,
      sortBy = 'timestamp',
      order = 'desc',
      page = 1,
      limit = 50,
    } = options;

    let items = Array.from(this.contacts.values()).filter((c) => {
      if (status && c.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchEmail = c.email.toLowerCase().includes(q);
        const matchSubject = c.subject.toLowerCase().includes(q);
        const matchMsg = c.message.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchSubject && !matchMsg) return false;
      }
      return true;
    });

    items.sort((a, b) => {
      let valA = (a as any)[sortBy] || '';
      let valB = (b as any)[sortBy] || '';
      const cmp = String(valA).localeCompare(String(valB));
      return order === 'asc' ? cmp : -cmp;
    });

    const total = items.length;
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const startIdx = (safePage - 1) * safeLimit;
    const paginatedItems = items.slice(startIdx, startIdx + safeLimit);

    return {
      items: paginatedItems,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  public async updateContactStatus(
    id: string,
    updates: { status?: StoredContact['status']; notes?: string; replied?: boolean; replyMessage?: string }
  ): Promise<StoredContact | null> {
    const contact = this.contacts.get(id);
    if (!contact) return null;

    const replyTimestamp = updates.replyMessage || updates.replied ? new Date().toISOString() : contact.repliedAt;
    const updated: StoredContact = {
      ...contact,
      ...updates,
      status: updates.replyMessage ? 'replied' : updates.status || contact.status,
      replied: updates.replyMessage ? true : updates.replied !== undefined ? updates.replied : contact.replied,
      repliedAt: replyTimestamp,
    };
    if (updates.replyMessage) {
      const history = contact.replyHistory?.length
        ? contact.replyHistory
        : contact.replyMessage
          ? [{ message: contact.replyMessage, repliedAt: contact.repliedAt || contact.timestamp }]
          : [];
      updated.replyHistory = [...history, { message: updates.replyMessage, repliedAt: replyTimestamp || new Date().toISOString() }];
    }

    this.contacts.set(id, updated);

    if (mongoose.connection.readyState === 1) {
      try {
        await ContactModel.updateOne({ id }, { $set: updated });
      } catch (err: any) {
        console.error('[DB] Error updating contact in MongoDB:', err.message);
      }
    }

    return updated;
  }

  public async deleteContact(id: string): Promise<boolean> {
    const deleted = this.contacts.delete(id);

    if (mongoose.connection.readyState === 1) {
      try {
        await ContactModel.deleteOne({ id });
      } catch (err: any) {
        console.error('[DB] Error deleting contact from MongoDB:', err.message);
      }
    }

    return deleted;
  }

  // --- Analytics Repository Methods ---
  public async logEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<AnalyticsEvent> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };

    this.analytics.unshift(fullEvent);
    if (this.analytics.length > 2000) {
      this.analytics.pop();
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await AnalyticsModel.create(fullEvent);
      } catch (err: any) {
        console.error('[DB] Error saving analytics event to MongoDB:', err.message);
      }
    }

    return fullEvent;
  }

  public getAnalyticsSummary() {
    const totalRequests = this.analytics.length;
    const categoryCounts: Record<string, number> = {};
    const pageCounts: Record<string, number> = {};

    this.analytics.forEach((e) => {
      categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
      if (e.page) pageCounts[e.page] = (pageCounts[e.page] || 0) + 1;
    });

    return {
      totalRequests,
      categoryCounts,
      topPages: Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([page, count]) => ({ page, count })),
      recentEvents: this.analytics.slice(0, 50),
    };
  }

  public getAnalyticsLogsFiltered(options: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): PaginationResult<AnalyticsEvent> {
    const { category, search, page = 1, limit = 50 } = options;

    let items = this.analytics.filter((e) => {
      if (category && e.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = e.eventName.toLowerCase().includes(q);
        const matchPage = e.page?.toLowerCase().includes(q) ?? false;
        const matchIp = e.ipAddress?.includes(q) ?? false;
        if (!matchName && !matchPage && !matchIp) return false;
      }
      return true;
    });

    const total = items.length;
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const startIdx = (safePage - 1) * safeLimit;
    const paginated = items.slice(startIdx, startIdx + safeLimit);

    return {
      items: paginated,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  // --- Project Repository Methods ---
  public getProjects(): ProjectData[] {
    return Array.from(this.projects.values());
  }

  public getProjectById(id: string): ProjectData | undefined {
    return this.projects.get(id);
  }

  public async addProject(project: Omit<ProjectData, 'createdAt'>): Promise<ProjectData> {
    const full: ProjectData = {
      ...project,
      createdAt: new Date().toISOString(),
    };

    this.projects.set(full.id, full);

    if (mongoose.connection.readyState === 1) {
      try {
        await ProjectModel.updateOne({ id: full.id }, { $set: full }, { upsert: true });
      } catch (err: any) {
        console.error('[DB] Error saving project to MongoDB:', err.message);
      }
    }

    return full;
  }

  public async updateProject(id: string, updates: Partial<ProjectData>): Promise<ProjectData | null> {
    const existing = this.projects.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    this.projects.set(id, updated);

    if (mongoose.connection.readyState === 1) {
      try {
        await ProjectModel.updateOne({ id }, { $set: updated });
      } catch (err: any) {
        console.error('[DB] Error updating project in MongoDB:', err.message);
      }
    }

    return updated;
  }

  public async deleteProject(id: string): Promise<boolean> {
    const deleted = this.projects.delete(id);

    if (mongoose.connection.readyState === 1) {
      try {
        await ProjectModel.deleteOne({ id });
      } catch (err: any) {
        console.error('[DB] Error deleting project from MongoDB:', err.message);
      }
    }

    return deleted;
  }

  // --- File Repository Methods ---
  public getFiles(): StoredFileMetadata[] {
    return Array.from(this.files.values());
  }

  public getFileById(id: string): StoredFileMetadata | undefined {
    return this.files.get(id);
  }

  public getFilesFiltered(options: {
    userId?: string;
    isAdmin?: boolean;
    parentId?: string;
    extension?: string;
    type?: 'file' | 'folder';
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): PaginationResult<StoredFileMetadata> {
    const {
      userId,
      isAdmin = false,
      parentId,
      extension,
      type,
      search,
      sortBy = 'uploadedAt',
      order = 'desc',
      page = 1,
      limit = 50,
    } = options;

    let items = Array.from(this.files.values()).filter((f) => {
      if (!isAdmin && userId && f.userId && f.userId !== userId) return false;
      if (parentId && f.parentId !== parentId) return false;
      if (extension && f.extension?.toLowerCase() !== extension.toLowerCase()) return false;
      if (type && f.type !== type) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !f.path.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    items.sort((a, b) => {
      let valA: any = (a as any)[sortBy] ?? '';
      let valB: any = (b as any)[sortBy] ?? '';
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return order === 'asc' ? cmp : -cmp;
      }
      return order === 'asc' ? valA - valB : valB - valA;
    });

    const total = items.length;
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const startIdx = (safePage - 1) * safeLimit;
    const paginated = items.slice(startIdx, startIdx + safeLimit);

    return {
      items: paginated,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  public async saveFile(file: StoredFileMetadata): Promise<StoredFileMetadata> {
    this.files.set(file.id, file);

    if (mongoose.connection.readyState === 1) {
      try {
        await FileMetadataModel.updateOne({ id: file.id }, { $set: file }, { upsert: true });
      } catch (err: any) {
        console.error('[DB] Error saving file metadata to MongoDB:', err.message);
      }
    }

    return file;
  }

  public saveFileMetadata(file: StoredFileMetadata): StoredFileMetadata {
    this.saveFile(file);
    return file;
  }

  public updateFileMetadata(id: string, updates: Partial<StoredFileMetadata>): StoredFileMetadata | null {
    const file = this.files.get(id);
    if (!file) return null;
    const updated = { ...file, ...updates };
    this.files.set(id, updated);
    if (mongoose.connection.readyState === 1) {
      FileMetadataModel.updateOne({ id }, { $set: updated }).catch((err) => {
        console.error('[DB] Error updating file metadata in MongoDB:', err.message);
      });
    }
    return updated;
  }

  public async deleteFile(id: string): Promise<boolean> {
    const deleted = this.files.delete(id);

    if (mongoose.connection.readyState === 1) {
      try {
        await FileMetadataModel.deleteOne({ id });
      } catch (err: any) {
        console.error('[DB] Error deleting file metadata from MongoDB:', err.message);
      }
    }

    return deleted;
  }

  public deleteFileMetadata(id: string): boolean {
    const deleted = this.files.delete(id);
    if (mongoose.connection.readyState === 1) {
      FileMetadataModel.deleteOne({ id }).catch((err) => {
        console.error('[DB] Error deleting file metadata from MongoDB:', err.message);
      });
    }
    return deleted;
  }

  // --- Token Revocation & Password Reset Repository Methods ---
  public async revokeToken(token: string): Promise<void> {
    this.revokedTokens.add(token);

    if (mongoose.connection.readyState === 1) {
      try {
        await RevokedTokenModel.create({ token, revokedAt: new Date() });
      } catch (err: any) {
        // duplicate token already marked revoked
      }
    }
  }

  public isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  // --- Capture Repository Methods ---
  public getCapturesByUser(userId: string): CaptureData[] {
    return Array.from(this.captures.values()).filter((c) => c.userId === userId);
  }

  public getAllCaptures(): CaptureData[] {
    return Array.from(this.captures.values());
  }

  public getCaptureById(id: string): CaptureData | undefined {
    return this.captures.get(id);
  }

  public async createCapture(capture: CaptureData): Promise<CaptureData> {
    this.captures.set(capture.id, capture);
    if (mongoose.connection.readyState === 1) {
      try {
        await CaptureModel.updateOne({ id: capture.id }, { $set: capture }, { upsert: true });
      } catch (err: any) {
        console.error('[DB] Error saving capture to MongoDB:', err.message);
      }
    }
    return capture;
  }

  public async deleteCaptureByUser(id: string): Promise<boolean> {
    const capture = this.captures.get(id);
    if (!capture) return false;

    capture.deleted = true;
    capture.deletedAt = new Date().toISOString();
    this.captures.set(id, capture);

    if (mongoose.connection.readyState === 1) {
      try {
        await CaptureModel.updateOne({ id }, { $set: { deleted: true, deletedAt: capture.deletedAt } });
      } catch (err: any) {
        console.error('[DB] Error marking capture deleted in MongoDB:', err.message);
      }
    }

    return true;
  }
}

// Global database instance singleton
export const db = new DatabaseManager();
