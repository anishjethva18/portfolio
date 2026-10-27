import { Router, Request, Response } from 'express';
import { ProjectModel } from '../models';
import { db } from '../db/database';

export const portfolioRouter = Router();

// GET /api/portfolio/projects
portfolioRouter.get('/projects', async (req: Request, res: Response) => {
    try {
        // Fetch from MongoDB if available, otherwise fallback to in-memory db
        let projects = [];
        try {
            projects = await ProjectModel.find({ visible: { $ne: false } }).sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean();
        } catch (err) {
            projects = Array.from(db.projects.values()).filter((project) => project.visible !== false);
        }
        
        res.json({ success: true, projects });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});
