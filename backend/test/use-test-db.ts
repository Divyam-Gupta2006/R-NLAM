import { testDatabaseUrl } from './test-db';

// Runs in every test worker before the suite loads (after dotenv/config).
process.env.DATABASE_URL = testDatabaseUrl();
process.env.AUTH_MODE = 'dev';
process.env.DEV_JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-0123456789';
process.env.OUTBOX_DISPATCHER = 'off';
process.env.STORAGE_DIR = require('path').join(__dirname, '.storage');
process.env.STATUTORY_SCHEDULER = 'off';
