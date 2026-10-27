import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { AdminContentDraftModel } from '../models/AdminContentDraft';
import { AdminContentRevisionModel } from '../models/AdminContentRevision';
import { SiteContentModel } from '../models/SiteContent';
import { migrateLegacySkillCategories, validateSkillCategories } from '../services/skillCatalog';

const CONTENT_KEY = 'primary_portfolio_content';
type ModelName = 'SiteContent' | 'AdminContentDraft' | 'AdminContentRevision';
type BackupRecord = {
  model: ModelName;
  id: string;
  skills: unknown;
  content?: Record<string, unknown>;
};

function getSkills(record: Record<string, unknown>, model: ModelName): unknown {
  if (model === 'SiteContent') return record.skills;
  const content = record.content;
  return content && typeof content === 'object' && !Array.isArray(content)
    ? (content as Record<string, unknown>).skills
    : undefined;
}

function skillCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((total, category) => {
    const skills = category && typeof category === 'object'
      ? (category as Record<string, unknown>).skills
      : undefined;
    return total + (Array.isArray(skills) ? skills.length : 0);
  }, 0);
}

async function collectRecords(): Promise<BackupRecord[]> {
  const records: BackupRecord[] = [];
  const contentDocuments = await SiteContentModel.find({ key: CONTENT_KEY }).lean();
  const draftDocuments = await AdminContentDraftModel.find({ key: CONTENT_KEY }).lean();
  const revisionDocuments = await AdminContentRevisionModel.find({ key: CONTENT_KEY }).lean();
  const documents: Array<{ model: ModelName; record: Record<string, unknown> }> = [
    ...contentDocuments.map((document) => ({ model: 'SiteContent' as const, record: document as unknown as Record<string, unknown> })),
    ...draftDocuments.map((document) => ({ model: 'AdminContentDraft' as const, record: document as unknown as Record<string, unknown> })),
    ...revisionDocuments.map((document) => ({ model: 'AdminContentRevision' as const, record: document as unknown as Record<string, unknown> })),
  ];
  for (const { model, record } of documents) {
    const skills = getSkills(record, model);
    if (!Array.isArray(skills)) continue;
    records.push({
      model,
      id: String(record._id),
      skills,
      ...(model === 'SiteContent' ? {} : { content: record.content as Record<string, unknown> }),
    });
  }
  return records;
}

async function writeSkills(record: BackupRecord, skills: unknown): Promise<void> {
  const pathToSkills = record.model === 'SiteContent' ? 'skills' : 'content.skills';
  const filter = { _id: new mongoose.Types.ObjectId(record.id), key: CONTENT_KEY };
  const update = { $set: { [pathToSkills]: skills } };
  let result;
  if (record.model === 'SiteContent') result = await SiteContentModel.collection.updateOne(filter, update);
  else if (record.model === 'AdminContentDraft') result = await AdminContentDraftModel.collection.updateOne(filter, update);
  else result = await AdminContentRevisionModel.collection.updateOne(filter, update);
  if (result.matchedCount !== 1) {
    throw new Error(`Could not update ${record.model} record ${record.id}; no changes were made to this record.`);
  }
}

async function migrate(apply: boolean): Promise<void> {
  const records = await collectRecords();
  const beforeCount = records.reduce((total, record) => total + skillCount(record.skills), 0);
  const migrated = records.map((record) => ({ ...record, skills: migrateLegacySkillCategories(record.skills) }));
  const afterCount = migrated.reduce((total, record) => total + skillCount(record.skills), 0);
  const invalidRecords = migrated
    .map((record, index) => ({ index, error: validateSkillCategories(record.skills) }))
    .filter((record) => record.error);
  console.log(`Found ${records.length} content record(s) containing ${beforeCount} skill entr${beforeCount === 1 ? 'y' : 'ies'}.`);
  console.log(`Migration will produce ${afterCount} separate technology entr${afterCount === 1 ? 'y' : 'ies'}.`);
  if (invalidRecords.length > 0) {
    throw new Error(`Migration preflight failed validation for ${invalidRecords.length} content record(s); no data was changed.`);
  }

  if (!apply) {
    console.log('Dry run only. Use --apply to create a backup and migrate the records.');
    return;
  }
  if (process.env.NODE_ENV === 'production' && process.argv.includes('--confirm-production') === false) {
    throw new Error('Production database changes require the additional --confirm-production argument.');
  }

  const backupDirectory = path.resolve(process.cwd(), 'server', 'storage', 'Backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const createdAt = new Date().toISOString();
  const backupPath = path.join(backupDirectory, `skills-migration-${createdAt.replace(/[:.]/g, '-')}.json`);
  const temporaryPath = `${backupPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify({ createdAt, contentKey: CONTENT_KEY, records }, null, 2), { flag: 'wx' });
  fs.renameSync(temporaryPath, backupPath);

  let updated = 0;
  try {
    for (const record of migrated) {
      await writeSkills(record, record.skills);
      updated += 1;
    }
  } catch (error) {
    for (const record of records.slice(0, updated)) {
      await writeSkills(record, record.skills);
    }
    throw error;
  }
  console.log(`Migrated ${updated} record(s). Reversible skill backup: ${backupPath}`);
}

async function rollback(backupPath: string): Promise<void> {
  const backup = JSON.parse(fs.readFileSync(path.resolve(backupPath), 'utf8')) as { records?: BackupRecord[] };
  if (!Array.isArray(backup.records)) throw new Error('The selected file is not a valid Skills migration backup.');
  for (const record of backup.records) {
    if (!record || !['SiteContent', 'AdminContentDraft', 'AdminContentRevision'].includes(record.model) || typeof record.id !== 'string') {
      throw new Error('The selected backup contains an invalid record entry.');
    }
  }
  for (const record of backup.records) {
    await writeSkills(record, record.skills);
  }
  console.log(`Restored the original skill arrays for ${backup.records.length} record(s).`);
}

async function main(): Promise<void> {
  await connectMongo();
  const rollbackIndex = process.argv.indexOf('--rollback');
  if (rollbackIndex !== -1) {
    const backupPath = process.argv[rollbackIndex + 1];
    if (!backupPath) throw new Error('Pass the backup JSON file after --rollback.');
    await rollback(backupPath);
  } else {
    await migrate(process.argv.includes('--apply'));
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Skills migration failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
