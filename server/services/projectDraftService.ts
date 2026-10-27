import { AdminProjectDraftModel, ProjectModel } from '../models';
import { db, ProjectData } from '../db/database';
import { projectMarkdownStorageService } from './projectMarkdownStorageService';

const PROJECTS_KEY = 'primary_portfolio_projects';

export class ProjectDraftService {
  public async getDraftProjects(): Promise<ProjectData[]> {
    const draft = await AdminProjectDraftModel.findOne({ key: PROJECTS_KEY }).lean();
    if (draft) {
      projectMarkdownStorageService.syncProjects(draft.projects);
      return draft.projects;
    }

    const published = await ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean();
    const projects = published.map(({ _id: _mongoId, ...project }) => project as ProjectData);
    await AdminProjectDraftModel.create({
      key: PROJECTS_KEY,
      projects,
      updatedBy: 'system-initialization',
    });
    projectMarkdownStorageService.syncProjects(projects);
    return projects;
  }

  public async saveDraftProjects(projects: ProjectData[], userId: string): Promise<void> {
    await AdminProjectDraftModel.findOneAndUpdate(
      { key: PROJECTS_KEY },
      { $set: { projects, updatedBy: userId } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
    projectMarkdownStorageService.syncProjects(projects);
  }

  public async publishDraftProjects(): Promise<void> {
    const draft = await AdminProjectDraftModel.findOne({ key: PROJECTS_KEY }).lean();
    if (!draft) return;

    const draftIds = draft.projects.map((project) => project.id);
    if (draftIds.some((id) => typeof id !== 'string' || !id.trim()) || new Set(draftIds).size !== draftIds.length) {
      throw new Error('Project draft contains missing or duplicate project IDs.');
    }

    const existingProjects = await ProjectModel.find().select('id').lean();
    if (draft.projects.length) {
      await ProjectModel.bulkWrite(draft.projects.map((project) => ({
        updateOne: {
          filter: { id: project.id },
          update: { $set: project },
          upsert: true,
        },
      })));
    }

    const removedIds = existingProjects
      .map((project) => project.id)
      .filter((id): id is string => typeof id === 'string' && !draftIds.includes(id));
    if (removedIds.length > 0) {
      await ProjectModel.deleteMany({ id: { $in: removedIds } });
    }

    const published = await ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean();
    db.projects.clear();
    published.forEach(({ _id: _mongoId, ...project }) => {
      db.projects.set(project.id, project);
    });
    projectMarkdownStorageService.syncProjects(published.map(({ _id: _mongoId, ...project }) => project as ProjectData));
  }

  public async discardDraftProjects(userId: string): Promise<void> {
    const published = await ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean();
    const projects = published.map(({ _id: _mongoId, ...project }) => project as ProjectData);
    await this.saveDraftProjects(projects, userId);
  }

  public async isDraftMediaReferenced(mediaUrl: string): Promise<boolean> {
    const draft = await AdminProjectDraftModel.findOne({ key: PROJECTS_KEY }).lean();
    return Boolean(draft?.projects.some((project) => project.image === mediaUrl || project.screenshots?.includes(mediaUrl)));
  }
}

export const projectDraftService = new ProjectDraftService();
