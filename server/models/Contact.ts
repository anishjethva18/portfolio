import mongoose, { Schema, Document } from 'mongoose';

export interface IContact extends Document {
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

const ContactSchema = new Schema<IContact>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    timestamp: { type: String, default: () => new Date().toISOString(), index: true },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: '' },
    status: {
      type: String,
      enum: ['delivered', 'failed', 'queued', 'simulated', 'replied'],
      default: 'delivered',
      index: true,
    },
    emailSent: { type: Boolean, default: true },
    replied: { type: Boolean, default: false },
    repliedAt: { type: String },
    replyMessage: { type: String, default: '' },
    replyHistory: {
      type: [{ message: { type: String, required: true }, repliedAt: { type: String, required: true } }],
      default: [],
    },
    notes: { type: String, default: '' },
    error: { type: String },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

ContactSchema.index({ status: 1, timestamp: -1 });

export const ContactModel: mongoose.Model<IContact> =
  (mongoose.models.Contact as mongoose.Model<IContact>) || mongoose.model<IContact>('Contact', ContactSchema);
