import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminAuditLog extends Document {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: string;
  ipAddress: string;
  outcome: 'success' | 'failed';
  timestamp: string;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    id: { type: String, required: true, unique: true, index: true },
    adminId: { type: String, required: true, index: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, index: true },
    details: { type: String, required: true, maxlength: 2000 },
    ipAddress: { type: String, required: true },
    outcome: { type: String, enum: ['success', 'failed'], default: 'success', index: true },
    timestamp: { type: String, required: true, index: true },
  },
  { timestamps: false, versionKey: false }
);

AdminAuditLogSchema.index({ timestamp: -1, action: 1 });

export const AdminAuditLogModel: mongoose.Model<IAdminAuditLog> =
  (mongoose.models.AdminAuditLog as mongoose.Model<IAdminAuditLog>) ||
  mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
