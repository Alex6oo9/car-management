import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { usersRepo } from '../db/repositories/users.repo.js';

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await usersRepo.findByEmail(email);
        if (!user) {
          return done(null, false, { message: 'Invalid credentials' });
        }
        if (!user.is_active) {
          return done(null, false, { message: 'Account is deactivated' });
        }
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return done(null, false, { message: 'Invalid credentials' });
        }
        return done(null, {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          is_active: user.is_active,
          is_email_verified: user.is_email_verified,
        });
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await usersRepo.findById(id);
    if (!user || !user.is_active) {
      return done(null, false);
    }
    done(null, {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      is_email_verified: user.is_email_verified,
    });
  } catch (err) {
    done(err);
  }
});

export default passport;
