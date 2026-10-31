import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteContent extends Document {
  key: string;
  profile: {
    name: string;
    title: string;
    tagline: string;
    bio: string;
    avatar: string;
    email: string;
    phone?: string;
    location: string;
    github: string;
    linkedin: string;
    instagram: string;
    twitter?: string;
    website: string;
    socialLinks?: Array<{ label: string; url: string; visible?: boolean }>;
    contactVisibility?: {
      email?: boolean;
      phone?: boolean;
      location?: boolean;
      github?: boolean;
      linkedin?: boolean;
      instagram?: boolean;
      twitter?: boolean;
    };
    hiringStatus?: 'hidden' | 'available' | 'open' | 'unavailable';
    resumeUrl?: string;
    goals: string[];
    stats: {
      publicRepos: number;
      totalStars: number;
      followers: number;
      yearsExperience: number;
      completedProjects: number;
    };
  };
  resumes?: Array<{
    id: string;
    title: string;
    file: string;
    active: boolean;
  }>;
  skills: Array<{
    id: string;
    title: string;
    normalizedName: string;
    icon: string;
    iconImage?: string;
    order: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    skills: Array<{
      id: string;
      name: string;
      normalizedName: string;
      categoryId: string;
      iconIdentifier: string;
      order: number;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  experiences: Array<{
    role: string;
    company: string;
    period: string;
    location: string;
    description: string[];
    skills: string[];
    visible?: boolean;
  }>;
  education: Array<{
    title?: string;
    degree: string;
    institution: string;
    period: string;
    details: string;
    description?: string;
    achievements?: string[];
    visible?: boolean;
  }>;
  certifications?: Array<{
    title: string;
    provider: string;
    description: string;
    image: string;
    artLabel: string;
    artDetail: string;
    link: string;
    visible: boolean;
  }>;
  capabilities?: Array<{ title: string; icon: string; description: string; visible?: boolean }>;
  siteSettings: {
    siteName?: string;
    siteTitle: string;
    metaDescription: string;
    openGraphTitle?: string;
    openGraphDescription?: string;
    canonicalUrl?: string;
    twitterCard?: 'summary' | 'summary_large_image';
    twitterTitle?: string;
    twitterDescription?: string;
    portfolioVersion?: string;
    socialImageUrl?: string;
    faviconUrl?: string;
    emailBrandImageUrl?: string;
    emailFaviconEnabled?: boolean;
    maintenanceMode: boolean;
    maintenanceMessage?: string;
    announcementBanner: {
      enabled: boolean;
      message: string;
      type: 'info' | 'warning' | 'success' | 'hiring';
      link?: string;
    };
    contactEmail: string;
    defaultTheme: 'dark' | 'light';
    defaultWallpaper: string;
    defaultWallpaperUrl?: string;
    defaultAccentColor: string;
    defaultIconTheme?: 'fluent_3d' | 'outline_tint';
    soundEnabled: boolean;
    animationsEnabled: boolean;
    assistantEnabled?: boolean;
    disabledApps?: string[];
    desktopShortcuts?: Array<{
      id: string;
      appId: string;
      name: string;
      icon: string;
      position: { gridX: number; gridY: number };
      type: 'app';
    }>;
    taskbarPinnedApps?: string[];
    startPinnedApps?: string[];
    adminAppEnabledInStart?: boolean;
    maxUploadSizeMb: number;
    archiveRetentionDays: number;
  };
  securitySettings: {
    reLoginPolicy: 'remember' | 'prompt_always' | 'timeout_15m' | 'timeout_1h';
    allowPublicRegistration: boolean;
    auditLoggingEnabled: boolean;
    adminPinHash?: string;
    ipWhitelist?: string[];
  };
  updatedAt: string;
}

const SiteContentSchema = new Schema<ISiteContent>(
  {
    key: { type: String, required: true, unique: true, default: 'primary_portfolio_content' },
    profile: {
      name: { type: String, default: 'Anish Jethva' },
      title: { type: String, default: 'Full Stack & AI Engineer' },
      tagline: { type: String, default: 'Building intelligent software, agentic systems, and joyful web operating systems.' },
      bio: { type: String, default: 'Passionate Full Stack & AI Engineer with expertise in architecting high-performance web applications, cloud systems, and generative AI interfaces.' },
      avatar: { type: String, default: '/avatar.png' },
      email: { type: String, default: 'anish.jethva2006@gmail.com' },
      phone: { type: String, default: '+91 98765 43210' },
      location: { type: String, default: 'India' },
      github: { type: String, default: 'https://github.com/anishjethva18' },
      linkedin: { type: String, default: 'https://linkedin.com/in/anishjethva/' },
      instagram: { type: String, default: 'https://instagram.com/anish_jethva18' },
      twitter: { type: String, default: 'https://twitter.com/anishjethva' },
      website: { type: String, default: 'https://anishjethva.dev' },
      socialLinks: [{ label: { type: String, trim: true }, url: { type: String, trim: true }, visible: { type: Boolean, default: true } }],
      contactVisibility: {
        email: { type: Boolean, default: true },
        phone: { type: Boolean, default: true },
        location: { type: Boolean, default: true },
        github: { type: Boolean, default: true },
        linkedin: { type: Boolean, default: true },
        instagram: { type: Boolean, default: true },
        twitter: { type: Boolean, default: true },
      },
      hiringStatus: { type: String, enum: ['hidden', 'available', 'open', 'unavailable'], default: 'available' },
      resumeUrl: { type: String, default: '/downloads/resume.pdf' },
      goals: [{ type: String }],
      stats: {
        publicRepos: { type: Number, default: 28 },
        totalStars: { type: Number, default: 540 },
        followers: { type: Number, default: 120 },
        yearsExperience: { type: Number, default: 4 },
        completedProjects: { type: Number, default: 18 },
      },
    },
    resumes: [{
      id: { type: String, required: true },
      title: { type: String, required: true, trim: true, maxlength: 120 },
      file: { type: String, required: true, maxlength: 2048 },
      active: { type: Boolean, default: true },
    }],
    skills: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true, trim: true, maxlength: 100 },
        normalizedName: { type: String, required: true, trim: true, maxlength: 100 },
        icon: { type: String, required: true },
        iconImage: { type: String, default: '' },
        order: { type: Number, required: true, min: 0 },
        active: { type: Boolean, default: true },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true },
        skills: [
          {
            id: { type: String, required: true },
            name: { type: String, required: true, trim: true, maxlength: 100 },
            normalizedName: { type: String, required: true, trim: true, maxlength: 100 },
            categoryId: { type: String, required: true },
            iconIdentifier: { type: String, required: true },
            order: { type: Number, required: true, min: 0 },
            active: { type: Boolean, default: true },
            createdAt: { type: String, required: true },
            updatedAt: { type: String, required: true },
          },
        ],
      },
    ],
    experiences: [
      {
        role: { type: String },
        company: { type: String },
        period: { type: String },
        location: { type: String },
        description: [{ type: String }],
        skills: [{ type: String }],
        visible: { type: Boolean, default: true },
      },
    ],
    education: [
      {
        title: { type: String },
        degree: { type: String },
        institution: { type: String },
        period: { type: String },
        details: { type: String },
        description: { type: String },
        achievements: [{ type: String }],
        visible: { type: Boolean, default: true },
      },
    ],
    certifications: [{
      title: { type: String, default: '' },
      provider: { type: String, default: '' },
      description: { type: String, default: '' },
      image: { type: String, default: '' },
      artLabel: { type: String, default: '' },
      artDetail: { type: String, default: '' },
      link: { type: String, default: '' },
      visible: { type: Boolean, default: true },
    }],
    capabilities: [{
      title: { type: String, default: '' },
      icon: { type: String, default: 'bi-stars' },
      description: { type: String, default: '' },
      visible: { type: Boolean, default: true },
    }],
    siteSettings: {
      siteName: { type: String, trim: true, maxlength: 160, default: '' },
      siteTitle: { type: String, default: 'Windows 11 OS Portfolio — Anish Jethva' },
      metaDescription: { type: String, default: 'Full-stack Windows 11 web operating system portfolio showcasing full-stack projects, AI agents, and interactive apps.' },
      openGraphTitle: { type: String, trim: true, maxlength: 120, default: '' },
      openGraphDescription: { type: String, trim: true, maxlength: 320, default: '' },
      canonicalUrl: { type: String, trim: true, maxlength: 2048, default: '' },
      twitterCard: { type: String, enum: ['summary', 'summary_large_image'], default: 'summary_large_image' },
      twitterTitle: { type: String, trim: true, maxlength: 120, default: '' },
      twitterDescription: { type: String, trim: true, maxlength: 320, default: '' },
      portfolioVersion: { type: String, default: '1.0.0', trim: true, maxlength: 32 },
      socialImageUrl: { type: String, default: '' },
      faviconUrl: { type: String, default: '' },
      emailBrandImageUrl: { type: String, default: '' },
      emailFaviconEnabled: { type: Boolean, default: true },
      maintenanceMode: { type: Boolean, default: false },
      maintenanceMessage: { type: String, default: 'System is currently undergoing scheduled maintenance. Please check back shortly.' },
      announcementBanner: {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: '🚀 Available for exciting new roles and AI/Full-Stack opportunities!' },
        type: { type: String, default: 'info' },
        link: { type: String, default: '' },
      },
      contactEmail: { type: String, default: 'anish.jethva2006@gmail.com' },
      defaultTheme: { type: String, default: 'dark' },
      defaultWallpaper: { type: String, default: 'Windows11.jpg' },
      defaultWallpaperUrl: { type: String, default: '' },
      defaultAccentColor: { type: String, default: '#0078d4' },
      defaultIconTheme: { type: String, enum: ['fluent_3d', 'outline_tint'], default: 'fluent_3d' },
      soundEnabled: { type: Boolean, default: true },
      animationsEnabled: { type: Boolean, default: true },
      assistantEnabled: { type: Boolean, default: true },
      disabledApps: [{ type: String }],
      desktopShortcuts: {
        type: [{
          id: { type: String, required: true },
          appId: { type: String, required: true },
          name: { type: String, required: true },
          icon: { type: String, required: true },
          position: {
            gridX: { type: Number, required: true },
            gridY: { type: Number, required: true },
          },
          type: { type: String, enum: ['app'], default: 'app' },
        }],
        default: undefined,
      },
      taskbarPinnedApps: { type: [String], default: undefined },
      startPinnedApps: { type: [String], default: undefined },
      adminAppEnabledInStart: { type: Boolean, default: undefined },
      maxUploadSizeMb: { type: Number, default: 100 },
      archiveRetentionDays: { type: Number, default: 30 },
    },
    securitySettings: {
      reLoginPolicy: { type: String, default: 'remember' },
      allowPublicRegistration: { type: Boolean, default: false },
      auditLoggingEnabled: { type: Boolean, default: true },
      adminPinHash: { type: String, default: '' },
      ipWhitelist: [{ type: String }],
    },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const SiteContentModel: mongoose.Model<ISiteContent> =
  (mongoose.models.SiteContent as mongoose.Model<ISiteContent>) ||
  mongoose.model<ISiteContent>('SiteContent', SiteContentSchema);
