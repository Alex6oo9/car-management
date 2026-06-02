# Database Design — Car Showroom Management System

> Written for junior developers. No SQL expertise required to understand this document.

---

## 1. What Is the Database Doing?

Think of the database as a filing cabinet for the whole car showroom. Every car on the lot, every
customer who walked in, every rental agreement, every purchase — all of it lives here, organized
into separate drawers called **tables**.

The database we use is **PostgreSQL**, a battle-tested relational database. "Relational" means
the tables know about each other — a rental record knows which car it's for and which customer
made it, because it stores references (called **foreign keys**) to those other tables.

---

## 2. How to Read This Document

Before diving into each table, here are the conventions used everywhere:

**UUIDs** — Every row in every table has an `id` that looks like `a3f2c1b4-...`. This is a
UUID (Universally Unique Identifier). Unlike a simple number (1, 2, 3…), UUIDs are globally
unique — no two rows anywhere will ever share the same one. PostgreSQL generates them
automatically with `gen_random_uuid()`.

**`NOT NULL`** — This column must always have a value. The database will reject a row that
tries to leave it empty.

**`DEFAULT`** — If you don't provide a value for this column, the database fills it in
automatically. For example, `status DEFAULT 'available'` means a new car starts as available
unless you say otherwise.

**`FK → table`** — Foreign Key. This column stores the `id` of a row in another table.
Think of it as a hyperlink between rows.

**`ON DELETE CASCADE`** — If the parent row is deleted, all rows that reference it are
deleted too. Example: delete a car → all its images are deleted.

**`ON DELETE RESTRICT`** — If the parent row has children, it cannot be deleted. You must
handle the children first. Example: you can't delete a car that has rentals on record.

**`ON DELETE SET NULL`** — If the parent row is deleted, the reference column becomes NULL
(empty). Example: if the user who created a car is deleted, the car still exists but
`created_by_user_id` becomes NULL.

**`TIMESTAMPTZ`** — Timestamp with timezone. Always stored in UTC, displayed in the
server's timezone. All `created_at` and `updated_at` columns use this.

---

## 3. The Tables

There are **13 tables** in this database. Here's a quick map:

```
users ─────────────────────── people who operate the system (admin, employee, client)
email_verification_tokens ─── temporary tokens to verify a user's email address
password_reset_tokens ──────── temporary tokens to reset a forgotten password
customers ──────────────────── people who buy or rent cars
cars ───────────────────────── the vehicles in the showroom
car_images ─────────────────── photos of each car (stored on Cloudinary, URL saved here)
car_documents ──────────────── extra info fields attached to a car (e.g. registration no.)
rentals ────────────────────── car rental agreements
purchases ──────────────────── car purchase transactions
rental_terms ───────────────── terms and conditions shown to customers before renting
dealer_contacts ────────────── the showroom's contact details & opening hours (single row)
feedback ───────────────────── customer reviews/testimonials shown on the homepage
session ────────────────────── login sessions (managed automatically, you rarely touch this)
```

---

### Table: `users`

**What it stores**: The people who log into the admin panel or registered on the website.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `email` | TEXT UNIQUE NOT NULL | Login identifier, must be unique |
| `password_hash` | TEXT | bcrypt hash of the password. NULL for Google-login users |
| `full_name` | TEXT NOT NULL | Display name |
| `role` | TEXT NOT NULL | `'admin'`, `'employee'`, or `'client'` |
| `is_active` | BOOLEAN DEFAULT true | Set to false on soft-delete (employee ban) |
| `is_email_verified` | BOOLEAN DEFAULT false | Must be true before local login is allowed |
| `auth_provider` | TEXT DEFAULT `'local'` | `'local'` or `'google'` |
| `google_id` | TEXT | Google's user ID, only set for Google-login accounts |
| `line_contact` | TEXT | Optional LINE handle, editable via `PATCH /profile` |
| `phone` | TEXT | Optional phone number, editable via `PATCH /profile` |
| `created_at` | TIMESTAMPTZ | When the account was created |
| `updated_at` | TIMESTAMPTZ | Last time any field changed |

**Junior tip**: Why do we hash the password? We never store the real password. If the database
is ever leaked, an attacker only sees a hash like `$2b$10$...` — they can't reverse it back to
the original password. bcrypt makes this hash deliberately slow to crack.

**Roles explained**:
- `admin` — One account, seeded at setup. Has full access. Cannot be deleted.
- `employee` — Created by the admin. Works in the showroom dashboard.
- `client` — Self-registered from the public website. Can view cars, doesn't have dashboard access.

---

### Table: `email_verification_tokens`

**What it stores**: One-time-use tokens sent to a user's email to prove they own that address.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID FK → users CASCADE | Which user this token belongs to |
| `token_hash` | TEXT NOT NULL | SHA-256 hash of the raw token. Raw token is in the email only |
| `expires_at` | TIMESTAMPTZ | Token expires 24 hours after creation |
| `created_at` | TIMESTAMPTZ | When the token was issued |

**How it works**:
1. User registers → system creates a random token, hashes it (SHA-256), saves the hash here
2. Raw token is emailed as a link: `/auth/verify-email?token=RAW_TOKEN`
3. User clicks the link → system hashes the URL token and looks it up in this table
4. Match found + not expired → `users.is_email_verified` set to `true`, row deleted

**Junior tip**: We store only the hash, never the raw token. Even if someone reads the
database, they can't reconstruct the token to verify someone else's email.

---

### Table: `password_reset_tokens`

**What it stores**: One-time-use tokens for resetting a forgotten password.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID FK → users CASCADE | Which user requested the reset |
| `token_hash` | TEXT NOT NULL | SHA-256 hash of the raw token |
| `expires_at` | TIMESTAMPTZ | Token expires 1 hour after creation |
| `used` | BOOLEAN DEFAULT false | Marked true after the reset is completed (not deleted) |
| `created_at` | TIMESTAMPTZ | When the token was issued |

**Key difference from verification tokens**: These are marked `used = true` rather than deleted,
so there's an audit trail. If someone calls `/auth/forgot-password` again before using the
first token, the old unused token is deleted first so only one active token exists per user.

After a successful reset: user's password is updated, `is_email_verified` is set to `true`,
and **all active sessions for that user are destroyed** (security: no one stays logged in
with a compromised old password).

---

### Table: `customers`

**What it stores**: People who rent or buy cars — they are separate from system `users`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `full_name` | TEXT NOT NULL | Customer's name |
| `phone` | TEXT | Phone number (optional) |
| `email` | TEXT | Email (optional) |
| `address_line` | TEXT | Street address (optional) |
| `city` | TEXT | City (optional) |
| `country` | TEXT | Country (optional) |
| `created_at` | TIMESTAMPTZ | When the record was created |
| `updated_at` | TIMESTAMPTZ | Last update |

**Important constraint**: `CHECK (phone IS NOT NULL OR email IS NOT NULL)` — a customer
must have at least one contact method. You can't create a customer record with no way to
reach them.

**Junior tip**: Why are customers separate from users? Because customers are people the
showroom tracks for business purposes (they signed a rental, bought a car). They don't
necessarily have login accounts. A `user` is someone who works in or uses the dashboard.

---

### Table: `cars`

**What it stores**: Every vehicle in the showroom inventory.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `vin` | TEXT UNIQUE | Vehicle Identification Number (optional, but unique if set) |
| `brand` | TEXT NOT NULL | e.g. "Toyota" |
| `model` | TEXT NOT NULL | e.g. "Camry" |
| `year` | INT NOT NULL | Must be between 1900 and next year |
| `mileage_km` | INT DEFAULT 0 | Odometer reading, must be ≥ 0 |
| `sale_price` | NUMERIC(12,2) | Price if selling, up to 999,999,999,999.99 |
| `rent_price_per_day` | NUMERIC(12,2) | Daily rental price |
| `currency_code` | CHAR(3) DEFAULT `'THB'` | ISO currency code |
| `status` | car_status DEFAULT `'available'` | Current state (see ENUM below) |
| `is_published` | BOOLEAN DEFAULT false | Only published cars appear on the public website |
| `fuel` | TEXT | `'petrol'`, `'diesel'`, `'electric'`, `'hybrid'`, `'plug-in hybrid'` |
| `transmission` | TEXT | `'automatic'`, `'manual'`, `'cvt'` |
| `color` | TEXT | e.g. "Midnight Black" |
| `engine` | TEXT | e.g. "2.5L Turbo" |
| `drive` | TEXT | `'fwd'`, `'rwd'`, `'awd'`, `'4wd'` |
| `seats` | INT | 1–20, number of passenger seats |
| `body_type` | car_body_type | Optional body style (see ENUM below) |
| `listing_type` | car_listing_type NOT NULL DEFAULT `'sale'` | Whether the car is for sale or for rent (see ENUM below) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `created_by_user_id` | UUID FK → users SET NULL | Which staff member added this car |

**car_status ENUM** — the "lifecycle" of a car:
```
available  → car is in stock, can be rented or sold
reserved   → manually flagged as reserved (admin decision)
rented     → set automatically when a rental goes 'active'
sold       → set automatically when a purchase goes 'paid'
maintenance → manually flagged, not available
```

**car_body_type ENUM** — the body style (optional/nullable):
```
sedan | hatchback | suv | pickup_truck | van_minivan | electric | coupe | convertible
```

**car_listing_type ENUM** — sale vs rent (NOT NULL, defaults to `'sale'`):
```
sale → the car is offered for purchase only
rent → the car is offered for rental only
```
A car is **strictly one or the other**, never both. The application enforces this: you cannot
create a *purchase* for a `rent` car (`400 CAR_NOT_FOR_SALE`), and you cannot create a *rental*
for a `sale` car (`400 CAR_NOT_FOR_RENT`). The admin dashboard counts (`GET /admin/cars/stats`)
split available inventory by this field, so sale and rental totals never double-count the same car.

**Junior tip**: `NUMERIC(12,2)` means up to 12 total digits, 2 of which are after the decimal
point. This is better than `FLOAT` for money because floating-point numbers have rounding
errors (0.1 + 0.2 ≠ 0.3 in floating point). `NUMERIC` is exact.

---

### Table: `car_images`

**What it stores**: Photos of each car, with the actual image file living on Cloudinary.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `car_id` | UUID FK → cars CASCADE | Deleting the car deletes all its images |
| `storage_path` | TEXT NOT NULL | Cloudinary URL of the image |
| `is_primary` | BOOLEAN DEFAULT false | The "main" photo shown in listings |
| `sort_order` | INT DEFAULT 0 | Controls display order (0 = first) |
| `created_at` | TIMESTAMPTZ | |

**Constraints**:
- `UNIQUE (car_id, sort_order)` — no two images for the same car can share a sort position
- `UNIQUE INDEX WHERE is_primary = true` — a car can only have one primary image

**Junior tip**: Images are NOT stored in the database. That would be huge and slow. Instead,
we upload the image to Cloudinary (a cloud image service) and save the URL here. When you
want to display a car's photo, you use the URL in `storage_path` to fetch it directly from
Cloudinary's CDN.

---

### Table: `car_documents`

**What it stores**: Flexible key-value pairs of extra information for a car.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `car_id` | UUID FK → cars CASCADE | Deleting the car deletes all its documents |
| `field_name` | TEXT NOT NULL | The label, e.g. "Insurance Policy No." |
| `field_value` | TEXT NOT NULL | The value, e.g. "TH-2024-88321" |
| `sort_order` | INT DEFAULT 0 | Display order |
| `created_by_user_id` | UUID FK → users SET NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Junior tip**: Why not add a column for every possible car attribute directly to the `cars`
table? Because you can't know in advance what fields you'll need. A `car_documents` table lets
staff add any label-value pair they want — today's "Registration Expiry", tomorrow's
"Last Service Center". This pattern is called an **EAV (Entity-Attribute-Value)** store.

---

### Table: `rentals`

**What it stores**: Every car rental agreement made.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `car_id` | UUID FK → cars RESTRICT | Can't delete a car with rentals |
| `customer_id` | UUID FK → customers RESTRICT | Can't delete a customer with rentals |
| `start_date` | DATE NOT NULL | First day of rental (inclusive) |
| `end_date` | DATE NOT NULL | Last day of rental (inclusive) |
| `price_per_day` | NUMERIC(12,2) NOT NULL | **Snapshot** of the car's price at booking time |
| `total_price` | NUMERIC(12,2) NOT NULL | `(end_date - start_date + 1) × price_per_day` |
| `deposit_amount` | NUMERIC(12,2) DEFAULT 0 | Security deposit collected |
| `currency_code` | CHAR(3) DEFAULT `'THB'` | |
| `status` | rental_status DEFAULT `'pending'` | Current state |
| `cancelled_reason` | TEXT | Filled in if the rental is cancelled |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `created_by_user_id` | UUID FK → users SET NULL | Which staff created the record |

**rental_status ENUM**:
```
pending → confirmed → active → completed
                   ↘          ↗
                   cancelled (from any of: pending, confirmed, active)
```

**Junior tip on price snapshotting**: We copy the price into `price_per_day` at booking time.
If the showroom raises the daily rate next week, existing rentals don't change — they keep
the price that was agreed upon. This is a critical rule: never calculate historical prices
from the car's current price.

---

### Table: `purchases`

**What it stores**: Car sale transactions.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `car_id` | UUID FK → cars RESTRICT | Can't delete a car with purchases |
| `customer_id` | UUID FK → customers RESTRICT | Can't delete a customer with purchases |
| `sale_price` | NUMERIC(12,2) NOT NULL | Snapshot of the car's sale price at purchase time |
| `currency_code` | CHAR(3) DEFAULT `'THB'` | |
| `status` | purchase_status DEFAULT `'pending'` | Current state |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `created_by_user_id` | UUID FK → users SET NULL | Which staff created the record |

**purchase_status ENUM**:
```
pending → paid → refunded
        ↘
        cancelled
```

**Critical constraint**: `UNIQUE INDEX WHERE status = 'paid'` on `car_id` — only one `paid`
purchase can exist per car at any time. This prevents selling the same car twice.

**Side effect**: When status moves to `'paid'`, the car's status is set to `'sold'` in the
same database transaction. Either both updates succeed, or neither does (atomic).

---

### Table: `rental_terms`

**What it stores**: The terms and conditions presented to customers when renting a car.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | TEXT NOT NULL | Short heading, e.g. "Late Return Policy" |
| `description` | TEXT NOT NULL | The full text of the term |
| `is_active` | BOOLEAN DEFAULT true | Only active terms show on the public endpoint |
| `sort_order` | INT DEFAULT 0 | Controls display order |
| `created_by_user_id` | UUID FK → users SET NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### Table: `dealer_contacts`

**What it stores**: The showroom's own contact details and opening hours. This is a **single-row**
table — there is exactly one record, seeded when the migration runs. The public website reads it
to show phone/LINE/social links and open-or-closed status; staff edit it from the dashboard.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `showroom_name` | TEXT NOT NULL DEFAULT `'BKK Kaung Pyae'` | Display name of the showroom |
| `open_day_from` | TEXT | First open weekday, e.g. "Mon" |
| `open_day_to` | TEXT | Last open weekday, e.g. "Sat" |
| `open_time_from` | TEXT | Opening time, e.g. "09:00" |
| `open_time_to` | TEXT | Closing time, e.g. "18:00" |
| `status` | TEXT CHECK (`'auto'`/`'open'`/`'closed'`) DEFAULT `'auto'` | `auto` derives open/closed from the day/time fields; `open`/`closed` force it |
| `phone_number` | TEXT | |
| `line_contact` | TEXT | |
| `facebook_url` | TEXT | |
| `instagram_url` | TEXT | |
| `gmail` | TEXT | |
| `viber_contact` | TEXT | |
| `wechat_contact` | TEXT | |
| `map_url` | TEXT | Google Maps link to the showroom |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Junior tip**: Because there's only ever one row, the repository never inserts or deletes — it
`get()`s the single record and `update()`s it in place. The migration seeds one row only if the
table is empty, so re-running it is safe.

---

### Table: `feedback`

**What it stores**: Customer reviews/testimonials shown in a section on the public homepage.
It is **standalone** — no foreign keys to cars or customers.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `stars` | INT NOT NULL CHECK (1–5) | Star rating, 1 to 5 |
| `name` | TEXT NOT NULL DEFAULT `'Anonymous'` | Display name (see below) |
| `message` | TEXT NOT NULL | The feedback text |
| `is_approved` | BOOLEAN NOT NULL DEFAULT false | Hidden from the homepage until an admin approves |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**How submission works**: anyone can submit via `POST /feedback` — no login required. Because
it's a public write, three things protect the system:
1. **Approval gate** — new rows start `is_approved = false`, so nothing reaches the homepage
   until staff approve it (`PATCH /admin/feedback/:id/status`). The public `GET /feedback` only
   returns approved rows.
2. **Rate limiting** — at most 5 submissions per hour per IP address.
3. **Validation** — stars must be 1–5, message must be 5–1000 characters.

**Where `name` comes from**: the server decides it, never the submitter's request body. If the
person is logged in, their account `full_name` is used. If they're a guest, it's stored as
`'Anonymous'`. This prevents someone from posting under a fake name.

**Junior tip**: Staff can only *moderate* feedback (approve, hide, or delete) — there's no
endpoint to edit the words a customer wrote, so a testimonial always reflects what was actually
submitted.

---

### Table: `session`

**What it stores**: Active login sessions. Managed entirely by the `connect-pg-simple` library.

| Column | Type | Notes |
|---|---|---|
| `sid` | VARCHAR | Session ID (matches the cookie sent to the browser) |
| `sess` | JSON | Serialized session data (includes passport user info) |
| `expire` | TIMESTAMPTZ | When this session expires |

**Junior tip**: You almost never interact with this table directly. When a user logs in,
`express-session` creates a row here. When they log out, it deletes it. The only manual
interaction is during password reset: we delete all session rows for a user to force logout
everywhere (`DELETE FROM session WHERE sess->'passport'->>'user' = $userId`).

---

## 4. Relationships

Here's how the tables connect to each other:

```
users ──────────────────────────────────────────────────────────────────────
  │  created by                                                              │
  ├── cars (created_by_user_id)                                              │
  │     ├── car_images (car_id) — CASCADE                                   │
  │     └── car_documents (car_id) — CASCADE                                │
  │                                                                          │
  ├── email_verification_tokens (user_id) — CASCADE                         │
  ├── password_reset_tokens (user_id) — CASCADE                             │
  ├── rental_terms (created_by_user_id) — SET NULL                          │
  ├── rentals (created_by_user_id) — SET NULL                               │
  └── purchases (created_by_user_id) — SET NULL                             │
                                                                             │
customers ──────────────────────────────────────────────────────────────────┤
  ├── rentals (customer_id) — RESTRICT                                       │
  └── purchases (customer_id) — RESTRICT                                    │
                                                                             │
cars ────────────────────────────────────────────────────────────────────────
  ├── rentals (car_id) — RESTRICT
  └── purchases (car_id) — RESTRICT

dealer_contacts ──────────────────────────────────────────────────────────────
  └── (standalone — single config row, no foreign keys)

feedback ─────────────────────────────────────────────────────────────────────
  └── (standalone — homepage testimonials, no foreign keys)
```

**Reading this diagram**:
- An arrow from `A → B` with CASCADE means: delete A, B goes with it automatically
- RESTRICT means: you cannot delete A if B still references it (database will throw an error)
- SET NULL means: delete A, and B's reference column becomes NULL (B stays)

---

## 5. Key Constraints and Why They Exist

### One primary image per car
```sql
CREATE UNIQUE INDEX ON car_images(car_id) WHERE is_primary = true;
```
A partial unique index — it only enforces uniqueness among rows where `is_primary = true`.
You can have many non-primary images, but only one can be the "hero" image for a car listing.

### One paid purchase per car
```sql
CREATE UNIQUE INDEX ON purchases(car_id) WHERE status = 'paid';
```
Same idea: once a car is sold (`status = 'paid'`), no second purchase for that car can reach
the `'paid'` state. Prevents double-selling.

### Customer must have contact info
```sql
CONSTRAINT check_contact_method CHECK (phone IS NOT NULL OR email IS NOT NULL)
```
A customer with no phone and no email is useless in the system — you'd have no way to
follow up with them. This constraint enforces at least one contact method.

### Rental dates must make sense
```sql
CONSTRAINT check_dates CHECK (end_date >= start_date)
```
A rental can't end before it starts. The database will reject that before it even reaches
application code.

### Car year range
```sql
CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM now()) + 1)
```
Cars can't be from the future (except next year for pre-sales) and can't be impossibly old.

---

## 6. Migrations — How the Schema Evolves

A **migration** is a SQL file that describes a change to the database. Instead of manually
editing the database, every schema change is written as a new numbered file. This means:

- The full history of how the schema changed is tracked in git
- Anyone setting up a fresh database runs `npm run migrate` and gets the exact same state
- You never have to guess what the current schema looks like

**Migration files** (in `src/db/migrations/`):

| File | What it added |
|---|---|
| 001_create_users.sql | `users` table |
| 002_create_customers.sql | `customers` table |
| 003_create_cars.sql | `cars` table + `car_status` ENUM |
| 004_create_car_images.sql | `car_images` table |
| 005_create_rentals.sql | `rentals` table + `rental_status` ENUM |
| 006_create_purchases.sql | `purchases` table + `purchase_status` ENUM |
| 007_create_session.sql | `session` table |
| 008_email_verification.sql | `is_email_verified` column on users + `email_verification_tokens` table |
| 009_add_client_role.sql | Added `'client'` to the `role` check constraint on users |
| 010_password_reset_tokens.sql | `password_reset_tokens` table |
| 011_add_google_auth.sql | `auth_provider`, `google_id` columns on users; made `password_hash` nullable |
| 012_add_car_spec_columns.sql | `fuel`, `transmission`, `color`, `engine`, `drive`, `seats` columns on cars |
| 013_create_rental_terms.sql | `rental_terms` table |
| 014_create_car_documents.sql | `car_documents` table |
| 015_add_body_type_to_cars.sql | `body_type` column + `car_body_type` ENUM on cars |
| 016_create_dealer_contacts.sql | `dealer_contacts` table (seeds one row) |
| 017_add_profile_fields_to_users.sql | `line_contact`, `phone` columns on users |
| 018_add_listing_type_to_cars.sql | `listing_type` column + `car_listing_type` ENUM on cars (existing rows default to `'sale'`) |
| 019_create_feedback.sql | `feedback` table (homepage testimonials, approval gate) |

**Rule**: Never edit an existing migration file once it has been run on any environment.
Add a new numbered file instead. That way nobody's database gets out of sync.

---

## 7. Deployment — Render.com + CI/CD

### Overview

This project deploys on **Render.com**, which hosts both the **PostgreSQL database** and the
**Node.js web server**. The deployment is triggered automatically through a CI/CD pipeline
(Continuous Integration / Continuous Delivery).

---

### Your Proposed Flow

```
Dev  →  Build  →  Test  →  Pass: Prod
                         →  Fail: Blocked
```

**This is a solid approach.** It's a standard CI/CD pipeline and widely used in production
teams. Here's what each stage means and how to implement it:

---

### Stage 1: Dev

The developer writes code and runs the app locally with `npm run dev`.

**Local checklist before pushing**:
1. `npm run build` — make sure TypeScript compiles with no errors
2. Database is up and migrations are run (`npm run migrate`)
3. Test the endpoint manually or via a tool like Postman / Bruno

---

### Stage 2: Build

When you push code to GitHub, a **GitHub Actions** workflow runs automatically.

The build step compiles TypeScript to JavaScript:
```
npm ci          # clean install of dependencies
npm run build   # tsc → dist/
```

If `tsc` fails (type errors, missing imports), the pipeline stops here. Nothing is deployed.

---

### Stage 3: Test

After a successful build, the test suite runs:

```
npm test
```

This project has **29 unit tests** covering the core rental business rules:

| Suite | What it tests |
|---|---|
| Rental Status Transitions | All valid and invalid state changes (20 cases) |
| Price Snapshotting | Price is captured at booking; later car-price changes don't affect existing rentals |
| Total Price Calculation | Inclusive date range formula: `(end_date - start_date + 1) × price_per_day` |

Tests are pure functions — no database or network required. They live in `src/__tests__/rental.test.ts`.

A failing test blocks the deploy. This is the key safety gate.

---

### Stage 4: Prod (or Blocked)

**If all checks pass** → Render auto-deploys the new code to production.
**If any check fails** → The pipeline stops, Render is never triggered, production is safe.

---

### How Render.com Fits In

**Render PostgreSQL (Database)**:
- Create a **PostgreSQL** instance on Render (free tier available for testing)
- Render gives you a `DATABASE_URL` connection string
- Copy it into your Render web service's environment variables
- Run migrations on first deploy and whenever you add migration files

**Render Web Service (Server)**:
- Connect Render to your GitHub repo
- Set **Build Command**: `npm ci && npm run build`
- Set **Start Command**: `node dist/server.js`
- Set all environment variables in the Render dashboard (see the full list in CLAUDE.md)

**Important**: You also need to run `npm run migrate` and `npm run seed` on the production
database once, when first deploying. You can do this via Render's Shell tab in the dashboard,
or add it to a one-time deploy script.

---

### Recommended Branch Strategy

```
feature/my-feature
       ↓  (open Pull Request)
      dev  ──── GitHub Actions runs here ────
       ↓         Build + Test must pass          ↓
      main  ───────────────────────────────→ Render deploys
```

- Developers work on `feature/*` branches
- Open a PR to `dev` (or directly to `main` for small teams)
- GitHub branch protection rules: **require CI to pass** before the PR can merge
- Render watches `main` and auto-deploys on every push

This is simpler than manually calling deploy hooks — let GitHub Actions be the gate and
Render be the deployer.

---

### GitHub Actions Workflow (Starter)

Create this file in your repo at `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build (TypeScript compile)
        run: npm run build

      - name: Run tests
        run: npm test
```

The unit tests are pure functions and require no database, so no `TEST_DATABASE_URL` secret is
needed for the current test suite. If integration tests are added later, add a `TEST_DATABASE_URL`
GitHub secret pointing to a separate test database.

---

### Environment Variables on Render

Set these in the Render dashboard under **Environment → Environment Variables**:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Render provides this automatically for linked databases |
| `SESSION_SECRET` | Yes | Generate a long random string (32+ chars) |
| `CLOUDINARY_CLOUD_NAME` | Yes | From your Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Yes | From your Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Yes | From your Cloudinary dashboard |
| `CORS_ORIGIN` | Yes | Your frontend URL (e.g. `https://yourfrontend.onrender.com`) |
| `APP_URL` | Yes | Same as CORS_ORIGIN (used for OAuth redirects) |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Render sets this automatically — do not override |
| `RESEND_API_KEY` | No | Only needed if sending real emails |
| `GOOGLE_CLIENT_ID` | No | Only needed for Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Only needed for Google OAuth |
| `GOOGLE_CALLBACK_URL` | No | e.g. `https://yourapi.onrender.com/auth/google/callback` |
| `FROM_EMAIL` | No | Defaults to `CarShow <onboarding@resend.dev>` |

---

### First-Time Production Setup Checklist

```
1. Create Render PostgreSQL instance
2. Create Render Web Service (connect to GitHub main branch)
3. Set all environment variables in Render dashboard
4. Open Render Shell and run:
      npm run migrate
      npm run seed
5. Push code to main → Render auto-deploys
6. Test: GET https://yourapi.onrender.com/health
```

After the first deploy, migrations only need to run when you add new migration files
(i.e. when a new feature adds a new table or alters an existing one).
