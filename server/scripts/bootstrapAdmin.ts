import 'dotenv/config';
import { authService } from '../services/authService';
import { db } from '../db/database';
import { connectMongo, disconnectMongo } from '../config/dbConfig';

async function runBootstrap() {
  console.log('=== Windows 11 Portfolio: Administrator Bootstrap Tool ===');
  let exitCode = 0;
  try {
    await connectMongo();
    await db.initMongoSync();

    const args = process.argv.slice(2);
    const positionalEmail = args.find((arg) => !arg.startsWith('--'));
    let email = positionalEmail || process.env.PORTFOLIO_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    let password = process.env.PORTFOLIO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    let name = process.env.PORTFOLIO_ADMIN_NAME || process.env.ADMIN_NAME || 'Anish Jethva';

    args.forEach((arg) => {
      if (arg.startsWith('--email=')) email = arg.split('=')[1];
      if (arg.startsWith('--name=')) name = arg.split('=')[1];
    });

    if (!email) throw new Error('Email is required. Set PORTFOLIO_ADMIN_EMAIL / ADMIN_EMAIL or pass it as the first argument.');
    if (!password) throw new Error('Set PORTFOLIO_ADMIN_PASSWORD (or ADMIN_PASSWORD) in the process environment before bootstrapping.');
    const minPasswordLength = process.env.NODE_ENV === 'production' ? 12 : 8;
    if (password.length < minPasswordLength) throw new Error(`Administrator password must be at least ${minPasswordLength} characters.`);

    const admin = await authService.bootstrapAdmin(email, password, name, process.env.ADMIN_SETUP_TOKEN);
    console.log('✔ Administrator successfully initialized:');
    console.log(`  - User ID: ${admin.id}`);
    console.log(`  - Email:   ${admin.email}`);
    console.log(`  - Name:    ${admin.name}`);
    console.log(`  - Role:    ${admin.role}`);
    console.log('Password has been securely hashed with Argon2id and persisted.');
  } catch (err: any) {
    console.error('✘ Bootstrap failed:', err.message);
    exitCode = 1;
  } finally {
    await disconnectMongo();
  }

  process.exitCode = exitCode;
}

runBootstrap();
