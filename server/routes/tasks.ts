import { Router, Response } from 'express';
import { db, TaskItem } from '../db/database';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const tasksRouter = Router();

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const VALID_STATUSES = ['pending', 'in_progress', 'completed'] as const;
const VALID_CATEGORIES = ['Work', 'Portfolio', 'Personal', 'Bug', 'Feature'] as const;

/**
 * GET /api/tasks
 * Returns tasks belonging to the authenticated user (or all tasks for administrators)
 * Supports status, priority, category, and text search filtering, with sorting & pagination.
 */
tasksRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const {
    status,
    priority,
    category,
    search,
    sortBy,
    order,
    page = '1',
    limit = '50',
  } = req.query;

  const result = db.getTasksFiltered({
    userId: req.user.userId,
    isAdmin: req.user.role === 'admin',
    status: status ? String(status) : undefined,
    priority: priority ? String(priority) : undefined,
    category: category ? String(category) : undefined,
    search: search ? String(search) : undefined,
    sortBy: sortBy ? String(sortBy) : 'createdAt',
    order: order === 'asc' ? 'asc' : 'desc',
    page: parseInt(page as string, 10) || 1,
    limit: parseInt(limit as string, 10) || 50,
  });

  res.json({
    success: true,
    total: result.total,
    tasks: result.items,
    pagination: {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      total: result.total,
    },
  });
});

/**
 * GET /api/tasks/:id
 * Retrieve single task with ownership check
 */
tasksRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const task = db.getTaskById(id);

  if (!task) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }

  if (task.userId !== req.user.userId && req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have permission to view this task',
      code: 'FORBIDDEN_OWNERSHIP',
    });
    return;
  }

  res.json({ success: true, task });
});

/**
 * POST /api/tasks
 * Create task strictly owned by authenticated user with payload validation
 */
tasksRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { title, description, priority, category, dueDate, tags } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, error: 'Task title is required and cannot be empty.' });
      return;
    }

    if (title.trim().length > 200) {
      res.status(400).json({ success: false, error: 'Task title cannot exceed 200 characters.' });
      return;
    }

    const safePriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
    const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'Portfolio';

    // Validate dueDate format if supplied
    let safeDueDate: string | undefined;
    if (dueDate) {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) {
        safeDueDate = d.toISOString().split('T')[0];
      }
    }

    const safeTags = Array.isArray(tags)
      ? tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 30)).slice(0, 10)
      : [];

    const newTask = db.createTask({
      userId: req.user.userId,
      title: title.trim(),
      description: description ? String(description).trim().slice(0, 2000) : '',
      status: 'pending',
      priority: safePriority,
      category: safeCategory,
      dueDate: safeDueDate,
      tags: safeTags,
    });

    res.status(201).json({ success: true, task: newTask });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create task' });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task with resource ownership enforcement and validation
 */
tasksRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const task = db.getTaskById(id);

  if (!task) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }

  // Enforce resource ownership: creator or admin only
  if (task.userId !== req.user.userId && req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have permission to modify this task',
      code: 'FORBIDDEN_OWNERSHIP',
    });
    return;
  }

  const { title, description, status, priority, category, dueDate, tags } = req.body;
  const updates: Partial<TaskItem> = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, error: 'Task title cannot be empty.' });
      return;
    }
    updates.title = title.trim().slice(0, 200);
  }

  if (description !== undefined) {
    updates.description = String(description).trim().slice(0, 2000);
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }
    updates.status = status;
    if (status === 'completed' && !task.completedAt) {
      updates.completedAt = new Date().toISOString();
    } else if (status !== 'completed') {
      updates.completedAt = undefined;
    }
  }

  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ success: false, error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
      return;
    }
    updates.priority = priority;
  }

  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      return;
    }
    updates.category = category;
  }

  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === '') {
      updates.dueDate = undefined;
    } else {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) {
        updates.dueDate = d.toISOString().split('T')[0];
      }
    }
  }

  if (tags !== undefined) {
    updates.tags = Array.isArray(tags)
      ? tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 30)).slice(0, 10)
      : [];
  }

  const updated = db.updateTask(id, updates);
  res.json({ success: true, task: updated });
});

/**
 * DELETE /api/tasks/:id
 * Delete task with resource ownership enforcement
 */
tasksRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const task = db.getTaskById(id);

  if (!task) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }

  // Enforce resource ownership: creator or admin only
  if (task.userId !== req.user.userId && req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have permission to delete this task',
      code: 'FORBIDDEN_OWNERSHIP',
    });
    return;
  }

  db.deleteTask(id);
  res.json({ success: true, message: 'Task removed successfully' });
});
