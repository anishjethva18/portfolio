import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { ProjectData } from '../db/database';
import { ProjectMarkdownStorageService } from '../services/projectMarkdownStorageService';

function createProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: 'project_probe_1',
    title: 'Storage probe',
    description: 'A private generated Markdown fixture.',
    technologies: ['TypeScript'],
    category: 'Web',
    image: '',
    stars: 0,
    featured: false,
    createdAt: '2026-10-21T00:00:00.000Z',
    ...overrides,
  };
}

test('project draft Markdown is generated, updated, and stale owned files are removed', (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-project-markdown-'));
  const service = new ProjectMarkdownStorageService(storageRoot);
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(storageRoot, 'project'), { recursive: true });
  const projectPath = path.join(storageRoot, 'project', 'project-project_probe_1.md');
  const userFilePath = path.join(storageRoot, 'project', 'notes.md');
  fs.writeFileSync(userFilePath, 'Keep this unrelated file.');

  service.syncProjects([createProject()]);
  assert.match(fs.readFileSync(projectPath, 'utf8'), /# Storage probe/);
  service.syncProjects([createProject({ title: 'Updated storage probe', summary: 'Updated summary.' })]);
  assert.match(fs.readFileSync(projectPath, 'utf8'), /# Updated storage probe/);
  assert.match(fs.readFileSync(projectPath, 'utf8'), /Updated summary\./);
  assert.equal(fs.readFileSync(userFilePath, 'utf8'), 'Keep this unrelated file.');

  service.syncProjects([]);
  assert.equal(fs.existsSync(projectPath), false);
  assert.equal(fs.existsSync(userFilePath), true);
});

test('project Markdown refuses to overwrite a file it does not own', (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-project-markdown-conflict-'));
  const service = new ProjectMarkdownStorageService(storageRoot);
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(storageRoot, 'project'), { recursive: true });
  const projectPath = path.join(storageRoot, 'project', 'project-project_probe_1.md');
  fs.writeFileSync(projectPath, 'User-owned content.');

  assert.throws(() => service.syncProjects([createProject()]), /Refusing to overwrite or remove an unowned Project file/);
  assert.equal(fs.readFileSync(projectPath, 'utf8'), 'User-owned content.');
});
