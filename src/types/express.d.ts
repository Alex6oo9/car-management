import { User } from './models.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      full_name: string;
      role: 'admin' | 'employee';
      is_active: boolean;
    }
  }
}

export {};
