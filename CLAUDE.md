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
| Auth | Passport.js local strategy + express-session |
| Session Storage | connect-pg-simple (PostgreSQL session table) |
| Password Hashing | bcrypt (10 rounds) |
| Input Validation | Zod |
| Security Headers | Helmet |
| CORS | cors middleware |
| Rate Limiting | express-rate-limit |
| Logging | Pino + pino-http |

**Module system**: `"type": "module"` in package.json — all imports must use `.js` extensions.

---

## Project Structure

```
src/
├── server.ts                        # Entry point — creates app, starts listener
├── app.ts                           # Express app factory — mounts all middleware & routes
├── config/
│   └── env.ts                       # Zod-validated env vars (fails fast on bad config)
├── db/
│   ├── pool.ts                      # PostgreSQL connection pool (singleton)
│   ├── migrate.ts                   # Migration runner (reads & executes SQL files in order)
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_customers.sql
│   │   ├── 003_create_cars.sql
│   │   ├── 004_create_car_images.sql
│   │   ├── 005_create_rentals.sql
│   │   ├── 006_create_purchases.sql
│   │   └── 007_create_session.sql
│   ├── seeds/
│   │   └── admin.seed.ts            # Seeds admin@example.com / admin123
│   └── repositories/
│       ├── users.repo.ts
│       ├── customers.repo.ts
│       ├── cars.repo.ts             # Also manages car_images
│       ├── rentals.repo.ts          # Includes overlap check + status transitions
│       └── purchases.repo.ts        # Includes atomic paid→sold transaction
├── auth/
│   ├── passport.ts                  # LocalStrategy config + serialize/deserialize
│   ├── session.ts                   # express-session config with PgSession store
│   └── middleware.ts                # isAuthenticated, isAdmin, isAdminOrEmployee
├── middleware/
│   ├── validate.ts                  # validate(schema) and validateParams(schema) wrappers
│   ├── errorHandler.ts              # Global Express error handler
│   └── rateLimit.ts                 # loginRateLimit (10 req / 15 min)
├── routes/
│   ├── auth.routes.ts               # POST /auth/login, POST /auth/logout, GET /auth/me
│   ├── admin.users.routes.ts        # /admin/users — admin only
│   ├── admin.customers.routes.ts    # /admin/customers — admin + employee
│   ├── admin.cars.routes.ts         # /admin/cars — admin + employee
│   ├── admin.rentals.routes.ts      # /admin/rentals — admin + employee
│   ├── admin.purchases.routes.ts    # /admin/purchases — admin + employee
│   └── public.cars.routes.ts        # /cars — public (no auth)
├── validation/
│   └── schemas.ts                   # All Zod schemas (create/update for each resource)
├── types/
│   ├── models.ts                    # TypeScript interfaces for all DB entities
│   └── express.d.ts                 # Augments Express.User with id, email, full_name, role
└── utils/
    ├── logger.ts                    # Pino logger instance
    └── params.ts                    # getParam(req, name) — handles Express 5 string|string[]
```

---

## Critical Gotchas

- **Express 5 `req.params`** returns `string | string[]`. Always use `getParam(req, 'id')` from `src/utils/params.ts` — never `req.params.id` directly.
- **pino-http**: Import as `{ pinoHttp }` (named export), not default.
- **`.js` extensions**: Required on all imports — TypeScript compiles to ESM.
- **ENUM types** in migrations use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$` to be idempotent.

---

## Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/CarShow
SESSION_SECRET=at-least-16-characters
CORS_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=development
```

Validated at startup via Zod in `src/config/env.ts`. Process exits immediately if any are missing/invalid.

---

## Database Schema

### users
```sql
id UUID PK, email TEXT UNIQUE, password_hash TEXT, full_name TEXT,
role TEXT CHECK ('admin'|'employee'), is_active BOOLEAN, created_at, updated_at
```
- Only one admin (seeded). Admin cannot be deleted.
- Employees created via API can be soft-deleted (sets `is_active = false`).

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
is_published BOOLEAN, created_at, updated_at, created_by_user_id UUID FK→users
```
**car_status ENUM**: `available | reserved | rented | sold | maintenance`

### car_images
```sql
id UUID PK, car_id UUID FK→cars CASCADE, storage_path TEXT,
is_primary BOOLEAN, sort_order INT, created_at
UNIQUE (car_id, sort_order)
UNIQUE INDEX on (car_id) WHERE is_primary = true  -- enforces one primary per car
```

### rentals
```sql
id UUID PK, car_id UUID FK→cars RESTRICT, customer_id UUID FK→customers RESTRICT,
start_date DATE, end_date DATE, price_per_day NUMERIC(12,2), total_price NUMERIC(12,2),
deposit_amount NUMERIC(12,2), currency_code CHAR(3), status rental_status,
cancelled_reason TEXT, created_at, updated_at, created_by_user_id UUID FK→users
CONSTRAINT check_dates: end_date >= start_date
```
**rental_status ENUM**: `pending | confirmed | active | completed | cancelled`

### purchases
```sql
id UUID PK, car_id UUID FK→cars RESTRICT, customer_id UUID FK→customers RESTRICT,
sale_price NUMERIC(12,2), currency_code CHAR(3), status purchase_status,
created_at, updated_at, created_by_user_id UUID FK→users
UNIQUE INDEX on (car_id) WHERE status = 'paid'  -- one paid purchase per car
```
**purchase_status ENUM**: `pending | paid | cancelled | refunded`

### session
```sql
sid VARCHAR PK, sess JSON, expire TIMESTAMPTZ
```
Managed automatically by connect-pg-simple.

---

## Authentication Flow

1. `POST /auth/login` with `{ email, password }` (rate limited: 10/15min)
2. Passport LocalStrategy verifies email → bcrypt compare
3. On success: session created in PostgreSQL `session` table, HttpOnly cookie sent
4. All subsequent requests carry cookie → `req.isAuthenticated()` returns true
5. `passport.deserializeUser` loads user from DB on each request
6. `POST /auth/logout` destroys session

**Middleware chain for protected routes**:
```
isAuthenticated → (isAdmin | isAdminOrEmployee) → route handler
```

---

## API Endpoints

### Authentication (Public)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /auth/login | Public | Login, returns session cookie |
| POST | /auth/logout | Authenticated | Destroy session |
| GET | /auth/me | Authenticated | Get current user info |

### Public Cars

| Method | Path | Access | Description |
|---|---|---|---|
| GET | /cars | Public | List published cars (with images) |
| GET | /cars/:id | Public | Get car by ID (with images) |

Query params for `GET /cars`: `brand`, `model`, `year_min`, `year_max`, `price_min`, `price_max`, `rent_price_min`, `rent_price_max`, `limit` (default 20), `offset` (default 0)

### User Management

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /admin/users | Admin | Create employee user |
| GET | /admin/users | Admin | List users (`?role=`, `?is_active=`) |
| GET | /admin/users/:id | Admin | Get user by ID |
| PATCH | /admin/users/:id | Admin | Update full_name, is_active |
| DELETE | /admin/users/:id | Admin | Soft-delete (cannot delete admin) |

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
| GET | /admin/cars | Admin+Employee | List all cars (`?limit=`, `?offset=`) |
| GET | /admin/cars/:id | Admin+Employee | Get by ID (with images) |
| PATCH | /admin/cars/:id | Admin+Employee | Update car |
| DELETE | /admin/cars/:id | Admin+Employee | Delete (blocked if has rentals/purchases) |
| PATCH | /admin/cars/:id/publish | Admin+Employee | `{ is_published: true|false }` |
| POST | /admin/cars/:id/images | Admin+Employee | Add image `{ storage_path, is_primary, sort_order }` |

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

---

## Business Rules

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

### Car Availability
- **For rent**: `cars.status = 'available'` AND no overlapping rentals
- **For purchase**: `cars.status = 'available'` (strictly, not rented/sold/maintenance)

### Price Snapshotting
Prices copied at transaction time:
- Rental: `cars.rent_price_per_day` → `rentals.price_per_day`
- Purchase: `cars.sale_price` → `purchases.sale_price`

### User Management Rules
- Admin creates employees only (role fixed to `'employee'` in schema)
- Cannot delete admin account
- Deletion is soft (sets `is_active = false`)

---

## Standard Response Format

**Success**: HTTP 200/201 with JSON body
**Error**:
```json
{ "error": "Human-readable message", "code": "MACHINE_CODE", "details": {} }
```

Common HTTP codes used:
- `400` Bad Request / validation error
- `401` Unauthorized (not logged in)
- `403` Forbidden (wrong role)
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
# Edit .env with your DATABASE_URL

# 4. Run migrations
npm run migrate

# 5. Seed admin user
npm run seed

# 6. Start dev server
npm run dev
# API available at http://localhost:5000
```

---

## Adding New Features

1. Add Zod schema to `src/validation/schemas.ts`
2. Add TypeScript type to `src/types/models.ts` if new entity
3. Add repository methods to `src/db/repositories/`
4. Create route file in `src/routes/`
5. Mount route in `src/app.ts`
6. If new table: add migration to `src/db/migrations/` (next number in sequence)

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
