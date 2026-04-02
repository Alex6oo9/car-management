# Car Showroom Management System

Backend REST API for managing a car showroom with rental and purchase workflows, session-based authentication, and role-based access control.

## Features

- Role-based access control (`admin`, `employee`, `client`)
- Session-based authentication with Passport + PostgreSQL session store
- Email verification flow for new client registration
- Password reset flow with one-time tokens and session revocation
- User management (create/list/update/soft delete/hard delete/promotion)
- Car inventory management with publish/unpublish and image support
- Rental workflow with date overlap protection and status transitions
- Purchase workflow with atomic `paid -> sold` side effect
- Public car listing endpoints

## Tech Stack

- Node.js 20+
- TypeScript (strict mode, ESM)
- Express.js v5
- PostgreSQL 14+
- `pg` (raw SQL, parameterized)
- Passport.js + `express-session` + `connect-pg-simple`
- Zod validation
- Pino + pino-http logging
- Helmet, CORS, express-rate-limit

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/car_showroom
SESSION_SECRET=your-secret-at-least-16-chars
CORS_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=development

APP_URL=http://localhost:3000
FROM_EMAIL=CarShow <onboarding@resend.dev>
# Optional: if omitted, emails are logged to console in dev mode
# IMPORTANT: if present, must be non-empty (empty string fails validation)
RESEND_API_KEY=your_resend_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
```

### 3) Run migrations

```bash
npm run migrate
```

### 4) Seed admin user

```bash
npm run seed
```

Default admin:
- email: `admin@example.com`
- password: `admin123`

### 5) Start server

```bash
npm run dev
```

API base URL:
- `http://localhost:5000`

## Authentication Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a new `client` and send verification token |
| GET | `/auth/verify-email` | Public | Verify email via `?token=...` |
| POST | `/auth/resend-verification` | Public | Re-send verification link |
| POST | `/auth/forgot-password` | Public | Request password reset link |
| POST | `/auth/reset-password` | Public | Reset password with token |
| GET | `/auth/google` | Public | Start Google OAuth (browser redirect) |
| GET | `/auth/google/callback` | Public | Google OAuth callback (redirects to `APP_URL`) |
| POST | `/auth/login` | Public | Login (blocked with `403` if email not verified) |
| POST | `/auth/logout` | Required | Logout current session |
| GET | `/auth/me` | Required | Get current authenticated user |

### Auth/Security Notes

- Register creates users with role `client`
- Login returns `403` for unverified users
- Google OAuth flow starts in a browser (`GET /auth/google`) and redirects back to `APP_URL`
- Password reset tokens are one-time (`used = true` after success)
- Expired tokens are deleted during reset/verify operations
- After successful password reset, all existing sessions for that user are revoked
- Startup cleanup removes expired verification/reset tokens (`src/db/cleanup.ts` called from `src/server.ts`)

## User Management (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/users` | Create employee |
| GET | `/admin/users` | List users |
| GET | `/admin/users/:id` | Get user by ID |
| PATCH | `/admin/users/:id` | Update `full_name` / `is_active` |
| PATCH | `/admin/users/:id/role` | Promote `client` -> `employee` |
| DELETE | `/admin/users/:id` | Soft delete (sets `is_active = false`) |
| DELETE | `/admin/users/:id/hard` | Hard delete user + sessions (requires body confirm) |

Hard delete request body:

```json
{ "confirm": "DELETE" }
```

Hard delete protections:
- cannot hard delete admin account
- cannot hard delete your own account

## Other API Areas

### Public Cars

- `GET /cars`
- `GET /cars/:id`

### Customers (Admin + Employee)

- `POST /admin/customers`
- `GET /admin/customers`
- `GET /admin/customers/:id`
- `PATCH /admin/customers/:id`

### Cars (Admin + Employee)

- `POST /admin/cars`
- `GET /admin/cars`
- `GET /admin/cars/:id`
- `PATCH /admin/cars/:id`
- `DELETE /admin/cars/:id`
- `PATCH /admin/cars/:id/publish`
- `POST /admin/cars/:id/images`

### Rentals (Admin + Employee)

- `POST /admin/rentals`
- `GET /admin/rentals`
- `GET /admin/rentals/:id`
- `PATCH /admin/rentals/:id/status`

### Purchases (Admin + Employee)

- `POST /admin/purchases`
- `GET /admin/purchases`
- `GET /admin/purchases/:id`
- `PATCH /admin/purchases/:id/status`

## Rate Limits

Configured in `src/middleware/rateLimit.ts` for:

- login
- register
- forgot-password
- resend-verification

Tune these for production traffic and abuse patterns.

## Database Migrations

Current migration range includes:

- `001` to `011`
- includes:
  - email verification support
  - `client` role support
  - password reset token storage

## Postman Collection Notes

Collection file:
- `CarShowroom.postman_collection.json`

Important:

- Keep exported collection synced after request updates
- Use valid placeholders (`{{employee_id}}`, `{{car_id}}`, etc.)
- For admin delete-protection test, use `http://localhost:5000/admin/users/{{admin_id}}`
- If Postman shows "Unresolved Variable", define it in collection/environment variables first

## Production Checklist

- Set real `RESEND_API_KEY` and verified sender domain/email
- Tighten CORS origin(s) to trusted frontend domain(s)
- Ensure secure session cookie settings (`secure`, `sameSite`, `maxAge`) are correct for deployment architecture
- Review rate limits for realistic production thresholds
- Enforce HTTPS end-to-end

---

## Project Structure

```
src/
├── server.ts              # Entry point
├── app.ts                 # Express app factory
├── config/env.ts          # Zod-validated environment
├── db/
│   ├── pool.ts            # PostgreSQL connection pool
│   ├── migrate.ts         # Migration runner
│   ├── migrations/        # SQL migration files (001–011)
│   ├── seeds/             # Admin seed script
│   └── repositories/      # Data access layer (raw SQL)
├── auth/                  # Passport, session, middleware
├── middleware/            # Validation, error handler, rate limiter
├── routes/                # Express route handlers
├── validation/schemas.ts  # Zod schemas
├── types/                 # TypeScript interfaces
└── utils/                 # Logger, param helpers
```

## Testing

- Postman collection: `CarShowroom.postman_collection.json`
- Google OAuth: start in browser with `GET /auth/google` then verify session with `GET /auth/me`
