import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'Work' | 'Portfolio' | 'Personal' | 'Bug' | 'Feature';
  dueDate?: string;
  tags: string[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const TaskSchema = new Schema<ITask>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    category: {
      type: String,
      enum: ['Work', 'Portfolio', 'Personal', 'Bug', 'Feature'],
      default: 'Portfolio',
      index: true,
    },
    dueDate: { type: String },
    tags: [{ type: String }],
    completedAt: { type: String },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes for sorting and filtering
TaskSchema.index({ userId: 1, status: 1, priority: 1 });
TaskSchema.index({ userId: 1, createdAt: -1 });

export const TaskModel: mongoose.Model<ITask> =
  (mongoose.models.Task as mongoose.Model<ITask>) || mongoose.model<ITask>('Task', TaskSchema);
