require('./loadEnv.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const testStorageRoot = path.join(os.tmpdir(), `windows-portfolio-test-${process.pid}-${Date.now()}`);

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
process.env.PORTFOLIO_STORAGE_DIR = testStorageRoot;
process.env.PORTFOLIO_BACKUP_DIR = path.join(testStorageRoot, 'backup');
process.env.USER_CAPTURE_ROOT = path.join(testStorageRoot, 'AdminArchive', 'CaptureImage');
process.env.ADMIN_ARCHIVE_ROOT = path.join(testStorageRoot, 'AdminArchive');
process.env.CAPTURE_ARCHIVE_ROOT = path.join(testStorageRoot, 'AdminArchive');

process.on('exit', () => {
  fs.rmSync(testStorageRoot, { recursive: true, force: true });
});
