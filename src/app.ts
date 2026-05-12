import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { sessionMiddleware } from './auth/session.js';
import passport from './auth/passport.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import adminUsersRoutes from './routes/admin.users.routes.js';
import adminCustomersRoutes from './routes/admin.customers.routes.js';
import adminCarsRoutes from './routes/admin.cars.routes.js';
import adminRentalsRoutes from './routes/admin.rentals.routes.js';
import adminPurchasesRoutes from './routes/admin.purchases.routes.js';
import adminRentalTermsRoutes from './routes/admin.rental-terms.routes.js';
import adminCarDocumentsRoutes from './routes/admin.car-documents.routes.js';
import publicCarsRoutes from './routes/public.cars.routes.js';
import publicRentalTermsRoutes from './routes/public.rental-terms.routes.js';
import publicDealerContactRoutes from './routes/public.dealer-contact.routes.js';
import adminDealerContactRoutes from './routes/admin.dealer-contact.routes.js';
import profileRoutes from './routes/profile.routes.js';

export function createApp() {
  const app = express();

  // Security
  app.use(helmet());
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }));

  // Logging
  app.use(pinoHttp({ logger }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Sessions & Passport
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // Public routes
  app.use('/cars', publicCarsRoutes);
  app.use('/rental-terms', publicRentalTermsRoutes);
  app.use('/dealer-contact', publicDealerContactRoutes);

  // Auth routes
  app.use('/auth', authRoutes);

  // Authenticated profile (any logged-in user)
  app.use('/profile', profileRoutes);

  // Admin routes
  app.use('/admin/users', adminUsersRoutes);
  app.use('/admin/customers', adminCustomersRoutes);
  app.use('/admin/cars', adminCarsRoutes);
  app.use('/admin/cars', adminCarDocumentsRoutes);
  app.use('/admin/rentals', adminRentalsRoutes);
  app.use('/admin/purchases', adminPurchasesRoutes);
  app.use('/admin/rental-terms', adminRentalTermsRoutes);
  app.use('/admin/dealer-contact', adminDealerContactRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
