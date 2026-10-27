import { Router, Request, Response } from 'express';
import { githubService } from '../services/githubService';
import { getLivePortfolioContent } from './admin';
import { ProjectModel } from '../models';
import { getPublicSkillCategories, SIMPLE_ICON_BY_SLUG, SIMPLE_ICON_CATALOG } from '../services/skillCatalog';

export const profileRouter = Router();

export const getVisibleRecords = (records: unknown) =>
  Array.isArray(records) ? records.filter((record: any) => record?.visible !== false) : [];

export const getPublicProfile = (profile: any) => {
  const visibility = profile?.contactVisibility || {};
  const github = visibility.github === false ? '' : profile.github ?? 'https://github.com/anishjethva18';
  const instagram = visibility.instagram === false ? '' : profile.instagram ?? 'https://www.instagram.com/anish_jethva18';
  const linkedin = visibility.linkedin === false ? '' : profile.linkedin ?? 'https://www.linkedin.com/in/anishjethva/';
  const twitter = visibility.twitter === false ? '' : profile.twitter ?? 'https://x.com/anish_jethva';

  return {
    ...profile,
    location: visibility.location === false ? '' : profile.location ?? 'India',
    email: visibility.email === false ? '' : profile.email ?? 'anish.jethva2006@gmail.com',
    phone: visibility.phone === false ? '' : profile.phone || '',
    github,
    instagram,
    linkedin,
    twitter,
    socialLinks: Array.isArray(profile.socialLinks)
      ? profile.socialLinks.filter((link: any) => link?.visible !== false)
      : [],
    socials: { github, instagram, linkedin, twitter },
  };
};

profileRouter.get('/skill-icons', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    icons: SIMPLE_ICON_CATALOG.map(({ slug, title }) => ({ slug, title })),
  });
});

profileRouter.get('/skill-icons/:slug.svg', (req: Request, res: Response) => {
  const icon = SIMPLE_ICON_BY_SLUG.get(req.params.slug);
  if (!icon) {
    res.status(404).json({ success: false, error: 'Skill icon was not found.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('image/svg+xml').send(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#${icon.hex}" d="${icon.path}"/></svg>`
  );
});

// GET /api/profile
profileRouter.get('/', async (req: Request, res: Response) => {
  try {
    const content = await getLivePortfolioContent();
    const p = getPublicProfile(content.profile || {});
    res.json({
      name: p.name ?? 'Anish Jethva',
      title: p.title ?? 'Full Stack & AI Engineer',
      tagline: p.tagline ?? 'Building intelligent software, agentic systems, and joyful web operating systems.',
      location: p.location,
      email: p.email,
      phone: p.phone,
      avatar: p.avatar ?? '/avatar.png',
      website: p.website ?? 'https://anishjethva.dev',
      hiringStatus: p.hiringStatus ?? 'available',
      contactVisibility: p.contactVisibility || {},
      resumeUrl: p.resumeUrl ?? '/downloads/resume.pdf',
      socials: p.socials,
      socialLinks: p.socialLinks,
      bio: p.bio ?? '',
      goals: p.goals ?? [],
      stats: p.stats || {},
      skills: getPublicSkillCategories(content.skills),
      resumes: Array.isArray(content.resumes) ? content.resumes : [],
      experiences: getVisibleRecords(content.experiences),
      education: getVisibleRecords(content.education),
      certifications: getVisibleRecords(content.certifications),
      capabilities: getVisibleRecords(content.capabilities),
      siteSettings: content.siteSettings || {},
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/profile/content - full payload for dynamic website components
profileRouter.get('/content', async (req: Request, res: Response) => {
  try {
    const content = await getLivePortfolioContent();
    res.json({
      success: true,
      content: {
        ...content,
        profile: getPublicProfile(content.profile || {}),
        skills: getPublicSkillCategories(content.skills),
        experiences: getVisibleRecords(content.experiences),
        education: getVisibleRecords(content.education),
        certifications: getVisibleRecords(content.certifications),
        capabilities: getVisibleRecords(content.capabilities),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/profile/projects - public list of all portfolio projects
profileRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const projects = await ProjectModel.find({ visible: { $ne: false } }).sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean();
    res.json({ success: true, projects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/profile/github
profileRouter.get('/github', async (req: Request, res: Response) => {
  const username = (req.query.username as string) || 'anishjethva18';
  try {
    const stats = await githubService.getProfileStats(username);
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
