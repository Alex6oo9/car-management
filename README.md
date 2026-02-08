# Car Showroom Management System

A backend REST API for managing a car showroom with rental and purchase capabilities.

## Features

- **Role-based access control** — Admin and Employee roles with distinct permissions
- **Car inventory management** — Full CRUD with image management and publish/unpublish
- **Rental system** — Date overlap detection, status workflow, price snapshotting
- **Purchase system** — Atomic transactions that mark cars as sold
- **Session-based authentication** — Passport.js with PostgreSQL session storage
- **Public car listing** — Unauthenticated endpoint for browsing available cars

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript (strict, ES modules)
- **Framework**: Express.js v5
- **Database**: PostgreSQL 14+ with raw SQL (no ORM)
- **Auth**: Passport.js local strategy + express-session + connect-pg-simple
- **Validation**: Zod
- **Security**: Helmet, CORS, bcrypt, express-rate-limit

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd car-showroom-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/car_showroom
SESSION_SECRET=your-secret-at-least-16-chars
CORS_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=development
```

### 3. Create the database

```sql
CREATE DATABASE car_showroom;
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. Seed the admin user

```bash
npm run seed
```

Creates: `admin@example.com` / `admin123`

### 6. Start the server

```bash
npm run dev       # development with hot reload
npm run build     # compile TypeScript
npm start         # run compiled output
```

API available at `http://localhost:5000`

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Login with email + password |
| POST | `/auth/logout` | Required | Destroy session |
| GET | `/auth/me` | Required | Get current user |

### Public

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/cars` | Public | List published cars (filterable) |
| GET | `/cars/:id` | Public | Get car details with images |

### Users *(Admin only)*

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/users` | Create employee |
| GET | `/admin/users` | List users |
| GET | `/admin/users/:id` | Get user |
| PATCH | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Soft-delete employee |

### Customers

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/customers` | Create customer |
| GET | `/admin/customers` | List / search customers |
| GET | `/admin/customers/:id` | Get customer |
| PATCH | `/admin/customers/:id` | Update customer |

### Cars

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/cars` | Create car |
| GET | `/admin/cars` | List all cars |
| GET | `/admin/cars/:id` | Get car |
| PATCH | `/admin/cars/:id` | Update car |
| DELETE | `/admin/cars/:id` | Delete car |
| PATCH | `/admin/cars/:id/publish` | Publish / unpublish |
| POST | `/admin/cars/:id/images` | Add image |

### Rentals

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/rentals` | Create rental (checks overlap) |
| GET | `/admin/rentals` | List rentals |
| GET | `/admin/rentals/:id` | Get rental |
| PATCH | `/admin/rentals/:id/status` | Update status |

**Status flow:** `pending` → `confirmed` → `active` → `completed` / `cancelled`

### Purchases

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/purchases` | Create purchase |
| GET | `/admin/purchases` | List purchases |
| GET | `/admin/purchases/:id` | Get purchase |
| PATCH | `/admin/purchases/:id/status` | Update status |

**Status flow:** `pending` → `paid` (marks car sold) / `cancelled`

---

## Key Business Rules

- **Rental overlap detection** — end date is inclusive; blocks double-booking
- **Atomic purchase** — marking a purchase `paid` sets `cars.status = 'sold'` in one transaction
- **Price snapshotting** — rental/purchase prices captured at creation time
- **Car availability** — sold/maintenance cars cannot be rented or purchased
- **Admin protection** — admin account cannot be deleted; employees have no access to `/admin/users`

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
│   ├── migrations/        # SQL migration files (001–007)
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

A Postman collection (`CarShowroom.postman_collection.json`) is included with 54 requests covering the full API including business rule validations.

Import into Postman and run folders in order. IDs are auto-saved as collection variables between requests.
