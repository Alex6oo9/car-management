# Car Showroom Management System

Backend REST API for managing a car showroom with rental and purchase workflows, session-based authentication, and role-based access control.

## Features

- Three-tier role-based access control (`admin`, `employee`, `client`)
- Session-based authentication with Passport + PostgreSQL session store
- Local (email/password) and Google OAuth 2.0 login
- Email verification flow for new client registration
- Password reset flow with one-time SHA-256-hashed tokens and session revocation
- User management (create/list/update/soft delete/hard delete/role promotion)
- Car inventory management with publish/unpublish and image support
- Rental workflow with date overlap protection and status transitions
- Purchase workflow with atomic `paid -> sold` side effect
- Public car listing endpoints with filtering
- Startup cleanup of expired verification/reset tokens

## Tech Stack

- Node.js 20+
- TypeScript (strict mode, ESM)
- Express.js v5
- PostgreSQL 14+
- `pg` (raw SQL, parameterized)
- Passport.js (`passport-local` + `passport-google-oauth20`) + `express-session` + `connect-pg-simple`
- Zod validation
- Cloudinary (image storage) + Multer (multipart file upload)
- Resend (email delivery)
- Pino + pino-http logging
- Helmet, CORS, express-rate-limit
- Jest + ts-jest (unit testing)

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/car_showroom
SESSION_SECRET=your-secret-at-least-16-chars
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional — defaults shown
CORS_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:3000
FROM_EMAIL=CarShow <onboarding@resend.dev>

# Optional — omit to log emails to console in dev mode
# IMPORTANT: if present, must be non-empty (empty string fails validation)
RESEND_API_KEY=your_resend_api_key

# Optional — omit to disable Google OAuth
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

Default admin credentials:
- email: `admin@example.com`
- password: `admin123`

### 5) Start server

```bash
npm run dev
```

API base URL: `http://localhost:5000`

---

## Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Server health check |

---

## Authentication Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/auth/register` | Public | 100 / 15 min | Register a new `client` and send verification email |
| GET | `/auth/verify-email` | Public | — | Verify email via `?token=...` |
| POST | `/auth/resend-verification` | Public | 100 / 1 hr | Re-send verification link |
| POST | `/auth/forgot-password` | Public | 100 / 1 hr | Request password reset link |
| POST | `/auth/reset-password` | Public | — | Reset password with token |
| GET | `/auth/google` | Guest only | — | Start Google OAuth (browser redirect) |
| GET | `/auth/google/callback` | Public | — | Google OAuth callback (redirects to `APP_URL`) |
| POST | `/auth/login` | Public | 100 / 15 min | Login (blocked with `403` if email not verified) |
| POST | `/auth/logout` | Required | — | Logout current session |
| GET | `/auth/me` | Required | — | Get current authenticated user |

### Auth / Security Notes

- `POST /auth/register` creates users with role `client`; email must be verified before login
- `GET /auth/google` is guarded by `isGuest` — authenticated users are redirected away
- Google OAuth links to an existing account if the same email is already registered
- Password reset tokens are one-time (`used = true` after success) and expire after 1 hour
- Verification and reset tokens are stored as SHA-256 hashes — raw tokens are never persisted
- After successful password reset, all existing sessions for that user are revoked
- Startup cleanup removes expired verification/reset tokens (`src/db/cleanup.ts` called from `src/server.ts`)

---

## User Management (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/users` | Create employee |
| GET | `/admin/users` | List users (`?role=`, `?is_active=`) |
| GET | `/admin/users/:id` | Get user by ID |
| PATCH | `/admin/users/:id` | Update `full_name` / `is_active` |
| PATCH | `/admin/users/:id/role` | Promote `client` → `employee` |
| DELETE | `/admin/users/:id` | Soft delete (sets `is_active = false`) |
| DELETE | `/admin/users/:id/hard` | Hard delete user + sessions |

Hard delete request body:

```json
{ "confirm": "DELETE" }
```

Hard delete protections:
- Cannot hard delete the admin account
- Cannot hard delete your own account

---

## Other API Areas

### Public Cars

| Method | Endpoint | Description |
|---|---|---|
| GET | `/cars` | List published cars (with images) |
| GET | `/cars/:id` | Get published car by ID (with images and documents) |

Query params for `GET /cars`: `brand`, `model`, `year_min`, `year_max`, `price_min`, `price_max`, `rent_price_min`, `rent_price_max`, `limit` (default 20), `offset` (default 0)

### Customers (Admin + Employee)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/customers` | Create customer |
| GET | `/admin/customers` | List customers (`?search=`, `?limit=`, `?offset=`) |
| GET | `/admin/customers/:id` | Get customer by ID |
| PATCH | `/admin/customers/:id` | Update customer |

### Cars (Admin + Employee)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/cars` | Create car (supports `fuel`, `transmission`, `color`, `engine`, `drive`, `seats`) |
| GET | `/admin/cars` | List all cars (`?limit=`, `?offset=`) |
| GET | `/admin/cars/:id` | Get car by ID (with images + documents array) |
| PATCH | `/admin/cars/:id` | Update car (including spec fields) |
| DELETE | `/admin/cars/:id` | Delete car (blocked if linked to rentals/purchases) |
| PATCH | `/admin/cars/:id/publish` | Publish / unpublish car listing |
| POST | `/admin/cars/:id/images` | Upload image — `multipart/form-data`, field name: `image`; optional fields: `is_primary`, `sort_order` |
| PATCH | `/admin/cars/:id/images/:imageId` | Update image properties (`is_primary`, `sort_order`) |
| DELETE | `/admin/cars/:id/images/:imageId` | Delete image (also removes file from Cloudinary) |

### Car Documents (Admin + Employee)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/cars/:carId/documents` | Add document field `{ field_name, field_value, sort_order? }` |
| GET | `/admin/cars/:carId/documents` | List all documents for a car (ordered by `sort_order`) |
| GET | `/admin/cars/:carId/documents/:id` | Get document by ID |
| PATCH | `/admin/cars/:carId/documents/:id` | Update document field |
| DELETE | `/admin/cars/:carId/documents/:id` | Delete document field |

### Rental Terms (Admin + Employee)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/rental-terms` | Create rental term `{ title, description, is_active?, sort_order? }` |
| GET | `/admin/rental-terms` | List all terms (`?is_active=true\|false`) |
| GET | `/admin/rental-terms/:id` | Get term by ID |
| PATCH | `/admin/rental-terms/:id` | Update term |
| DELETE | `/admin/rental-terms/:id` | Hard delete term |

### Rental Terms (Public)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/rental-terms` | List active rental terms (no auth required), ordered by `sort_order` |

### Rentals (Admin + Employee)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/rentals` | Create rental (checks date overlap) |
| GET | `/admin/rentals` | List rentals (`?car_id=`, `?customer_id=`, `?status=`, `?start_date_from=`, `?start_date_to=`) |
| GET | `/admin/rentals/:id` | Get rental by ID (with car + customer info) |
| PATCH | `/admin/rentals/:id/status` | Update rental status |

### Purchases (Admin + Employee)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/purchases` | Create purchase |
| GET | `/admin/purchases` | List purchases (`?car_id=`, `?customer_id=`, `?status=`) |
| GET | `/admin/purchases/:id` | Get purchase by ID (with car + customer info) |
| PATCH | `/admin/purchases/:id/status` | Update purchase status |

---

## Rate Limits

Configured in `src/middleware/rateLimit.ts`:

| Endpoint | Window | Max Requests |
|---|---|---|
| `POST /auth/login` | 15 minutes | 100 |
| `POST /auth/register` | 15 minutes | 100 |
| `POST /auth/forgot-password` | 1 hour | 100 |
| `POST /auth/resend-verification` | 1 hour | 100 |

Tune these for production traffic and abuse patterns.

---

## Database Migrations

Migration files in `src/db/migrations/` (run in order via `npm run migrate`):

| Migration | Description |
|---|---|
| `001_create_users.sql` | `users` table — UUID PK, email, password_hash, full_name, role, is_active |
| `002_create_customers.sql` | `customers` table — UUID PK, contact details, phone-or-email constraint |
| `003_create_cars.sql` | `car_status` ENUM + `cars` table — VIN, pricing, status, is_published |
| `004_create_car_images.sql` | `car_images` table — per-car images with sort order and one-primary constraint |
| `005_create_rentals.sql` | `rental_status` ENUM + `rentals` table — dates, pricing snapshot, status |
| `006_create_purchases.sql` | `purchase_status` ENUM + `purchases` table — sale price snapshot, status |
| `007_create_session.sql` | `session` table — managed by connect-pg-simple |
| `008_email_verification.sql` | `email_verification_tokens` table + `is_email_verified` column on users |
| `009_add_client_role.sql` | Adds `client` to the `users.role` CHECK constraint |
| `010_password_reset_tokens.sql` | `password_reset_tokens` table — hashed tokens, expiry, one-time use flag |
| `011_add_google_auth.sql` | Adds `auth_provider`, `google_id` to users; makes `password_hash` nullable |
| `012_add_car_spec_columns.sql` | Adds 6 nullable spec columns to `cars`: `fuel`, `transmission`, `color`, `engine`, `drive`, `seats` |
| `013_create_rental_terms.sql` | `rental_terms` table — global policy terms with `is_active` toggle and `sort_order` |
| `014_create_car_documents.sql` | `car_documents` table — per-car key-value metadata (field_name + field_value) |

---

## Database Schema

### users
```sql
id UUID PK, email TEXT UNIQUE, password_hash TEXT (nullable for Google accounts),
full_name TEXT, role TEXT CHECK ('admin'|'employee'|'client'),
is_active BOOLEAN, is_email_verified BOOLEAN,
auth_provider TEXT CHECK ('local'|'google'), google_id TEXT (nullable, unique),
created_at, updated_at
```

### customers
```sql
id UUID PK, full_name TEXT, phone TEXT, email TEXT, address_line TEXT,
city TEXT, country TEXT, created_at, updated_at
CONSTRAINT check_contact_method: phone IS NOT NULL OR email IS NOT NULL
```

### cars
```sql
id UUID PK, vin TEXT UNIQUE, brand TEXT, model TEXT, year INT,
mileage_km INT, sale_price NUMERIC(12,2), rent_price_per_day NUMERIC(12,2),
currency_code CHAR(3) DEFAULT 'THB', status car_status DEFAULT 'available',
is_published BOOLEAN,
fuel TEXT CHECK ('petrol'|'diesel'|'electric'|'hybrid'|'plug-in hybrid'),
transmission TEXT CHECK ('automatic'|'manual'|'cvt'),
color TEXT, engine TEXT,
drive TEXT CHECK ('fwd'|'rwd'|'awd'|'4wd'),
seats INTEGER CHECK (seats > 0 AND seats <= 20),
created_at, updated_at, created_by_user_id UUID FK→users
```
`car_status` ENUM: `available | reserved | rented | sold | maintenance`

All 6 spec columns are nullable — existing records are unaffected.

### car_images
```sql
id UUID PK, car_id UUID FK→cars CASCADE, storage_path TEXT,
is_primary BOOLEAN, sort_order INT, created_at
UNIQUE (car_id, sort_order)
UNIQUE INDEX on (car_id) WHERE is_primary = true  -- one primary per car
```

### car_documents
```sql
id UUID PK, car_id UUID FK→cars CASCADE,
field_name TEXT NOT NULL, field_value TEXT NOT NULL,
sort_order INT DEFAULT 0,
created_by_user_id UUID FK→users SET NULL,
created_at, updated_at
INDEX on (car_id)
```
Admin-defined key-value metadata per car. Not exposed on public endpoints.

### rental_terms
```sql
id UUID PK, title TEXT NOT NULL, description TEXT NOT NULL,
is_active BOOLEAN DEFAULT true, sort_order INT DEFAULT 0,
created_by_user_id UUID FK→users SET NULL,
created_at, updated_at
INDEX on (is_active)
```
Global policy terms — no FK to cars, rentals, or customers.

### rentals
```sql
id UUID PK, car_id UUID FK→cars RESTRICT, customer_id UUID FK→customers RESTRICT,
start_date DATE, end_date DATE, price_per_day NUMERIC(12,2), total_price NUMERIC(12,2),
deposit_amount NUMERIC(12,2), currency_code CHAR(3), status rental_status,
cancelled_reason TEXT, created_at, updated_at, created_by_user_id UUID FK→users
CONSTRAINT check_dates: end_date >= start_date
```
`rental_status` ENUM: `pending | confirmed | active | completed | cancelled`

### purchases
```sql
id UUID PK, car_id UUID FK→cars RESTRICT, customer_id UUID FK→customers RESTRICT,
sale_price NUMERIC(12,2), currency_code CHAR(3), status purchase_status,
created_at, updated_at, created_by_user_id UUID FK→users
UNIQUE INDEX on (car_id) WHERE status = 'paid'  -- one paid purchase per car
```
`purchase_status` ENUM: `pending | paid | cancelled | refunded`

### email_verification_tokens
```sql
id UUID PK, user_id UUID FK→users CASCADE, token_hash TEXT,
expires_at TIMESTAMPTZ, created_at
```

### password_reset_tokens
```sql
id UUID PK, user_id UUID FK→users CASCADE, token_hash TEXT,
expires_at TIMESTAMPTZ, used BOOLEAN DEFAULT false, created_at
```

### session
```sql
sid VARCHAR PK, sess JSON, expire TIMESTAMPTZ
```
Managed automatically by connect-pg-simple.

---

## Project Structure

```
src/
├── server.ts              # Entry point — creates app, starts listener, runs cleanup
├── app.ts                 # Express app factory — mounts all middleware & routes
├── config/
│   └── env.ts             # Zod-validated environment (exits on bad config)
├── db/
│   ├── pool.ts            # PostgreSQL connection pool (singleton)
│   ├── migrate.ts         # Migration runner (reads SQL files in order)
│   ├── cleanup.ts         # Deletes expired verification/reset tokens on startup
│   ├── migrations/        # SQL migration files (001–014)
│   ├── seeds/             # admin.seed.ts (admin@example.com / admin123), clear-test-data.ts
│   └── repositories/      # Data access layer (raw SQL, parameterized)
│       ├── users.repo.ts
│       ├── customers.repo.ts
│       ├── cars.repo.ts
│       ├── rentals.repo.ts
│       ├── purchases.repo.ts
│       ├── rental-terms.repo.ts
│       └── car-documents.repo.ts
├── auth/
│   ├── passport.ts        # LocalStrategy + GoogleStrategy config
│   ├── session.ts         # express-session config with PgSession store
│   └── middleware.ts      # isAuthenticated, isGuest, isAdmin, isAdminOrEmployee
├── middleware/
│   ├── validate.ts        # validate(schema) and validateParams(schema) wrappers
│   ├── errorHandler.ts    # Global Express error handler
│   ├── rateLimit.ts       # Rate limiters for auth endpoints
│   └── upload.ts          # Multer memory storage for image uploads
├── routes/
│   ├── auth.routes.ts
│   ├── admin.users.routes.ts
│   ├── admin.customers.routes.ts
│   ├── admin.cars.routes.ts
│   ├── admin.car-documents.routes.ts
│   ├── admin.rentals.routes.ts
│   ├── admin.purchases.routes.ts
│   ├── admin.rental-terms.routes.ts
│   ├── public.cars.routes.ts
│   └── public.rental-terms.routes.ts
├── services/
│   └── email.ts           # sendVerificationEmail, sendPasswordResetEmail (Resend SDK)
├── validation/
│   └── schemas.ts         # All Zod schemas
├── types/
│   ├── models.ts          # TypeScript interfaces for all DB entities
│   └── express.d.ts       # Augments Express.User with id, email, full_name, role
└── utils/
    ├── logger.ts          # Pino logger instance
    ├── tokens.ts          # generateToken(), hashToken() (SHA-256)
    ├── cloudinary.ts      # uploadImageBuffer, deleteImage, extractPublicId
    └── params.ts          # getParam(req, name) — handles Express 5 string|string[]
```

---

## Production Checklist

- Set real `RESEND_API_KEY` and verified sender domain/email
- Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (required for image uploads)
- Tighten `CORS_ORIGIN` to trusted frontend domain(s)
- Ensure secure session cookie settings (`secure`, `sameSite`, `maxAge`) are correct for deployment architecture
- Review rate limits for realistic production thresholds
- Enforce HTTPS end-to-end
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` if Google OAuth is needed

---

## Postman Collection

Collection file: `CarShowroom.postman_collection.json`

Notes:
- Keep exported collection synced after endpoint changes
- Use valid variable placeholders (`{{employee_id}}`, `{{car_id}}`, etc.)
- Define all variables in collection or environment before running
- For Google OAuth testing: start flow in a browser with `GET /auth/google`, then verify session with `GET /auth/me`

---

## Scripts

```bash
npm run dev       # Start dev server with hot reload (tsx watch)
npm run build     # Compile TypeScript → dist/
npm start         # Run compiled server (node dist/server.js)
npm run migrate   # Run all SQL migrations in order
npm run seed      # Create admin@example.com / admin123
npm run clear     # Clear test data (src/db/seeds/clear-test-data.ts)
npm test          # Run Jest unit test suite (29 tests, no DB required)
```
