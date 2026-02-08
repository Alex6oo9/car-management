# SPEC.md - Car Showroom Management System MVP

> **Purpose**: Complete specification for implementing a minimal viable product (MVP) of a car showroom management system with rental and purchase capabilities.

---

## Project Overview

**Project Name**: Car Showroom Management System (MVP)
**Type**: Backend REST API  
**Purpose**: Manage a car showroom where customers can rent or buy vehicles  
**Authentication**: Passport.js Local Strategy with session-based auth  
**Database**: PostgreSQL with raw SQL queries (no ORM)  
**Framework**: Node.js + Express.js + TypeScript  
**Testing**: Fully testable with Postman

### Key Requirements
- **Admin Role**: Full CRUD access to all resources (cars, rentals, purchases, customers) + exclusive user management (add/delete employees)
- **Employee Role**: CRUD access to cars, rentals, purchases, customers BUT **NO access to users table**
- **Session-Based Auth**: Passport.js with PostgreSQL session storage
- **Security**: Bcrypt password hashing, input validation, CORS, rate limiting
- **MVP-Ready**: Fully functional API endpoints ready for Postman testing

---

## Tech Stack

### Core
- **Runtime**: Node.js 20+ with TypeScript (ES modules, strict mode)
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Database Client**: `pg` library (raw SQL with parameterized queries)

### Authentication & Security
- **Auth**: Passport.js with passport-local strategy
- **Sessions**: express-session + connect-pg-simple
- **Password Hashing**: bcrypt (10 rounds)
- **Security Headers**: Helmet
- **CORS**: cors middleware
- **Rate Limiting**: express-rate-limit
- **Input Validation**: Zod

### Development Tools
- **TypeScript**: Strict mode enabled
- **Dev Server**: tsx (for development)
- **Logging**: Pino + pino-http (optional but recommended)

---

## Database Schema

### 1. users (employees and admins)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Critical Rules**:
- Only ONE admin account (seed this on first setup)
- Admin can create/delete employees
- Employees cannot modify users table
- Email must be unique and valid

---

### 2. customers (buyers and renters)
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address_line TEXT,
    city TEXT,
    country TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_contact_method CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
```

**Critical Rules**:
- Must have at least one contact method (phone OR email)
- Separate from users table (customers do not log in)

---

### 3. cars (inventory)
```sql
CREATE TYPE car_status AS ENUM ('available', 'reserved', 'rented', 'sold', 'maintenance');

CREATE TABLE cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vin TEXT UNIQUE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM now()) + 1),
    mileage_km INTEGER DEFAULT 0 CHECK (mileage_km >= 0),
    sale_price NUMERIC(12, 2) CHECK (sale_price >= 0),
    rent_price_per_day NUMERIC(12, 2) CHECK (rent_price_per_day >= 0),
    currency_code CHAR(3) DEFAULT 'THB',
    status car_status DEFAULT 'available',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_cars_status ON cars(status);
CREATE INDEX idx_cars_brand_model ON cars(brand, model);
CREATE INDEX idx_cars_is_published ON cars(is_published);
```

**Status Rules**:
- `available`: Ready for rent or sale
- `reserved`: Reserved by customer (not implemented in MVP, future feature)
- `rented`: Currently rented out
- `sold`: Sold, cannot be rented or sold again
- `maintenance`: In maintenance, cannot be rented or sold

---

### 4. car_images
```sql
CREATE TABLE car_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (car_id, sort_order)
);

CREATE INDEX idx_car_images_car_id ON car_images(car_id);
CREATE UNIQUE INDEX idx_car_primary_image ON car_images(car_id) WHERE is_primary = true;
```

**Critical Rules**:
- Only ONE primary image per car (enforced by unique index)
- Images cascade delete when car is deleted
- Sort order must be unique per car

---

### 5. rentals
```sql
CREATE TYPE rental_status AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled');

CREATE TABLE rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_day NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    deposit_amount NUMERIC(12, 2) DEFAULT 0,
    currency_code CHAR(3) DEFAULT 'THB',
    status rental_status DEFAULT 'pending',
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_rentals_car_id ON rentals(car_id);
CREATE INDEX idx_rentals_customer_id ON rentals(customer_id);
CREATE INDEX idx_rentals_dates ON rentals(start_date, end_date);
CREATE INDEX idx_rentals_status ON rentals(status);
```

**Critical Rules**:
- **end_date is INCLUSIVE** (car is booked through end_date)
- Snapshot `cars.rent_price_per_day` to `rentals.price_per_day` at booking time
- Calculate `total_price = ((end_date - start_date) + 1) * price_per_day`
- Before creating rental, check for date overlaps and car availability

**Status Workflow**:
- `pending`: Initial state, awaiting confirmation
- `confirmed`: Booking confirmed, payment received (deposit)
- `active`: Customer has picked up the car
- `completed`: Car returned successfully
- `cancelled`: Booking cancelled

---

### 6. purchases
```sql
CREATE TYPE purchase_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');

CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_price NUMERIC(12, 2) NOT NULL,
    currency_code CHAR(3) DEFAULT 'THB',
    status purchase_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_purchases_car_id ON purchases(car_id);
CREATE INDEX idx_purchases_customer_id ON purchases(customer_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE UNIQUE INDEX idx_purchases_paid_car ON purchases(car_id) WHERE status = 'paid';
```

**Critical Rules**:
- Only ONE `paid` purchase per car (enforced by unique index)
- Snapshot `cars.sale_price` to `purchases.sale_price` at purchase time
- When status becomes `paid`, update `cars.status = 'sold'` (use transaction)
- Sold cars cannot be rented or purchased again

---

### 7. session (for Passport.js)
```sql
CREATE TABLE session (
    sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX idx_session_expire ON session(expire);
```

---

## Authentication & Authorization

### Authentication Flow
1. User submits email/password to `POST /auth/login`
2. Passport verifies credentials against `users` table
3. On success, session created in PostgreSQL `session` table
4. Session cookie (HttpOnly, SameSite) sent to client
5. Subsequent requests include session cookie
6. Middleware checks session validity and attaches `req.user`

### Authorization Rules

#### Admin Permissions
- ✅ Full CRUD on **cars**
- ✅ Full CRUD on **rentals**
- ✅ Full CRUD on **purchases**
- ✅ Full CRUD on **customers**
- ✅ Full CRUD on **users** (can add/delete employees)
- ✅ View all endpoints

#### Employee Permissions
- ✅ Full CRUD on **cars**
- ✅ Full CRUD on **rentals**
- ✅ Full CRUD on **purchases**
- ✅ Full CRUD on **customers**
- ❌ **NO ACCESS to users endpoints**

### Middleware Implementation
```typescript
// Check if user is authenticated
export const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
};

// Check if user is admin
export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
};

// Check if user is admin or employee
export const isAdminOrEmployee = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'employee')) {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden: Employee access required' });
};
```

---

## API Endpoints

### Authentication Endpoints (Public)

#### POST /auth/login
**Description**: Authenticate user and create session  
**Access**: Public  
**Body**:
```json
{
    "email": "admin@example.com",
    "password": "admin123"
}
```
**Response 200**:
```json
{
    "message": "Login successful",
    "user": {
        "id": "uuid",
        "email": "admin@example.com",
        "full_name": "System Admin",
        "role": "admin"
    }
}
```
**Response 401**: Invalid credentials

---

#### POST /auth/logout
**Description**: Destroy session and log out  
**Access**: Authenticated users  
**Response 200**:
```json
{
    "message": "Logout successful"
}
```

---

#### GET /auth/me
**Description**: Get current authenticated user  
**Access**: Authenticated users  
**Response 200**:
```json
{
    "id": "uuid",
    "email": "admin@example.com",
    "full_name": "System Admin",
    "role": "admin",
    "is_active": true
}
```

---

### User Management Endpoints (Admin Only)

#### POST /admin/users
**Description**: Create new employee user  
**Access**: Admin only  
**Body**:
```json
{
    "email": "employee@example.com",
    "password": "password123",
    "full_name": "John Doe",
    "role": "employee"
}
```
**Validation**:
- Email must be valid and unique
- Password minimum 8 characters
- Role must be 'employee' (admin cannot create another admin via API)
- Full name required

**Response 201**:
```json
{
    "id": "uuid",
    "email": "employee@example.com",
    "full_name": "John Doe",
    "role": "employee",
    "is_active": true,
    "created_at": "2026-02-08T09:00:00Z"
}
```

---

#### GET /admin/users
**Description**: List all users  
**Access**: Admin only  
**Query Params**:
- `role`: Filter by role (admin/employee)
- `is_active`: Filter by active status

**Response 200**:
```json
{
    "users": [
        {
            "id": "uuid",
            "email": "admin@example.com",
            "full_name": "System Admin",
            "role": "admin",
            "is_active": true,
            "created_at": "2026-01-01T00:00:00Z"
        }
    ],
    "total": 1
}
```

---

#### GET /admin/users/:id
**Description**: Get user by ID  
**Access**: Admin only  
**Response 200**: Same as POST response

---

#### PATCH /admin/users/:id
**Description**: Update user details  
**Access**: Admin only  
**Body**:
```json
{
    "full_name": "Updated Name",
    "is_active": false
}
```
**Response 200**: Updated user object

---

#### DELETE /admin/users/:id
**Description**: Delete employee (soft delete by setting is_active = false)  
**Access**: Admin only  
**Business Rule**: Cannot delete the admin account  
**Response 200**:
```json
{
    "message": "User deleted successfully"
}
```

---

### Customer Endpoints (Admin & Employee)

#### POST /admin/customers
**Description**: Create new customer  
**Access**: Admin & Employee  
**Body**:
```json
{
    "full_name": "Jane Smith",
    "phone": "+66123456789",
    "email": "jane@example.com",
    "address_line": "123 Main St",
    "city": "Bangkok",
    "country": "Thailand"
}
```
**Validation**:
- Must have at least one: phone OR email
- Full name required

**Response 201**: Created customer object

---

#### GET /admin/customers
**Description**: List all customers with search  
**Access**: Admin & Employee  
**Query Params**:
- `search`: Search by name, phone, or email
- `limit`: Pagination limit (default 50)
- `offset`: Pagination offset (default 0)

**Response 200**:
```json
{
    "customers": [...],
    "total": 100
}
```

---

#### GET /admin/customers/:id
**Description**: Get customer by ID  
**Access**: Admin & Employee  
**Response 200**: Customer object

---

#### PATCH /admin/customers/:id
**Description**: Update customer  
**Access**: Admin & Employee  
**Body**: Same as create (partial allowed)  
**Response 200**: Updated customer object

---

### Car Endpoints

#### GET /cars (Public)
**Description**: List published cars  
**Access**: Public (no authentication)  
**Query Params**:
- `brand`: Filter by brand
- `model`: Filter by model
- `year_min`, `year_max`: Filter by year range
- `price_min`, `price_max`: Filter by sale price range
- `rent_price_min`, `rent_price_max`: Filter by rent price range
- `limit`: Pagination (default 20)
- `offset`: Pagination (default 0)

**Response 200**:
```json
{
    "cars": [
        {
            "id": "uuid",
            "vin": "ABC123",
            "brand": "Toyota",
            "model": "Camry",
            "year": 2020,
            "mileage_km": 50000,
            "sale_price": 500000.00,
            "rent_price_per_day": 1500.00,
            "currency_code": "THB",
            "status": "available",
            "images": [
                {
                    "storage_path": "/uploads/car1.jpg",
                    "is_primary": true
                }
            ]
        }
    ],
    "total": 10
}
```

---

#### GET /cars/:id (Public)
**Description**: Get car details with images  
**Access**: Public  
**Response 200**: Single car object with images array

---

#### POST /admin/cars
**Description**: Create new car  
**Access**: Admin & Employee  
**Body**:
```json
{
    "vin": "ABC123",
    "brand": "Toyota",
    "model": "Camry",
    "year": 2020,
    "mileage_km": 50000,
    "sale_price": 500000.00,
    "rent_price_per_day": 1500.00,
    "currency_code": "THB",
    "status": "available",
    "is_published": false
}
```
**Validation**:
- Brand, model, year required
- Year must be between 1900 and current year + 1
- Prices must be >= 0
- VIN optional but unique if provided

**Response 201**: Created car object

---

#### PATCH /admin/cars/:id
**Description**: Update car  
**Access**: Admin & Employee  
**Body**: Same as create (partial allowed)  
**Response 200**: Updated car object

---

#### DELETE /admin/cars/:id
**Description**: Delete car  
**Access**: Admin & Employee  
**Business Rule**: Cannot delete if car has rentals or purchases  
**Response 200**:
```json
{
    "message": "Car deleted successfully"
}
```

---

#### POST /admin/cars/:id/images
**Description**: Add image to car  
**Access**: Admin & Employee  
**Body**:
```json
{
    "storage_path": "/uploads/car1.jpg",
    "is_primary": false,
    "sort_order": 1
}
```
**Response 201**: Created image object

---

#### PATCH /admin/cars/:id/publish
**Description**: Publish or unpublish car  
**Access**: Admin & Employee  
**Body**:
```json
{
    "is_published": true
}
```
**Response 200**: Updated car object

---

### Rental Endpoints (Admin & Employee)

#### POST /admin/rentals
**Description**: Create new rental with availability check  
**Access**: Admin & Employee  
**Body**:
```json
{
    "car_id": "uuid",
    "customer_id": "uuid",
    "start_date": "2026-03-01",
    "end_date": "2026-03-07",
    "deposit_amount": 5000.00
}
```

**Business Logic**:
1. Validate car exists and status is 'available' (not 'sold', 'maintenance')
2. Check date overlap with existing rentals (see overlap formula below)
3. Snapshot `cars.rent_price_per_day` to `rentals.price_per_day`
4. Calculate days: `(end_date - start_date) + 1` (inclusive)
5. Calculate `total_price = days * price_per_day`
6. Create rental with status 'pending'

**Overlap Check** (block if any rental matches):
```sql
SELECT id FROM rentals
WHERE car_id = $1
  AND status IN ('pending', 'confirmed', 'active')
  AND start_date <= $3  -- new end_date
  AND end_date >= $2    -- new start_date
```

**Response 201**: Created rental object  
**Response 409**: Car not available for those dates

---

#### GET /admin/rentals
**Description**: List all rentals  
**Access**: Admin & Employee  
**Query Params**:
- `car_id`: Filter by car
- `customer_id`: Filter by customer
- `status`: Filter by status
- `start_date_from`, `start_date_to`: Filter by start date range

**Response 200**: Array of rentals with car and customer info

---

#### GET /admin/rentals/:id
**Description**: Get rental by ID  
**Access**: Admin & Employee  
**Response 200**: Rental object with car and customer details

---

#### PATCH /admin/rentals/:id/status
**Description**: Update rental status  
**Access**: Admin & Employee  
**Body**:
```json
{
    "status": "confirmed",
    "cancelled_reason": "Optional, only if cancelling"
}
```

**Status Transition Rules**:
- `pending` → `confirmed`, `cancelled`
- `confirmed` → `active`, `cancelled`
- `active` → `completed`, `cancelled`
- `completed` → (final state)
- `cancelled` → (final state)

**Side Effects**:
- When status becomes 'active': update `cars.status = 'rented'`
- When status becomes 'completed' or 'cancelled': update `cars.status = 'available'`

**Response 200**: Updated rental object

---

### Purchase Endpoints (Admin & Employee)

#### POST /admin/purchases
**Description**: Create new purchase  
**Access**: Admin & Employee  
**Body**:
```json
{
    "car_id": "uuid",
    "customer_id": "uuid"
}
```

**Business Logic**:
1. Validate car exists and status is 'available' (not 'sold', 'rented', 'maintenance')
2. Snapshot `cars.sale_price` to `purchases.sale_price`
3. Create purchase with status 'pending'

**Response 201**: Created purchase object  
**Response 400**: Car is not available for purchase

---

#### GET /admin/purchases
**Description**: List all purchases  
**Access**: Admin & Employee  
**Query Params**:
- `car_id`: Filter by car
- `customer_id`: Filter by customer
- `status`: Filter by status

**Response 200**: Array of purchases with car and customer info

---

#### GET /admin/purchases/:id
**Description**: Get purchase by ID  
**Access**: Admin & Employee  
**Response 200**: Purchase object with car and customer details

---

#### PATCH /admin/purchases/:id/status
**Description**: Update purchase status  
**Access**: Admin & Employee  
**Body**:
```json
{
    "status": "paid"
}
```

**Status Transition Rules**:
- `pending` → `paid`, `cancelled`
- `paid` → `refunded` (admin only, future feature)
- `cancelled` → (final state)

**CRITICAL: Use Database Transaction**  
When status becomes 'paid':
```typescript
BEGIN;
  UPDATE purchases SET status = 'paid' WHERE id = $1;
  UPDATE cars SET status = 'sold' WHERE id = $2;
COMMIT;
```

**Response 200**: Updated purchase object  
**Response 409**: Car already sold (constraint violation)

---

## Business Logic & Rules

### Date Overlap Logic (Rentals)
**CRITICAL**: `end_date` is **INCLUSIVE**

Two rentals overlap if:
```
new_start <= existing_end AND new_end >= existing_start
```

Example:
- Existing rental: 2026-03-01 to 2026-03-07
- New rental: 2026-03-05 to 2026-03-10
- Result: **OVERLAP** (block new rental)

- Existing rental: 2026-03-01 to 2026-03-07
- New rental: 2026-03-08 to 2026-03-10
- Result: **NO OVERLAP** (allow new rental)

### Car Availability Rules
A car is available for rent if:
1. `cars.status = 'available'` (not 'sold', 'maintenance')
2. No overlapping rentals with status in ('pending', 'confirmed', 'active')

A car is available for purchase if:
1. `cars.status = 'available'` (not 'sold', 'rented', 'maintenance')
2. No active rentals

### Price Snapshotting
Always copy prices from `cars` to `rentals`/`purchases` at transaction time:
- Rental: Copy `cars.rent_price_per_day` → `rentals.price_per_day`
- Purchase: Copy `cars.sale_price` → `purchases.sale_price`

This preserves historical accuracy if prices change later.

### Transaction Requirements
Use PostgreSQL transactions for:
1. **Purchase paid**: Update purchase status AND car status atomically
2. **Rental status changes**: Update rental status AND car status atomically

---

## Project Structure

```
car-showroom-api/
├── src/
│   ├── server.ts                      # Entry point
│   ├── app.ts                         # Express app factory
│   ├── config/
│   │   └── env.ts                     # Environment validation (Zod)
│   ├── db/
│   │   ├── pool.ts                    # PostgreSQL connection pool
│   │   ├── migrations/
│   │   │   ├── 001_create_users.sql
│   │   │   ├── 002_create_customers.sql
│   │   │   ├── 003_create_cars.sql
│   │   │   ├── 004_create_car_images.sql
│   │   │   ├── 005_create_rentals.sql
│   │   │   ├── 006_create_purchases.sql
│   │   │   └── 007_create_session.sql
│   │   ├── seeds/
│   │   │   └── admin.seed.ts          # Create initial admin user
│   │   └── repositories/
│   │       ├── users.repo.ts
│   │       ├── customers.repo.ts
│   │       ├── cars.repo.ts
│   │       ├── rentals.repo.ts
│   │       └── purchases.repo.ts
│   ├── auth/
│   │   ├── passport.ts                # Passport local strategy config
│   │   ├── session.ts                 # Session config
│   │   └── middleware.ts              # Auth middleware (isAuthenticated, isAdmin, etc.)
│   ├── middleware/
│   │   ├── cors.ts                    # CORS configuration
│   │   ├── errorHandler.ts            # Global error handler
│   │   ├── helmet.ts                  # Security headers
│   │   ├── rateLimit.ts               # Rate limiting
│   │   └── validate.ts                # Zod validation middleware
│   ├── routes/
│   │   ├── auth.routes.ts             # Auth endpoints
│   │   ├── admin.users.routes.ts      # User management (admin only)
│   │   ├── admin.customers.routes.ts  # Customer endpoints
│   │   ├── admin.cars.routes.ts       # Car admin endpoints
│   │   ├── admin.rentals.routes.ts    # Rental endpoints
│   │   ├── admin.purchases.routes.ts  # Purchase endpoints
│   │   └── public.cars.routes.ts      # Public car listing
│   ├── validation/
│   │   └── schemas.ts                 # All Zod schemas
│   ├── types/
│   │   ├── express.d.ts               # Express type extensions
│   │   └── models.ts                  # Database model types
│   └── utils/
│       └── logger.ts                  # Pino logger (optional)
├── .env                               # Environment variables
├── .env.example                       # Example environment file
├── package.json
├── tsconfig.json
└── README.md
```

---

## Environment Variables

### Required (.env file)
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/car_showroom

# Session
SESSION_SECRET=your-32-char-secret-key-change-this-in-production

# CORS
CORS_ORIGIN=http://localhost:3000

# Server
PORT=5000
NODE_ENV=development
```

---

## Implementation Steps for Claude Code

### Phase 1: Project Setup
1. Initialize Node.js + TypeScript project
2. Install dependencies:
```bash
npm init -y
npm install express passport passport-local express-session connect-pg-simple pg bcrypt cors helmet express-rate-limit zod pino pino-http
npm install -D typescript @types/node @types/express @types/passport @types/passport-local @types/express-session @types/bcrypt @types/cors tsx
```
3. Configure TypeScript (strict mode)
4. Set up project structure (folders and files)

### Phase 2: Database Setup
1. Create database schema migration files
2. Implement `pool.ts` for PostgreSQL connection
3. Create seed script for admin user
4. Write all repository files with CRUD operations

### Phase 3: Authentication
1. Implement Passport.js local strategy
2. Configure express-session with PostgreSQL storage
3. Create auth middleware (isAuthenticated, isAdmin, isAdminOrEmployee)
4. Implement auth routes (login, logout, me)

### Phase 4: Core Features
1. **Users Module** (admin only):
   - Repository: CRUD operations
   - Routes: POST, GET, PATCH, DELETE /admin/users
   - Validation: Zod schemas

2. **Customers Module**:
   - Repository: CRUD with search
   - Routes: POST, GET, PATCH /admin/customers
   - Validation: At least one contact method

3. **Cars Module**:
   - Repository: CRUD with filters and images
   - Public routes: GET /cars, GET /cars/:id
   - Admin routes: POST, PATCH, DELETE /admin/cars
   - Image management: POST /admin/cars/:id/images

4. **Rentals Module**:
   - Repository: CRUD with overlap checking
   - Routes: POST, GET, PATCH /admin/rentals
   - Business logic: Availability service, date calculations
   - Status transitions: Update car status accordingly

5. **Purchases Module**:
   - Repository: CRUD with transaction support
   - Routes: POST, GET, PATCH /admin/purchases
   - Business logic: Mark car as sold atomically

### Phase 5: Security & Validation
1. Implement Helmet security headers
2. Configure CORS
3. Add rate limiting to login endpoint
4. Create Zod validation middleware
5. Global error handler

### Phase 6: Testing Preparation
1. Create comprehensive Postman collection
2. Document all endpoints with example requests
3. Test scenarios:
   - Admin user management
   - Employee cannot access user endpoints
   - Rental date overlap detection
   - Purchase marks car as sold
   - Status transition workflows

---

## Validation Schemas (Zod)

### User Schemas
```typescript
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(['employee']) // Admin creates employees only
});

const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  is_active: z.boolean().optional()
});
```

### Customer Schemas
```typescript
const createCustomerSchema = z.object({
  full_name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address_line: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional()
}).refine(data => data.phone || data.email, {
  message: "At least one contact method (phone or email) is required"
});
```

### Car Schemas
```typescript
const createCarSchema = z.object({
  vin: z.string().optional(),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  mileage_km: z.number().int().min(0).optional(),
  sale_price: z.number().min(0).optional(),
  rent_price_per_day: z.number().min(0).optional(),
  currency_code: z.string().length(3).default('THB'),
  status: z.enum(['available', 'reserved', 'rented', 'sold', 'maintenance']).default('available'),
  is_published: z.boolean().default(false)
});
```

### Rental Schemas
```typescript
const createRentalSchema = z.object({
  car_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  start_date: z.string().date(), // YYYY-MM-DD
  end_date: z.string().date(),
  deposit_amount: z.number().min(0).optional()
}).refine(data => {
  return new Date(data.end_date) >= new Date(data.start_date);
}, {
  message: "end_date must be >= start_date"
});

const updateRentalStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'active', 'completed', 'cancelled']),
  cancelled_reason: z.string().optional()
});
```

### Purchase Schemas
```typescript
const createPurchaseSchema = z.object({
  car_id: z.string().uuid(),
  customer_id: z.string().uuid()
});

const updatePurchaseStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'cancelled', 'refunded'])
});
```

---

## Testing Requirements

### Postman Collection Structure
```
Car Showroom API/
├── Authentication/
│   ├── Login as Admin
│   ├── Login as Employee
│   ├── Get Current User
│   └── Logout
├── User Management (Admin Only)/
│   ├── Create Employee
│   ├── List Users
│   ├── Get User
│   ├── Update User
│   └── Delete Employee
├── Customers/
│   ├── Create Customer
│   ├── List Customers
│   ├── Get Customer
│   └── Update Customer
├── Cars (Public)/
│   ├── List Published Cars
│   └── Get Car Details
├── Cars (Admin)/
│   ├── Create Car
│   ├── List All Cars
│   ├── Update Car
│   ├── Publish Car
│   ├── Add Car Image
│   └── Delete Car
├── Rentals/
│   ├── Create Rental
│   ├── List Rentals
│   ├── Get Rental
│   └── Update Rental Status
└── Purchases/
    ├── Create Purchase
    ├── List Purchases
    ├── Get Purchase
    └── Mark as Paid (Marks Car Sold)
```

### Test Scenarios to Verify
1. ✅ Admin can create/delete employees
2. ✅ Employee cannot access /admin/users endpoints (403)
3. ✅ Employee can CRUD cars, rentals, purchases, customers
4. ✅ Rental date overlap is detected (409)
5. ✅ Purchase status 'paid' marks car as 'sold'
6. ✅ Cannot rent a sold car (400)
7. ✅ Cannot buy a sold car (400)
8. ✅ Rental price is snapshot at booking time
9. ✅ Total price calculated correctly (inclusive dates)
10. ✅ Public car endpoint only shows published cars

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}  // Optional additional details
}
```

### HTTP Status Codes
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized (wrong role)
- `404 Not Found`: Resource not found
- `409 Conflict`: Business rule violation (e.g., date overlap)
- `500 Internal Server Error`: Server error

---

## Security Checklist

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ HttpOnly session cookies
- ✅ SameSite cookie attribute
- ✅ CORS configured for specific origins
- ✅ Helmet security headers
- ✅ Rate limiting on login endpoint (10 attempts per 15 minutes)
- ✅ Input validation with Zod
- ✅ Parameterized SQL queries (no SQL injection)
- ✅ No sensitive data in error messages
- ✅ Admin account seeded securely (change password on first setup)

---

## Deliverables for Claude Code

The implementation must produce:

1. ✅ **Fully functional Express.js API** with all endpoints working
2. ✅ **PostgreSQL database** with all schemas created
3. ✅ **Seed script** that creates admin user (email: admin@example.com, password: admin123)
4. ✅ **Postman collection** with all endpoints organized and tested
5. ✅ **README.md** with setup instructions and API documentation
6. ✅ **Environment setup** (.env.example file)
7. ✅ **TypeScript compilation** with no errors
8. ✅ **All business rules implemented**:
   - Rental date overlap detection
   - Purchase atomically marks car sold
   - Admin-only user management
   - Employee blocked from users endpoints
   - Status transitions with side effects

---

## Success Criteria

The MVP is considered complete when:

1. ✅ Admin can log in and access all endpoints
2. ✅ Admin can create employee accounts
3. ✅ Employee can log in and CRUD cars/rentals/purchases/customers
4. ✅ Employee receives 403 when trying to access /admin/users
5. ✅ Public can view published cars without authentication
6. ✅ Rental creation blocks overlapping dates
7. ✅ Purchase 'paid' status marks car as sold and blocks new rentals/purchases
8. ✅ All endpoints testable via Postman with clear responses
9. ✅ No TypeScript or runtime errors
10. ✅ All database constraints enforced (unique indexes, FKs, checks)

---

**Last Updated**: 2026-02-08  
**Version**: 1.0.0 (MVP)  
**Status**: Ready for Implementation by Claude Code
