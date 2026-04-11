import { loadConfig } from './config.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const { app, close } = await createApp(config);

  const shutdown = async (): Promise<void> => {
    try {
      await close();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`LevelUp api on :${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
