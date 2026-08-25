import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/database.js';

async function main() {
  await migrate();
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`[upward-api] listening on http://${config.host}:${config.port}/v1`);
  });
}

main().catch((err) => {
  console.error('[upward-api] failed to start:', err);
  process.exit(1);
});
