import { User } from './models.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      full_name: string;
      role: 'admin' | 'employee' | 'client';
      is_active: boolean;
      is_email_verified: boolean;
      auth_provider: 'local' | 'google';
      google_id?: string | null;
    }
  }
}
export {};
