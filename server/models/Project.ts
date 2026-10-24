import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  id: string;
  title: string;
  tagline?: string;
  description: string;
  features: string[];
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

const ProjectSchema = new Schema<IProject>(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    tagline: { type: String, default: '' },
    description: { type: String, required: true },
    features: [{ type: String }],
    technologies: [{ type: String }],
    category: { type: String, required: true, index: true },
    image: { type: String, default: '' },
    githubUrl: { type: String },
    liveUrl: { type: String },
    stars: { type: Number, default: 0 },
    featured: { type: Boolean, default: false, index: true },
    visible: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 100000 },
    slug: { type: String, trim: true, maxlength: 160 },
    type: { type: String, trim: true, maxlength: 120 },
    stack: { type: String, trim: true, maxlength: 500 },
    screenshots: [{ type: String, maxlength: 2048 }],
    overview: { type: String, maxlength: 10000 },
    summary: { type: String, maxlength: 10000 },
    caseStudy: {
      goal: { type: String, maxlength: 10000 },
      approach: { type: String, maxlength: 10000 },
      architecture: [{ type: String, maxlength: 1000 }],
      engineeringHighlights: [{ type: String, maxlength: 1000 }],
      delivered: { type: String, maxlength: 10000 },
    },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

ProjectSchema.index({ category: 1, featured: -1 });

export const ProjectModel: mongoose.Model<IProject> =
  (mongoose.models.Project as mongoose.Model<IProject>) || mongoose.model<IProject>('Project', ProjectSchema);
