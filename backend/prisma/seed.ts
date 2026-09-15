import { seedDemoDataset } from './seed-demo';

seedDemoDataset()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  });
