import { migrate } from './database.js';

migrate()
  .then(() => {
    console.log('[db] schema up to date');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[db] migration failed:', err.message);
    process.exit(1);
  });
