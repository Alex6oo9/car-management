import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { usersRepo } from '../db/repositories/users.repo.js';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { env } from '../config/env.js';

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
        if (!user.password_hash) {
          return done(null, false, { message: 'Invalid credentials' });
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
          auth_provider: user.auth_provider,
          google_id: user.google_id,
        });
      } catch (err) {
        return done(err);
      }
    }
  )
);

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!email) {
            return done(null, false, { message: 'Google account email is required' });
          }

          // 1) Find by google_id first
          const byGoogleId = await usersRepo.findByGoogleId(googleId);
          if (byGoogleId) {
            if (!byGoogleId.is_active) {
              return done(null, false, { message: 'Account is deactivated' });
            }
            return done(null, toSessionUser(byGoogleId));
          }

          // 2) Try linking existing account by email
          const byEmail = await usersRepo.findByEmail(email);
          if (byEmail) {
            if (!byEmail.is_active) {
              return done(null, false, { message: 'Account is deactivated' });
            }

            const linked =
              byEmail.google_id ? byEmail : await usersRepo.linkGoogleAccount(byEmail.id, googleId);

            if (!linked) {
              return done(null, false, { message: 'Failed to link Google account' });
            }

            return done(null, toSessionUser(linked));
          }

          // 3) Create new google user
          const fullName =
            profile.displayName?.trim() ||
            email.split('@')[0] ||
            'Google User';

          const created = await usersRepo.createGoogleUser({
            email,
            full_name: fullName,
            google_id: googleId,
          });

          return done(null, toSessionUser(created));
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}
function toSessionUser(user: {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'employee' | 'client';
  is_active: boolean;
  is_email_verified: boolean;
  auth_provider: 'local' | 'google';
  google_id: string | null;
}): Express.User {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    is_email_verified: user.is_email_verified,
    auth_provider: user.auth_provider,
    google_id: user.google_id,
  };
}

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
      auth_provider: user.auth_provider,
      google_id: user.google_id,
    });
  } catch (err) {
    done(err);
  }
});

export default passport;
