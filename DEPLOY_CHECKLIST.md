# DigitalOcean App Platform — Pre-Deploy Fix List

Findings from a pre-deploy review on branch `fix/public-team-api` (2026-07-14). Build passes (`npm run build`) and all 29 Jest tests pass — these are the remaining items before deploying to DO App Platform.

---

## 🔴 Blockers — will break in production

### 1. No SSL config on the Postgres pool
**File**: `src/db/pool.ts`

```ts
export const pool = new Pool({ connectionString: env.DATABASE_URL });
```

DigitalOcean Managed Postgres requires SSL with a certificate Node's default TLS validation will reject. Without explicit SSL config, connections will fail, or throw `self-signed certificate in certificate chain`.

**Fix**:
```ts
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});
```

### 2. `trust proxy` not set
**File**: `src/app.ts`

App Platform sits behind a load balancer. Without `app.set('trust proxy', 1)`:
- `secure: env.NODE_ENV === 'production'` cookies (`src/auth/session.ts:21`) may misbehave since Express won't correctly see the connection as HTTPS — can break login/session persistence.
- `express-rate-limit` (login, register, feedback, etc.) will see every request as coming from the same IP (the proxy), risking mass lockout or a validation throw from the `X-Forwarded-For` header.

**Fix**: add right after `const app = express();`:
```ts
app.set('trust proxy', 1);
```

---

## 🟡 Required deploy steps (not code bugs)

- **Pin Node version** — no `engines` field in `package.json`. Add:
  ```json
  "engines": { "node": "20.x" }
  ```
  CLAUDE.md specifies Node 20+; DO will otherwise pick its own default.

- **Run migrations manually** — `npm run migrate` and `npm run seed` are not wired into any deploy hook. Run them via the App Platform console (or a one-off job) after first deploy.

- **Set all required env vars in the App Platform dashboard**:
  - `DATABASE_URL`
  - `SESSION_SECRET` (16+ chars)
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `NODE_ENV=production`
  - `CORS_ORIGIN` — set to the real frontend domain (defaults to `localhost:3000`)
  - `APP_URL` — set to the real backend URL (defaults to `localhost:3000`, used in OAuth redirects/emails)

- **Build/Run commands in App Platform UI**: Build Command `npm run build`, Run Command `npm start`.

---

## 🟠 App-level issue (not deploy-specific, but flagged)

**File**: `src/routes/public.feedback.routes.ts` (changed in commit `bd68df9`, "small fix for feedback")

The feedback `name` field is now taken from `req.body.name` instead of being server-derived from the logged-in session:
```ts
const name = req.body.name || 'Anonymous';
```
This reopens an impersonation vector on the public `POST /feedback` endpoint and contradicts the documented behavior in `CLAUDE.md` ("the request body cannot set the name — anti-impersonation"). Not a deploy blocker, but should be fixed before/soon after going live since it's public-facing.

**Fix**: revert to deriving `name` from `req.user?.full_name ?? 'Anonymous'`, and drop the `name` field from `createFeedbackSchema` in `src/validation/schemas.ts`.
