import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { cleanupExpiredTokens } from './db/cleanup.js';


const app = createApp();

cleanupExpiredTokens().catch((err) => {
  logger.warn({ err }, 'Failed to cleanup expired tokens');
});


app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
