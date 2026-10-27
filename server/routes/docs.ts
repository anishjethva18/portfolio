import { Router, Request, Response } from 'express';

export const docsRouter = Router();

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Windows 11 OS Portfolio Production API',
    version: '2.1.0',
    description:
      'RESTful API and Microservices powering Anish Jethva’s interactive Windows 11 Portfolio Web OS. Includes Argon2id administrator authentication with MongoDB-backed HttpOnly sessions, Virtual File System, Contact & Email pipeline, Task planner, and Real-time Analytics.',
    contact: {
      name: 'Anish Jethva',
      email: 'anish.jethva2006@gmail.com',
      url: 'https://github.com/anishjethva18',
    },
  },
  servers: [{ url: '/api', description: 'Production API Gateway' }],
  paths: {
    '/health': {
      get: {
        summary: 'System health check',
        description: 'Returns health status, server uptime, and timestamp.',
        responses: { 200: { description: 'Service is healthy and responding' } },
      },
    },
    // --- Auth Endpoints ---
    '/auth/login': {
      post: {
        summary: 'Administrator login',
        description: 'Verifies the administrator password with Argon2id and issues a MongoDB-backed HttpOnly session cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated successfully' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/unlock': {
      post: {
        summary: 'Lock screen credentials verification',
        description: 'Re-verifies the password for the administrator session already authenticated by an HttpOnly cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  password: { type: 'string' },
                },
                required: ['password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Desktop unlocked successfully' },
          401: { description: 'Incorrect password or PIN' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke current administrator session and logout',
        description: 'Requires a valid session cookie and CSRF token, revokes the session in MongoDB, and clears cookies.',
        responses: { 200: { description: 'Logged out and session revoked' } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get authenticated user profile',
        security: [{ sessionCookieAuth: [] }],
        responses: {
          200: { description: 'User profile details' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/profile': {
      put: {
        summary: 'Update authenticated user profile settings',
        security: [{ sessionCookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  bio: { type: 'string' },
                  avatar: { type: 'string' },
                  settings: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        summary: 'Email an administrator password reset link',
        description: 'Sends a single-use 256-bit reset link valid for 15 minutes. Reset secrets are never returned by the API.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string' } },
                required: ['email'],
              },
            },
          },
        },
        responses: { 200: { description: 'Generic response to prevent account enumeration' } },
      },
    },
    '/auth/reset-password': {
      post: {
        summary: 'Set a new password from an emailed reset link',
        description: 'Consumes the one-time link secret, updates password hash, and revokes previous sessions.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  newPassword: { type: 'string' },
                },
                required: ['token', 'newPassword'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset successfully' },
          400: { description: 'Invalid, used, or expired token' },
        },
      },
    },
    '/auth/users': {
      get: {
        summary: 'List registered users (Admin Only)',
        security: [{ sessionCookieAuth: [] }],
        responses: {
          200: { description: 'List of users' },
          403: { description: 'Forbidden: Admin access required' },
        },
      },
    },
    // --- Tasks Endpoints ---
    '/tasks': {
      get: {
        summary: 'List user tasks with filtering and pagination',
        security: [{ sessionCookieAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'in_progress', 'completed'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] } },
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['Work', 'Portfolio', 'Personal', 'Bug', 'Feature'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'Paginated array of tasks' } },
      },
      post: {
        summary: 'Create a new task item',
        security: [{ sessionCookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Setup CI/CD pipeline' },
                  description: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
                  category: { type: 'string', enum: ['Work', 'Portfolio', 'Personal', 'Bug', 'Feature'], default: 'Portfolio' },
                  dueDate: { type: 'string', example: '2026-09-01' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['title'],
              },
            },
          },
        },
        responses: { 201: { description: 'Task created' } },
      },
    },
    '/tasks/{id}': {
      get: {
        summary: 'Get single task detail (Owner or Admin)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Task detail' },
          403: { description: 'Forbidden: You do not own this task' },
          404: { description: 'Task not found' },
        },
      },
      put: {
        summary: 'Update task item (Owner or Admin)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                  category: { type: 'string', enum: ['Work', 'Portfolio', 'Personal', 'Bug', 'Feature'] },
                  dueDate: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Task updated' },
          403: { description: 'Forbidden' },
          404: { description: 'Task not found' },
        },
      },
      delete: {
        summary: 'Delete task item (Owner or Admin)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Task removed' },
          403: { description: 'Forbidden' },
          404: { description: 'Task not found' },
        },
      },
    },
    // --- Files Endpoints ---
    '/files/upload': {
      post: {
        summary: 'Upload file (Multipart Form or JSON Base64)',
        security: [{ sessionCookieAuth: [] }],
        description: 'Uploads up to 50MB with path traversal protection, type validation, and user ownership.',
        responses: {
          201: { description: 'File uploaded and metadata stored' },
          400: { description: 'Blocked file extension or invalid payload' },
          413: { description: 'File exceeds 50MB limit' },
        },
      },
    },
    '/files/list': {
      get: {
        summary: 'List user files with filtering and pagination',
        security: [{ sessionCookieAuth: [] }],
        parameters: [
          { name: 'parentId', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['file', 'folder'] } },
          { name: 'extension', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        ],
        responses: { 200: { description: 'Paginated file records' } },
      },
    },
    '/files/download/{id}': {
      get: {
        summary: 'Download file binary (Owner or Admin)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Binary stream or text content' },
          403: { description: 'Forbidden: Access denied' },
          404: { description: 'File not found' },
        },
      },
    },
    '/files/{id}': {
      get: {
        summary: 'Get single file metadata (Owner or Admin)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'File metadata' } },
      },
      put: {
        summary: 'Update file metadata or text content (Owner or Admin)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'File updated' } },
      },
      delete: {
        summary: 'Delete file and unlink physical disk copy (Owner or Admin)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'File deleted' } },
      },
    },
    // --- Contact Endpoints ---
    '/contact': {
      post: {
        summary: 'Submit inquiry message and trigger delivery pipeline',
        description: 'Rate-limited contact endpoint with persistence and delivery tracking.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Alex Explorer' },
                  email: { type: 'string', example: 'alex@example.com' },
                  subject: { type: 'string', example: 'Portfolio Inquiry' },
                  message: { type: 'string', example: 'Hello Anish!' },
                },
                required: ['name', 'email', 'subject', 'message'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Inquiry processed and saved' },
          400: { description: 'Validation error' },
          429: { description: 'Rate limit exceeded' },
        },
      },
    },
    '/contact/health': {
      get: {
        summary: 'Check contact email transport status and diagnostics',
        responses: { 200: { description: 'Mail provider status' } },
      },
    },
    '/contact/history': {
      get: {
        summary: 'List submitted inquiries with search and status filtering (Admin Only)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['delivered', 'failed', 'queued', 'simulated', 'replied'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'Paginated inquiry messages' } },
      },
    },
    '/contact/{id}/status': {
      patch: {
        summary: 'Update inquiry status, notes, or replied flag (Admin Only)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Status updated' } },
      },
    },
    '/contact/{id}': {
      delete: {
        summary: 'Delete contact inquiry (Admin Only)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Inquiry removed' } },
      },
    },
    // --- Analytics Endpoints ---
    '/analytics/dashboard': {
      get: {
        summary: 'Retrieve real-time metrics and system health (Admin Only)',
        security: [{ sessionCookieAuth: [] }],
        responses: { 200: { description: 'Metrics summary and system telemetry' } },
      },
    },
    '/analytics/track': {
      post: {
        summary: 'Track client interaction event with strict secret masking',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventName: { type: 'string', example: 'APP_OPEN' },
                  page: { type: 'string', example: '/apps/terminal' },
                  category: { type: 'string', enum: ['navigation', 'interaction', 'auth', 'api', 'system'] },
                  metadata: { type: 'object' },
                },
                required: ['eventName'],
              },
            },
          },
        },
        responses: { 201: { description: 'Event tracked' } },
      },
    },
    '/analytics/logs': {
      get: {
        summary: 'Paginated telemetry logs (Admin Only)',
        security: [{ sessionCookieAuth: [] }],
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'Paginated logs' } },
      },
    },
    // --- Profile & Search ---
    '/profile': {
      get: {
        summary: 'Get public owner profile details',
        responses: { 200: { description: 'Profile information' } },
      },
    },
    '/profile/github': {
      get: {
        summary: 'Fetch live GitHub profile statistics',
        parameters: [{ name: 'username', in: 'query', schema: { type: 'string', default: 'anishjethva18' } }],
        responses: { 200: { description: 'GitHub stats' } },
      },
    },
    '/browse/gemini-search': {
      get: {
        summary: 'Execute web search grounded by Gemini with fallback',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Search results' } },
      },
    },
    '/browse/proxy': {
      get: {
        summary: 'Fetch and sanitize external web content with SSRF protection',
        parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Sanitized HTML document' } },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: '__Host-sid',
        description: 'Opaque server-side session cookie. Use sid over localhost HTTP during development.',
      },
    },
  },
};

/**
 * GET /api/docs/spec.json
 */
docsRouter.get('/spec.json', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

/**
 * GET /api/docs (Interactive Swagger / Developer UI)
 */
docsRouter.get('/', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Windows 11 Portfolio API Explorer</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .topbar { background: #1e293b; padding: 14px 24px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .topbar h1 { margin: 0; font-size: 18px; color: #38bdf8; font-weight: 700; }
    .badge { background: #0284c7; color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Anish Jethva Portfolio — OpenAPI 3.0 API Gateway</h1>
    <span class="badge">v2.1.0 Production</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/spec.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true
      });
    };
  </script>
</body>
</html>
  `;
  res.send(html);
});
