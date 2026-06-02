# CLAUDE.md — Car Showroom Management System

> Reference document for Claude when working on this codebase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict mode, ES modules) |
| Framework | Express.js v5 |
| Database | PostgreSQL 14+ |
| DB Client | `pg` (raw SQL, parameterized queries, no ORM) |
| Auth | Passport.js local strategy + Google OAuth + express-session |
| Session Storage | connect-pg-simple (PostgreSQL session table) |
| Password Hashing | bcrypt (10 rounds) |
| Input Validation | Zod |
| Security Headers | Helmet |
| CORS | cors middleware |
| Rate Limiting | express-rate-limit |
| Logging | Pino + pino-http |
| Image Storage | Cloudinary (via multer buffer upload) |
| Email | Resend (via `src/services/email.ts`) |
| Testing | Jest + ts-jest (ESM-compatible, pure unit tests) |

**Module system**: `"type": "module"` in package.json — all imports must use `.js` extensions.

---

## Project Structure

```
src/
├── server.ts                            # Entry point — creates app, starts listener
├── app.ts                               # Express app factory — mounts all middleware & routes
├── config/
│   └── env.ts                           # Zod-validated env vars (fails fast on bad config)
├── db/
│   ├── pool.ts                          # PostgreSQL connection pool (singleton)
│   ├── migrate.ts                       # Migration runner (reads & executes SQL files in order)
│   ├── cleanup.ts                       # Database cleanup utility
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_customers.sql
│   │   ├── 003_create_cars.sql
│   │   ├── 004_create_car_images.sql
│   │   ├── 005_create_rentals.sql
│   │   ├── 006_create_purchases.sql
│   │   ├── 007_create_session.sql
│   │   ├── 008_email_verification.sql
│   │   ├── 009_add_client_role.sql
│   │   ├── 010_password_reset_tokens.sql
│   │   ├── 011_add_google_auth.sql
│   │   ├── 012_add_car_spec_columns.sql
│   │   ├── 013_create_rental_terms.sql
│   │   ├── 014_create_car_documents.sql
│   │   ├── 015_add_body_type_to_cars.sql
│   │   ├── 016_create_dealer_contacts.sql
│   │   ├── 017_add_profile_fields_to_users.sql
│   │   ├── 018_add_listing_type_to_cars.sql
│   │   └── 019_create_feedback.sql
│   ├── seeds/
│   │   ├── admin.seed.ts                # Seeds admin@example.com / admin123
│   │   └── clear-test-data.ts           # Clears test data (used by npm run clear)
│   └── repositories/
│       ├── users.repo.ts
│       ├── customers.repo.ts
│       ├── cars.repo.ts                 # Also manages car_images; getDashboardStats()
│       ├── car-documents.repo.ts        # CRUD for car_documents
│       ├── rental-terms.repo.ts         # CRUD for rental_terms
│       ├── rentals.repo.ts              # Includes overlap check + status transitions
│       ├── purchases.repo.ts            # Includes atomic paid→sold transaction
│       ├── dealer-contacts.repo.ts      # Single-row showroom contact info (get/update)
│       └── feedback.repo.ts             # Customer feedback (public submit, admin moderation)
├── auth/
│   ├── passport.ts                      # LocalStrategy + GoogleStrategy config + serialize/deserialize
│   ├── session.ts                       # express-session config with PgSession store
│   └── middleware.ts                    # isAuthenticated, isAdmin, isAdminOrEmployee
├── middleware/
│   ├── validate.ts                      # validate(schema) and validateParams(schema) wrappers
│   ├── errorHandler.ts                  # Global Express error handler
│   ├── rateLimit.ts                     # loginRateLimit, registerRateLimit, forgotPasswordRateLimit, resendVerificationRateLimit
│   └── upload.ts                        # Multer memory storage for image uploads
├── routes/
│   ├── auth.routes.ts                   # All auth endpoints (login, register, OAuth, password reset)
│   ├── admin.users.routes.ts            # /admin/users — admin only
│   ├── admin.customers.routes.ts        # /admin/customers — admin + employee
│   ├── admin.cars.routes.ts             # /admin/cars — admin + employee
│   ├── admin.car-documents.routes.ts    # /admin/cars/:carId/documents — admin + employee
│   ├── admin.rental-terms.routes.ts     # /admin/rental-terms — admin + employee
│   ├── admin.rentals.routes.ts          # /admin/rentals — admin + employee
│   ├── admin.purchases.routes.ts        # /admin/purchases — admin + employee
│   ├── admin.dealer-contact.routes.ts   # /admin/dealer-contact — admin + employee
│   ├── admin.feedback.routes.ts         # /admin/feedback — admin + employee (moderation)
│   ├── profile.routes.ts                # /profile — any authenticated user
│   ├── public.cars.routes.ts            # /cars — public (no auth)
│   ├── public.rental-terms.routes.ts    # /rental-terms — public (no auth)
│   ├── public.dealer-contact.routes.ts  # /dealer-contact — public (no auth)
│   └── public.feedback.routes.ts        # /feedback — public (list + submit)
├── services/
│   └── email.ts                         # sendVerificationEmail, sendPasswordResetEmail
├── validation/
│   └── schemas.ts                       # All Zod schemas (create/update for each resource)
├── types/
│   ├── models.ts                        # TypeScript interfaces for all DB entities
│   └── express.d.ts                     # Augments Express.User with id, email, full_name, role, is_email_verified
└── utils/
    ├── logger.ts                        # Pino logger instance
    ├── params.ts                        # getParam(req, name) — handles Express 5 string|string[]
    ├── cloudinary.ts                    # uploadImageBuffer, deleteImage, extractPublicId
    ├── tokens.ts                        # generateToken(), hashToken() — SHA-256 for secure storage
    └── rental.ts                        # isValidRentalTransition, calculateRentalTotalPrice, snapshotPrice

jest.config.ts                           # Jest config — ESM-compatible ts-jest setup
src/
└── __tests__/
    └── rental.test.ts                   # 29 unit tests: status transitions, price snapshot, total price
```

---

## Critical Gotchas

- **Express 5 `req.params`** returns `string | string[]`. Always use `getParam(req, 'id')` from `src/utils/params.ts` — never `req.params.id` directly.
- **pino-http**: Import as `{ pinoHttp }` (named export), not default.
- **`.js` extensions**: Required on all imports — TypeScript compiles to ESM.
- **ENUM types** in migrations use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$` to be idempotent.
- **Image upload**: `POST /admin/cars/:id/images` expects `multipart/form-data` (actual file), not JSON. Uses Multer memory storage → Cloudinary.
- **Token security**: Tokens (email verification, password reset) are stored as SHA-256 hashes only — never plaintext.
- **Email verification gate**: Login returns `403` if `is_email_verified = false`. Existing users set to verified by migration 008.

---

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/CarShow
SESSION_SECRET=at-least-16-characters
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional (have defaults)
CORS_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:3000
FROM_EMAIL=CarShow <onboarding@resend.dev>

# Optional (features disabled if absent)
RESEND_API_KEY=re_xxxx                         # emails sent as no-op if missing
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
```

Validated at startup via Zod in `src/config/env.ts`. Process exits immediately if required vars are missing/invalid.

---

## Database Schema

### users
```sql
id UUID PK, email TEXT UNIQUE NOT NULL, password_hash TEXT (nullable for Google accounts),
full_name TEXT NOT NULL, role TEXT CHECK ('admin'|'employee'|'client'),
is_active BOOLEAN DEFAULT true, is_email_verified BOOLEAN DEFAULT false,
auth_provider TEXT CHECK ('local'|'google') DEFAULT 'local',
google_id TEXT (unique, nullable),
line_contact TEXT (nullable), phone TEXT (nullable),
created_at, updated_at
```
- Only one admin (seeded). Admin cannot be deleted or have role changed.
- Employees created via API can be soft-deleted (sets `is_active = false`).
- Clients register themselves via `POST /auth/register`; can be promoted to employee.
- Google users have `password_hash = NULL` and `auth_provider = 'google'`.

### email_verification_tokens
```sql
id UUID PK, user_id UUID FK→users CASCADE,
token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at
```
- Token hashed (SHA-256) before storage. Raw token sent in email link only.
- Expires in **24 hours**. Deleted on successful verification.

### password_reset_tokens
```sql
id UUID PK, user_id UUID FK→users CASCADE,
token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
used BOOLEAN DEFAULT false, created_at
```
- Token hashed (SHA-256) before storage. Expires in **1 hour**.
- Marked `used = true` after a successful reset (not deleted, for audit).
- All sessions destroyed after successful reset.

### customers
```sql
id UUID PK, full_name TEXT NOT NULL, phone TEXT, email TEXT, address_line TEXT,
city TEXT, country TEXT, created_at, updated_at
CONSTRAINT check_contact_method: phone IS NOT NULL OR email IS NOT NULL
```

### cars
```sql
id UUID PK, vin TEXT UNIQUE, brand TEXT NOT NULL, model TEXT NOT NULL,
year INT CHECK (1900..now+1), mileage_km INT DEFAULT 0,
sale_price NUMERIC(12,2), rent_price_per_day NUMERIC(12,2),
currency_code CHAR(3) DEFAULT 'THB', status car_status DEFAULT 'available',
is_published BOOLEAN DEFAULT false,
fuel TEXT CHECK ('petrol'|'diesel'|'electric'|'hybrid'|'plug-in hybrid'),
transmission TEXT CHECK ('automatic'|'manual'|'cvt'),
color TEXT, engine TEXT,
drive TEXT CHECK ('fwd'|'rwd'|'awd'|'4wd'),
seats INT CHECK (1..20),
body_type car_body_type (nullable),
listing_type car_listing_type NOT NULL DEFAULT 'sale',
created_at, updated_at, created_by_user_id UUID FK→users SET NULL
```
**car_status ENUM**: `available | reserved | rented | sold | maintenance`
**car_body_type ENUM**: `sedan | hatchback | suv | pickup_truck | van_minivan | electric | coupe | convertible`
**car_listing_type ENUM**: `sale | rent` — a car is strictly for sale OR for rent (not both). Purchases are rejected for `rent` cars (`CAR_NOT_FOR_SALE`); rentals are rejected for `sale` cars (`CAR_NOT_FOR_RENT`). Dashboard stats split the available bucket by `listing_type`.

### car_images
```sql
id UUID PK, car_id UUID FK→cars CASCADE, storage_path TEXT NOT NULL,
is_primary BOOLEAN DEFAULT false, sort_order INT DEFAULT 0, created_at
UNIQUE (car_id, sort_order)
UNIQUE INDEX on (car_id) WHERE is_primary = true  -- one primary per car
```
`storage_path` stores the Cloudinary URL.

### car_documents
```sql
id UUID PK, car_id UUID FK→cars CASCADE,
field_name TEXT NOT NULL, field_value TEXT NOT NULL,
sort_order INT DEFAULT 0,
created_by_user_id UUID FK→users SET NULL, created_at, updated_at
```
Key-value pairs for arbitrary car specifications (e.g., registration number, insurance expiry).

### rentals
```sql
id UUID PK, car_id UUID FK→cars RESTRICT, customer_id UUID FK→customers RESTRICT,
start_date DATE, end_date DATE, price_per_day NUMERIC(12,2), total_price NUMERIC(12,2),
deposit_amount NUMERIC(12,2) DEFAULT 0, currency_code CHAR(3), status rental_status DEFAULT 'pending',
cancelled_reason TEXT, created_at, updated_at, created_by_user_id UUID FK→users SET NULL
CONSTRAINT check_dates: end_date >= start_date
```
**rental_status ENUM**: `pending | confirmed | active | completed | cancelled`

### purchases
```sql
id UUID PK, car_id UUID FK→cars RESTRICT, customer_id UUID FK→customers RESTRICT,
sale_price NUMERIC(12,2) NOT NULL, currency_code CHAR(3), status purchase_status DEFAULT 'pending',
created_at, updated_at, created_by_user_id UUID FK→users SET NULL
UNIQUE INDEX on (car_id) WHERE status = 'paid'  -- one paid purchase per car
```
**purchase_status ENUM**: `pending | paid | cancelled | refunded`

### rental_terms
```sql
id UUID PK, title TEXT NOT NULL, description TEXT NOT NULL,
is_active BOOLEAN DEFAULT true, sort_order INT DEFAULT 0,
created_by_user_id UUID FK→users SET NULL, created_at, updated_at
```

### dealer_contacts
```sql
id UUID PK, showroom_name TEXT NOT NULL DEFAULT 'BKK Kaung Pyae',
open_day_from TEXT, open_day_to TEXT, open_time_from TEXT, open_time_to TEXT,
status TEXT CHECK ('auto'|'open'|'closed') DEFAULT 'auto',
phone_number TEXT, line_contact TEXT, facebook_url TEXT, instagram_url TEXT,
gmail TEXT, viber_contact TEXT, wechat_contact TEXT, map_url TEXT,
created_at, updated_at
```
- **Single-row** table — one showroom contact record, seeded on migration. The repo always reads/updates that one row (no create/delete endpoints).
- `status = 'auto'` means open/closed is derived from the open day/time fields; `'open'`/`'closed'` force it.

### feedback
```sql
id UUID PK, stars INT NOT NULL CHECK (1..5),
name TEXT NOT NULL DEFAULT 'Anonymous', message TEXT NOT NULL,
is_approved BOOLEAN NOT NULL DEFAULT false,
created_at, updated_at
```
- Standalone homepage testimonials — **no car/customer relation**.
- **Public submit** (`POST /feedback`, no login): rate-limited (`feedbackRateLimit`, 5/hour per IP) and starts `is_approved = false` (hidden until an admin approves).
- **`name` is server-derived**, never from the request body: logged-in submitter → their `users.full_name`; guest → `'Anonymous'`.
- Public list (`GET /feedback`) returns only `is_approved = true`, newest-first, `?limit=`/`?offset=`.
- Admins moderate only (list-all, approve/hide via `PATCH /:id/status`, delete) — they don't edit the customer's words.

### session
```sql
sid VARCHAR PK, sess JSON, expire TIMESTAMPTZ
```
Managed automatically by connect-pg-simple.

---

## Authentication Flow

### Local Auth
1. `POST /auth/register` — creates user with `role='client'`, `is_email_verified=false`, sends verification email
2. `GET /auth/verify-email?token=<raw>` — verifies token hash, sets `is_email_verified=true`
3. `POST /auth/login` — Passport LocalStrategy checks bcrypt + `is_email_verified`; 403 if unverified
4. Session created in PostgreSQL `session` table, HttpOnly cookie sent
5. `POST /auth/logout` — destroys session

### Google OAuth
1. `GET /auth/google` — redirects to Google consent screen (must not already be authenticated)
2. `GET /auth/google/callback` — Passport GoogleStrategy upserts user, redirects to `env.APP_URL`

### Password Reset
1. `POST /auth/forgot-password` — generates token, sends email (always responds with same message to prevent enumeration)
2. `POST /auth/reset-password` — verifies token hash, updates password, marks `is_email_verified=true`, destroys all sessions

**Middleware chain for protected routes**:
```
isAuthenticated → (isAdmin | isAdminOrEmployee) → route handler
```

---

## API Endpoints

### Authentication (Public/Guest)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /auth/register | Guest | Self-register as client, triggers verification email |
| GET | /auth/verify-email | Public | Verify email via `?token=` query param |
| POST | /auth/resend-verification | Public | Resend verification email |
| POST | /auth/forgot-password | Public | Request password reset email |
| POST | /auth/reset-password | Public | Complete password reset with token |
| GET | /auth/google | Guest | Initiate Google OAuth |
| GET | /auth/google/callback | Public | Google OAuth callback |
| POST | /auth/login | Public | Login (rate limited: 100/15min) |
| POST | /auth/logout | Authenticated | Destroy session |
| GET | /auth/me | Authenticated | Get current user info |

### Public Endpoints (No Auth)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | /cars | Public | List published cars (with images) |
| GET | /cars/:id | Public | Get car by ID (with images and documents) |
| GET | /rental-terms | Public | List active rental terms |
| GET | /dealer-contact | Public | Showroom contact info (phone, LINE, social, hours) |
| GET | /feedback | Public | List approved feedback, newest first (`?limit=`, `?offset=`) |
| POST | /feedback | Public | Submit feedback (`{ stars, message }`; rate-limited 5/hr; starts unapproved; name from session or 'Anonymous') |
| GET | /health | Public | Health check (`{ status: 'ok', timestamp }`) |

Query params for `GET /cars`: `brand`, `model`, `year_min`, `year_max`, `price_min`, `price_max`, `rent_price_min`, `rent_price_max`, `body_type`, `limit` (default 20), `offset` (default 0)

### Authenticated (Any Logged-in User)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | /profile | Authenticated | Get own profile (full_name, email, role, line_contact, phone, …) |
| PATCH | /profile | Authenticated | Update own `full_name`, `line_contact`, `phone` |

### User Management (Admin only)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/users | Admin | Create employee user |
| GET | /admin/users | Admin | List users (`?role=`, `?is_active=`) |
| GET | /admin/users/:id | Admin | Get user by ID |
| PATCH | /admin/users/:id | Admin | Update full_name, is_active |
| PATCH | /admin/users/:id/role | Admin | Promote client → employee only |
| PATCH | /admin/users/:id/role/demote | Admin | Demote employee → client (empty JSON body `{}`) |
| DELETE | /admin/users/:id | Admin | Soft-delete (sets is_active=false; cannot delete admin) |
| DELETE | /admin/users/:id/hard | Admin | Hard delete (cannot delete admin or self) |

### Customers

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/customers | Admin+Employee | Create customer |
| GET | /admin/customers | Admin+Employee | List (`?search=`, `?limit=`, `?offset=`) |
| GET | /admin/customers/:id | Admin+Employee | Get by ID |
| PATCH | /admin/customers/:id | Admin+Employee | Update |

### Cars (Admin)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/cars | Admin+Employee | Create car |
| GET | /admin/cars/stats | Admin+Employee | Dashboard counts (available/unavailable sale & rental, total sold, active rentals) |
| GET | /admin/cars | Admin+Employee | List all cars (`?status=`, `?listing_type=`, `?body_type=`, `?limit=`, `?offset=`) |
| GET | /admin/cars/:id | Admin+Employee | Get by ID (with images + documents) |
| PATCH | /admin/cars/:id | Admin+Employee | Update car |
| DELETE | /admin/cars/:id | Admin+Employee | Delete (blocked if has rentals/purchases) |
| PATCH | /admin/cars/:id/publish | Admin+Employee | `{ is_published: true\|false }` |
| POST | /admin/cars/:id/images | Admin+Employee | Upload image (`multipart/form-data`, field: `image`) |
| PATCH | /admin/cars/:id/images/:imageId | Admin+Employee | Update image properties (is_primary, sort_order) |
| DELETE | /admin/cars/:id/images/:imageId | Admin+Employee | Delete image (also removes from Cloudinary) |

### Car Documents

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/cars/:carId/documents | Admin+Employee | Add document field to car |
| GET | /admin/cars/:carId/documents | Admin+Employee | List all documents for car |
| GET | /admin/cars/:carId/documents/:id | Admin+Employee | Get document by ID |
| PATCH | /admin/cars/:carId/documents/:id | Admin+Employee | Update document |
| DELETE | /admin/cars/:carId/documents/:id | Admin+Employee | Delete document |

### Rental Terms

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/rental-terms | Admin+Employee | Create rental term |
| GET | /admin/rental-terms | Admin+Employee | List all terms (`?is_active=true\|false`) |
| GET | /admin/rental-terms/:id | Admin+Employee | Get by ID |
| PATCH | /admin/rental-terms/:id | Admin+Employee | Update term |
| DELETE | /admin/rental-terms/:id | Admin+Employee | Delete term |

### Rentals

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/rentals | Admin+Employee | Create rental (checks overlap) |
| GET | /admin/rentals | Admin+Employee | List (`?car_id=`, `?customer_id=`, `?status=`, `?start_date_from=`, `?start_date_to=`) |
| GET | /admin/rentals/:id | Admin+Employee | Get by ID (with car + customer info) |
| PATCH | /admin/rentals/:id/status | Admin+Employee | Update status |

### Purchases

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/purchases | Admin+Employee | Create purchase |
| GET | /admin/purchases | Admin+Employee | List (`?car_id=`, `?customer_id=`, `?status=`) |
| GET | /admin/purchases/:id | Admin+Employee | Get by ID (with car + customer info) |
| PATCH | /admin/purchases/:id/status | Admin+Employee | Update status |

### Dealer Contact

| Method | Path | Access | Description |
|---|---|---|---|
| GET | /admin/dealer-contact | Admin+Employee | Get the showroom contact record |
| PATCH | /admin/dealer-contact | Admin+Employee | Update showroom contact/hours (single-row, partial update) |

### Feedback (Admin)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | /admin/feedback | Admin+Employee | List all feedback (`?is_approved=true\|false`), newest first |
| GET | /admin/feedback/:id | Admin+Employee | Get feedback by ID |
| PATCH | /admin/feedback/:id/status | Admin+Employee | Approve/hide (`{ is_approved: true\|false }`) |
| DELETE | /admin/feedback/:id | Admin+Employee | Delete feedback |

---

## Business Rules

### User Roles
- `admin`: single seeded account; cannot be deleted, deactivated, or have role changed
- `employee`: created by admin via API; can be soft-deleted; can be demoted back to client via `PATCH /admin/users/:id/role/demote`
- `client`: self-registers via `POST /auth/register`; can be promoted to employee via `PATCH /admin/users/:id/role`

### Email Verification
- New registrations (`/auth/register`) start with `is_email_verified = false`
- Login blocked with `403` until email is verified
- Verification token: 24-hour expiry, SHA-256 hashed in DB
- Password reset auto-sets `is_email_verified = true`
- Existing users before migration 008 are grandfathered in as verified

### Rental Date Overlap
End date is **inclusive**. Overlap detected when:
```
new_start_date <= existing_end_date AND new_end_date >= existing_start_date
```
Only checks rentals with status `pending | confirmed | active`.

### Rental Total Price Calculation
```
days = (end_date - start_date) + 1   // inclusive
total_price = days * price_per_day
```
`price_per_day` is snapshotted from `cars.rent_price_per_day` at booking time.

### Rental Status Transitions
```
pending → confirmed, cancelled
confirmed → active, cancelled
active → completed, cancelled
completed → (final)
cancelled → (final)
```
Side effects:
- `active` → sets `cars.status = 'rented'` (atomic transaction)
- `completed | cancelled` → sets `cars.status = 'available'` (if no other active rentals)

### Purchase Status Transitions
```
pending → paid, cancelled
paid → refunded
cancelled → (final)
refunded → (final)
```
Side effect:
- `paid` → sets `cars.status = 'sold'` **atomically** in same PostgreSQL transaction

### Listing Type (sale vs rent)
- Each car has a `listing_type` of `'sale'` or `'rent'` — strictly one, never both. Defaults to `'sale'`.
- **Purchase** of a `rent` car is rejected: `400 { code: 'CAR_NOT_FOR_SALE' }`.
- **Rental** of a `sale` car is rejected: `400 { code: 'CAR_NOT_FOR_RENT' }`.
- The admin dashboard stats (`GET /admin/cars/stats`) split the "available" bucket by `listing_type` (not by which price field is set), so sale/rental counts never overlap.

### Car Availability
- **For rent**: `cars.status = 'available'` AND `listing_type = 'rent'` AND no overlapping rentals
- **For purchase**: `cars.status = 'available'` AND `listing_type = 'sale'` (strictly, not rented/sold/maintenance)

### Price Snapshotting
Prices copied at transaction time:
- Rental: `cars.rent_price_per_day` → `rentals.price_per_day`
- Purchase: `cars.sale_price` → `purchases.sale_price`

### Customer Feedback (homepage testimonials)
- Anyone can submit via `POST /feedback` (no login). Three abuse defenses: **approval gate** (new feedback `is_approved = false`, hidden until an admin approves), **per-IP rate limit** (`feedbackRateLimit`, 5/hour), and **validation** (stars 1–5, message 5–1000 chars).
- The display `name` is **server-derived**: logged-in → account `full_name`; guest → `'Anonymous'`. The request body cannot set the name (anti-impersonation).
- Admins moderate (approve/hide/delete) but do not edit the customer's words.

---

## Rate Limiting

| Limiter | Window | Max Requests |
|---|---|---|
| loginRateLimit | 15 min | 100 |
| registerRateLimit | 15 min | 100 |
| forgotPasswordRateLimit | 1 hour | 100 |
| resendVerificationRateLimit | 1 hour | 100 |
| feedbackRateLimit | 15 min | 100 (loosened for testing; restore to 5/hr before production) |

---

## Standard Response Format

**Success**: HTTP 200/201 with JSON body
**Error**:
```json
{ "error": "Human-readable message", "code": "MACHINE_CODE", "details": {} }
```

Common HTTP codes used:
- `400` Bad Request / validation error (incl. `CAR_NOT_FOR_SALE`, `CAR_NOT_FOR_RENT`, `INVALID_STATUS`, `INVALID_LISTING_TYPE`, `INVALID_BODY_TYPE`)
- `401` Unauthorized (not logged in)
- `403` Forbidden (wrong role, or email not verified)
- `404` Not Found
- `409` Conflict (date overlap, duplicate VIN, car already sold)
- `500` Internal Server Error

---

## Scripts

```bash
npm run dev       # tsx watch src/server.ts (hot reload)
npm run build     # tsc → dist/
npm start         # node dist/server.js
npm run migrate   # Run all SQL migrations in order
npm run seed      # Create admin@example.com / admin123
npm run clear     # Clear test data (src/db/seeds/clear-test-data.ts)
npm test          # Run Jest unit test suite
```

---

## Setup Instructions

```bash
# 1. Install dependencies
npm install

# 2. Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE CarShow;"

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and Cloudinary credentials

# 4. Run migrations
npm run migrate

# 5. Seed admin user
npm run seed

# 6. Start dev server
npm run dev
# API available at http://localhost:5000
```

---

## Testing

Unit tests live in `src/__tests__/`. They cover pure business logic with no database or mocking:

| File | Suites | Tests |
|---|---|---|
| `rental.test.ts` | Status Transitions, Price Snapshotting, Total Price Calculation | 29 |

Utility functions under test are in `src/utils/rental.ts`. Run with `npm test`.

**Config**: `jest.config.ts` at project root uses `ts-jest/presets/default-esm` with `moduleNameMapper` to strip `.js` extensions (required for Node16 ESM resolution in Jest).

---

## Adding New Features

1. Add Zod schema to `src/validation/schemas.ts`
2. Add TypeScript type to `src/types/models.ts` if new entity
3. Add repository methods to `src/db/repositories/`
4. Create route file in `src/routes/`
5. Mount route in `src/app.ts`
6. If new table: add migration to `src/db/migrations/` (next number in sequence)
7. If new pure business logic: add utility function to `src/utils/` and a test in `src/__tests__/`

All route handlers follow this pattern:
```typescript
router.method('/path', validateParams(schema), validate(schema), async (req, res) => {
  try {
    // business logic
  } catch (err) {
    console.error('context:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```
