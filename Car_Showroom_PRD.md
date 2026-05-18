# Product Requirements Document
# Car Showroom Management System

> **Version**: 1.0  
> **Date**: May 2026  
> **Status**: Draft  
> **Prepared by**: Senior Product Manager & Software Architect

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals and Objectives](#2-goals-and-objectives)
3. [User Roles and Permissions](#3-user-roles-and-permissions)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
6. [Business Workflow](#6-business-workflow)
7. [Data Requirements](#7-data-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Edge Cases and Constraints](#9-edge-cases-and-constraints)
10. [Future Improvements](#10-future-improvements)

---

## 1. Product Overview

### 1.1 Summary

The **Car Showroom Management System** is a web-based platform built for a physical car showroom business operating in Thailand (currency: THB). It serves two distinct audiences through a single unified system:

- **Public visitors** — Browse the car inventory, view specifications, pricing, and rental terms, then contact the showroom via phone, WhatsApp, or Facebook Messenger to proceed.
- **Internal staff (Admin & Employee)** — Manage the entire inventory, customer records, rental agreements, and purchase transactions through a secured admin dashboard.

The system is strictly **offline-transaction-first**: no booking, payment, or approval of any kind happens through the website. All deals are finalized in person or over the phone. The website's role is to serve as a digital showroom catalogue and to feed the internal operations panel.

### 1.2 Problem Statement

Traditional car showrooms rely on physical catalogues, phone-only inquiries, and spreadsheet-based records. This leads to:

- Customers having no reliable way to browse available inventory before visiting
- Staff spending significant time answering repetitive questions about specs and pricing
- Rental date conflicts and double-selling due to manual tracking in spreadsheets
- No centralized customer and transaction history for business reporting

### 1.3 Solution

A full-stack web application that:

- Presents a clean, filterable public car catalogue (website-facing)
- Gives staff a complete admin dashboard to manage cars, customers, rentals, and purchases
- Enforces rental date overlap prevention and atomic purchase status transitions at the database level
- Maintains a complete audit trail of all transactions with price snapshots

### 1.4 Tech Stack (Existing Implementation)

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict mode, ES modules) |
| Framework | Express.js v5 |
| Database | PostgreSQL 14+ |
| DB Client | `pg` (raw SQL, parameterized queries) |
| Authentication | Passport.js (Local + Google OAuth) + express-session |
| Session Storage | connect-pg-simple (PostgreSQL) |
| Image Storage | Cloudinary (via Multer buffer upload) |
| Email | Resend |
| Input Validation | Zod |
| Security | Helmet, CORS, express-rate-limit |
| Logging | Pino + pino-http |
| Deployment | Render.com (PostgreSQL + Web Service) |

---

## 2. Goals and Objectives

### 2.1 Business Goals

- **Increase qualified walk-ins**: Give potential customers enough information online (specs, photos, prices) to make an informed decision before contacting the showroom.
- **Reduce staff overhead**: Eliminate repetitive phone calls asking for basic car information by having it all publicly visible.
- **Eliminate transaction errors**: Replace spreadsheet tracking with a database system that enforces date overlaps, atomic status changes, and price snapshotting.
- **Build a customer database**: Capture and maintain a searchable record of all customers for future follow-ups and relationship management.

### 2.2 Product Objectives

| Objective | Measure of Success |
|---|---|
| Public car catalogue is fast and filterable | Public browsing requires zero login; filter by brand, model, year, price in <1s |
| Rental conflicts are impossible | Database-level overlap check blocks any double-booking |
| Purchase atomicity is guaranteed | `paid` status and `cars.status = 'sold'` always change in the same PostgreSQL transaction |
| Contact flow is frictionless | Phone/WhatsApp/Messenger contact buttons visible on every car page |
| Admin dashboard is intuitive | Staff can create a rental record in under 2 minutes after a customer confirms |
| Prices are historically accurate | Rental and purchase records always show the price at the time of agreement |

### 2.3 Out of Scope

The following are explicitly **not** in scope for this version:

- Online payment processing of any kind
- Automated rental approval or booking confirmation
- Customer self-service portal or account creation for transaction management
- Mobile app (iOS/Android)
- Multi-location / multi-branch support
- Accounting/invoicing integration

---

## 3. User Roles and Permissions

The system has three roles. Public visitors have no account; system users authenticate via the admin panel.

### 3.1 Role Overview

| Role | Who | Created By | Can Be Deleted |
|---|---|---|---|
| **Admin** | One designated owner/manager | Database seed on first setup | No |
| **Employee** | Showroom staff | Admin via `POST /admin/users` | Yes (soft or hard delete) |
| **Client** | Registered public users | Self-register via website | Yes |

> **Note on Client role**: Clients register via the public-facing website but do not gain any transactional ability. Their role exists for potential future features (e.g., saved searches, inquiry history). In the current system, their only access is `GET /auth/me` after login.

### 3.2 Permission Matrix

| Feature | Public (No Login) | Client | Employee | Admin |
|---|---|---|---|---|
| Browse published cars | ✅ | ✅ | ✅ | ✅ |
| View car details & specs | ✅ | ✅ | ✅ | ✅ |
| View rental terms | ✅ | ✅ | ✅ | ✅ |
| Contact showroom (phone/WhatsApp/Messenger) | ✅ | ✅ | ✅ | ✅ |
| Register an account | ✅ | — | — | — |
| Log in to dashboard | ❌ | ❌ | ✅ | ✅ |
| Manage car inventory | ❌ | ❌ | ✅ | ✅ |
| Upload/delete car images | ❌ | ❌ | ✅ | ✅ |
| Publish / unpublish a car | ❌ | ❌ | ✅ | ✅ |
| Manage car documents (key-value specs) | ❌ | ❌ | ✅ | ✅ |
| Manage customers | ❌ | ❌ | ✅ | ✅ |
| Create/manage rentals | ❌ | ❌ | ✅ | ✅ |
| Create/manage purchases | ❌ | ❌ | ✅ | ✅ |
| Manage rental terms | ❌ | ❌ | ✅ | ✅ |
| Manage employee accounts | ❌ | ❌ | ❌ | ✅ |
| Promote client → employee | ❌ | ❌ | ❌ | ✅ |
| Demote employee → client | ❌ | ❌ | ❌ | ✅ |
| View/delete users | ❌ | ❌ | ❌ | ✅ |

### 3.3 Access Control Implementation

- Middleware chain: `isAuthenticated → isAdmin | isAdminOrEmployee → route handler`
- Sessions stored in PostgreSQL via `connect-pg-simple`; `HttpOnly` cookies
- Email verification required before local login is permitted (returns `403` if unverified)
- Google OAuth bypasses email verification requirement (Google already verified the email)

---

## 4. User Stories

### 4.1 Public Visitor (No Login)

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| PV-01 | Public visitor | Browse all available cars without creating an account | I can explore the inventory freely with no friction |
| PV-02 | Public visitor | Filter cars by brand, model, year range, sale price range, and rental price range | I can narrow down cars that match my needs |
| PV-03 | Public visitor | View a detailed car page with all specifications, photos, sale price, and daily rental price | I can evaluate the car thoroughly before contacting |
| PV-04 | Public visitor | View rental terms and conditions on the website | I understand the rules before calling the showroom |
| PV-05 | Public visitor | See clear contact options (phone, WhatsApp, Facebook Messenger) on the car detail page | I know exactly how to reach the showroom when I am ready |
| PV-06 | Public visitor | View a gallery of car photos (with a primary/hero image in listing view) | I get an accurate visual impression of the vehicle |
| PV-07 | Public visitor | See the car's status (available, rented, sold, etc.) | I do not waste time inquiring about unavailable cars |

### 4.2 Admin

| ID | As an... | I want to... | So that... |
|---|---|---|---|
| AD-01 | Admin | Log in securely via email/password or Google | I have flexible, secure access to the dashboard |
| AD-02 | Admin | Create employee accounts with a temporary password | I can onboard new staff without them self-registering |
| AD-03 | Admin | Soft-delete an employee account | I can deactivate a staff member without losing their historical records |
| AD-04 | Admin | Promote a registered client user to employee | I can onboard a client who turns out to be a staff hire |
| AD-04b | Admin | Demote an employee back to client | I can offboard a staff member while preserving their account and history |
| AD-05 | Admin | Add, edit, and delete cars in the inventory | I maintain a complete and accurate car catalogue |
| AD-06 | Admin | Publish or unpublish a car from the public website | I control exactly which cars are visible to the public |
| AD-07 | Admin | Create and update rental records after offline agreements | I keep the system in sync with what was agreed in person |
| AD-08 | Admin | Create and update purchase records after offline sales | I maintain an accurate sales history in the system |
| AD-09 | Admin | Create, edit, and reorder rental terms | I can update company policy terms without developer help |
| AD-10 | Admin | Search and view all customer records | I can quickly look up a customer's history and contact info |

### 4.3 Employee

| ID | As an... | I want to... | So that... |
|---|---|---|---|
| EM-01 | Employee | Log in to the admin dashboard | I can access my work tools |
| EM-02 | Employee | Add a new car to the inventory with all specs and images | New arrivals are listed in the system immediately |
| EM-03 | Employee | Upload multiple images per car and set a primary/hero image | Car listings look professional and visually complete |
| EM-04 | Employee | Add arbitrary document fields (e.g., insurance expiry, registration no.) to a car | I can store any admin-level detail without modifying the schema |
| EM-05 | Employee | Create a customer record with name, phone, and/or email | I have a reference for the person who is renting/buying |
| EM-06 | Employee | Create a rental record for a customer and a car with agreed dates and price | The rental is tracked in the system after offline confirmation |
| EM-07 | Employee | Update the rental status (pending → confirmed → active → completed / cancelled) | I reflect what has happened in real life |
| EM-08 | Employee | Create a purchase record for a customer and a car | The sale is tracked and the car is automatically marked as sold |
| EM-09 | Employee | Update the purchase status (pending → paid, or cancel/refund) | I manage the post-sale lifecycle of the transaction |
| EM-10 | Employee | View a list of all rentals filtered by car, customer, status, or date range | I can check what is active, upcoming, or overdue |

---

## 5. Functional Requirements

### 5.1 Car Listing (Public)

**Endpoint**: `GET /cars`

**Requirements**:
- Returns only cars where `is_published = true`
- Includes the primary image URL for each car in the list view
- Supports the following query filters:
  - `brand` — exact text match (case-insensitive)
  - `model` — exact text match (case-insensitive)
  - `year_min`, `year_max` — inclusive year range filter
  - `price_min`, `price_max` — filter by sale price
  - `rent_price_min`, `rent_price_max` — filter by daily rental price
  - `limit` (default: 20) and `offset` (default: 0) for pagination
- Response includes: `id`, `brand`, `model`, `year`, `sale_price`, `rent_price_per_day`, `currency_code`, `status`, `primary_image_url`, `fuel`, `transmission`, `color`, `seats`
- Cars with `status = 'sold'` are still shown (with their status) unless unpublished

**Behaviour**:
- If no cars match the filters, return an empty array (not a 404)
- Unpublished cars are completely invisible to this endpoint regardless of filters

---

### 5.2 Car Details Page (Public)

**Endpoint**: `GET /cars/:id`

**Requirements**:
- Returns full detail for a single published car
- Includes all images (`car_images`) ordered by `sort_order`
- Includes all public documents (flexible key-value fields from `car_documents`) ordered by `sort_order`

> **Note**: `car_documents` stores internal operational data (insurance numbers, registration details). Product decision required on whether all document fields are shown publicly or only a curated subset. Current implementation exposes them on the public endpoint. If sensitive, a `is_public` flag should be added to `car_documents` in a future migration.

**Full spec fields returned**:
- Identity: `brand`, `model`, `year`, `vin` (optional)
- Pricing: `sale_price`, `rent_price_per_day`, `currency_code`
- Status: `status` (available / reserved / rented / sold / maintenance)
- Vehicle specs: `fuel`, `transmission`, `color`, `engine`, `drive`, `seats`, `mileage_km`
- Media: `images[]` (sorted by `sort_order`, `is_primary` flagged)
- Documents: `documents[]` (`field_name`, `field_value`)

**Contact Prompt**:
The car detail page must prominently display at least one contact method from:
- Phone number (click-to-call on mobile)
- WhatsApp link (using `https://wa.me/{number}` deep link)
- Facebook Messenger link

These are static showroom contact details configured by the Admin, not generated per-car.

---

### 5.3 Contact Flow

The contact flow is entirely **off-system**. The website's responsibility ends at presenting the contact options. There is no inquiry form, no callback request, and no message system.

**Frontend requirements**:
- Phone number must be displayed and use `tel:` protocol so mobile users can tap-to-call
- WhatsApp button must use the `https://wa.me/` deep link with the showroom's number pre-filled
- Facebook Messenger button must link to `https://m.me/{page-id}` of the showroom's Facebook page
- All three contact options should be visible on the car detail page and on a global contact section
- Optional: pre-fill a WhatsApp message with the car name and ID (e.g., `"Hello, I'm interested in the 2023 Toyota Camry (ID: abc123)"`)

---

### 5.4 Admin Dashboard — Cars

**Access**: Admin + Employee

**Car Management Features**:

| Feature | Endpoint | Notes |
|---|---|---|
| Create car | `POST /admin/cars` | All spec fields optional except brand, model, year |
| List all cars | `GET /admin/cars` | Shows ALL cars (published and unpublished) |
| View car detail | `GET /admin/cars/:id` | Includes images and documents |
| Update car | `PATCH /admin/cars/:id` | Partial updates supported via Zod |
| Delete car | `DELETE /admin/cars/:id` | Blocked if car has any rentals or purchases on record |
| Publish/unpublish | `PATCH /admin/cars/:id/publish` | Toggles `is_published` flag |
| Upload image | `POST /admin/cars/:id/images` | `multipart/form-data`, field: `image`; stored on Cloudinary |
| Update image metadata | `PATCH /admin/cars/:id/images/:imageId` | Adjust `is_primary`, `sort_order` |
| Delete image | `DELETE /admin/cars/:id/images/:imageId` | Removes from Cloudinary AND database |
| Add document field | `POST /admin/cars/:carId/documents` | Key-value: `field_name`, `field_value` |
| Update document | `PATCH /admin/cars/:carId/documents/:id` | |
| Delete document | `DELETE /admin/cars/:carId/documents/:id` | |

**Car Status Lifecycle**:
```
available ──────────────────────────────────────
    ↓ (manually)             ↓ (rental → active)    ↓ (purchase → paid)
  reserved               rented                   sold
  maintenance
```
Status `rented` and `sold` are set automatically by system side-effects. `reserved` and `maintenance` are set manually by staff.

---

### 5.5 Admin Dashboard — Customers

**Access**: Admin + Employee

| Feature | Endpoint | Notes |
|---|---|---|
| Create customer | `POST /admin/customers` | Must provide phone OR email (or both) |
| List customers | `GET /admin/customers` | Supports `?search=` (name, phone, email), pagination |
| View customer | `GET /admin/customers/:id` | |
| Update customer | `PATCH /admin/customers/:id` | |

**No delete endpoint exists** — customers are retained for historical record integrity, since they are linked to `rentals` and `purchases` with `RESTRICT` foreign keys.

---

### 5.6 Admin Dashboard — Rentals

**Access**: Admin + Employee

**Creation Rules**:
- Staff selects a car (`car_id`) and a customer (`customer_id`)
- Staff enters agreed `start_date`, `end_date`, and optional `deposit_amount`
- `price_per_day` is **automatically snapshotted** from `cars.rent_price_per_day` at creation time — staff does not enter it manually
- `currency_code` is automatically carried over from the car record
- System automatically calculates `total_price = (end_date - start_date + 1) × price_per_day`
- System checks for overlap with existing active rentals for the same car before saving (dates are inclusive; statuses checked: `pending`, `confirmed`, `active`)
- Future changes to the car's rental price do not affect this record

**Rental Status Transitions**:
```
pending → confirmed → active → completed
                     ↘          ↗
                     cancelled (allowed from: pending, confirmed, active)
completed → (final state, no further transitions)
cancelled → (final state, no further transitions)
```

**Side Effects**:
- `→ active`: Sets `cars.status = 'rented'` in the same PostgreSQL transaction
- `→ completed` or `→ cancelled`: Sets `cars.status = 'available'` (if no other active rental exists for that car)
- `cancelled_reason` is optional — staff may provide a reason but it is not enforced by the API

**Filtering**:
`GET /admin/rentals` supports: `?car_id=`, `?customer_id=`, `?status=`, `?start_date_from=`, `?start_date_to=`

---

### 5.7 Admin Dashboard — Purchases

**Access**: Admin + Employee

**Creation Rules**:
- Staff selects a car (`car_id`) and a customer (`customer_id`) — no other fields are accepted in the request body
- `sale_price` is **automatically snapshotted** from `cars.sale_price` at creation time; staff does not enter it
- `currency_code` is automatically carried over from the car record
- A car can only have one purchase at a time in `paid` status (enforced by a partial unique index)

**Purchase Status Transitions**:
```
pending → paid → refunded
        ↘
        cancelled
paid → (final state except for refund)
cancelled → (final state)
refunded → (final state)
```

**Critical Side Effect — Atomic Transaction**:
When status changes to `paid`, the system executes in a **single PostgreSQL transaction**:
1. Updates `purchases.status = 'paid'`
2. Updates `cars.status = 'sold'`

Either both succeed or neither does. This prevents a car from appearing sold without a payment record, or a payment record existing for an unsold car.

---

### 5.8 Admin Dashboard — Rental Terms

**Access**: Admin + Employee (public read available at `GET /rental-terms`)

| Feature | Endpoint |
|---|---|
| Create term | `POST /admin/rental-terms` — `{ title, description, is_active?, sort_order? }` |
| List all (admin view) | `GET /admin/rental-terms` — supports `?is_active=true\|false` |
| Update term | `PATCH /admin/rental-terms/:id` |
| Delete term | `DELETE /admin/rental-terms/:id` (hard delete) |
| Public list | `GET /rental-terms` — returns only `is_active = true`, ordered by `sort_order` |

Terms are global policy statements (e.g., "Late Return Policy", "Deposit Requirements"). They are not linked to individual car records.

---

### 5.9 Admin Dashboard — User Management

**Access**: Admin only

| Feature | Notes |
|---|---|
| Create employee | Creates an account with `role = 'employee'`; staff uses the provided credentials to log in |
| List users | Filter by `?role=`, `?is_active=` |
| Soft delete employee | Sets `is_active = false`; login is blocked but record and audit trail are preserved |
| Hard delete user | Permanently removes the user + destroys their sessions; blocked for the admin account and for self |
| Promote client → employee | Changes `role` from `client` to `employee` |
| Demote employee → client | Changes `role` from `employee` to `client`; admin-only; admin role cannot be changed |

**Invariants**:
- The single admin account cannot be deleted, deactivated, or have its role changed
- Demotions from employee → client are permitted (admin-only); admin role cannot be changed in either direction

---

## 6. Business Workflow

### 6.1 Offline Rental Flow (Step-by-Step)

This is the primary business workflow. No part of this flow is automated.

```
Step 1  [Customer - Website]
        Customer browses published cars at GET /cars
        Customer finds a car they like and views GET /cars/:id

Step 2  [Customer - External Channel]
        Customer taps the WhatsApp / Phone / Messenger contact button on the car detail page
        Customer contacts the showroom directly

Step 3  [Staff - Phone/Messaging]
        Staff discusses the car, confirms availability (checks admin dashboard for rental calendar),
        discusses rental dates, daily rate, deposit requirements, and rental terms

Step 4  [Offline / In-Person]
        Customer visits the showroom (or confirms via messaging)
        Customer reviews and signs a physical rental agreement
        Customer pays the deposit (cash, transfer — outside the system)

Step 5  [Staff - Admin Dashboard]
        Staff creates a Customer record if the customer is new:
          POST /admin/customers { full_name, phone, email, ... }

Step 6  [Staff - Admin Dashboard]
        Staff creates the Rental record:
          POST /admin/rentals {
            car_id, customer_id,
            start_date, end_date,
            deposit_amount   ← optional, what was collected
          }
        price_per_day is auto-snapshotted from the car's current rent_price_per_day
        currency_code is auto-carried from the car record
        System validates: no date overlap for this car (checks pending/confirmed/active rentals)
        System calculates: total_price = days × price_per_day
        Rental is created with status: "pending"

Step 7  [Staff - Admin Dashboard]
        Staff updates the rental status to "confirmed" once all paperwork is done:
          PATCH /admin/rentals/:id/status { status: "confirmed" }

Step 8  [On Rental Start Date]
        Staff changes status to "active" when customer takes possession of the car:
          PATCH /admin/rentals/:id/status { status: "active" }
        System side effect: cars.status → "rented" (atomic)

Step 9  [On Rental End Date]
        Customer returns the car
        Staff changes status to "completed":
          PATCH /admin/rentals/:id/status { status: "completed" }
        System side effect: cars.status → "available" (if no other active rentals)

--- CANCELLATION PATH ---
At any point before completion, if the rental is cancelled:
        PATCH /admin/rentals/:id/status { status: "cancelled", cancelled_reason: "..." }
        System side effect: cars.status → "available"
```

### 6.2 Offline Purchase Flow (Step-by-Step)

```
Step 1  [Customer - Website]
        Customer browses and identifies a car to purchase
        Customer contacts the showroom via phone/WhatsApp/Messenger

Step 2  [Staff - Phone/Messaging/In-Person]
        Staff discusses the car, negotiates price, and confirms the customer's intent
        Staff checks the car status in the dashboard to ensure it is "available"

Step 3  [Offline / In-Person]
        Customer visits the showroom
        Purchase agreement is signed (physical document)
        Deposit or full payment may be taken (outside the system)

Step 4  [Staff - Admin Dashboard]
        Staff creates or retrieves the Customer record:
          POST /admin/customers (if new)

Step 5  [Staff - Admin Dashboard]
        Staff creates the Purchase record:
          POST /admin/purchases {
            car_id,
            customer_id
          }
        sale_price is auto-snapshotted from the car's current sale_price
        currency_code is auto-carried from the car record
        Purchase is created with status: "pending"

Step 6  [On Payment Completion]
        Once full payment is received (offline), staff marks the purchase as paid:
          PATCH /admin/purchases/:id/status { status: "paid" }
        
        *** ATOMIC TRANSACTION (single DB transaction) ***
        → purchases.status = "paid"
        → cars.status = "sold"
        Both succeed or neither does.
        
        The car is now removed from available inventory automatically.
        The public website will no longer show this car as available (it may remain visible
        with status "sold" until unpublished by staff).

--- POST-SALE PATHS ---
If the sale falls through before payment:
          PATCH /admin/purchases/:id/status { status: "cancelled" }
          car remains "available"

If a paid sale needs to be unwound (extremely rare):
          PATCH /admin/purchases/:id/status { status: "refunded" }
          Staff must manually set cars.status back to "available" (no automatic reversal)
```

---

## 7. Data Requirements

This section maps business data to the existing PostgreSQL schema.

### 7.1 Entity Summary

| Entity | Table | Purpose |
|---|---|---|
| System User | `users` | Admin and Employee accounts |
| Public User | `users` (role: client) | Self-registered public accounts |
| Customer | `customers` | People who rent or buy cars |
| Car | `cars` | Vehicle inventory |
| Car Photo | `car_images` | Images stored on Cloudinary |
| Car Document | `car_documents` | Flexible key-value metadata per car (EAV pattern) |
| Rental | `rentals` | Rental agreements |
| Purchase | `purchases` | Purchase transactions |
| Rental Term | `rental_terms` | Global policy text |
| Session | `session` | Active login sessions |
| Email Token | `email_verification_tokens` | One-time email verification |
| Reset Token | `password_reset_tokens` | One-time password reset |

### 7.2 Cars Table — Key Fields

```
cars
├── vin TEXT UNIQUE                     — Optional, globally unique vehicle identifier
├── brand TEXT NOT NULL                 — e.g., "Toyota"
├── model TEXT NOT NULL                 — e.g., "Camry"
├── year INT (1900 to now+1)            — Model year
├── mileage_km INT DEFAULT 0            — Current odometer
├── sale_price NUMERIC(12,2)            — Catalogue sale price (nullable if rent-only)
├── rent_price_per_day NUMERIC(12,2)    — Catalogue daily rate (nullable if sale-only)
├── currency_code CHAR(3) DEFAULT 'THB' — ISO 4217 currency
├── status car_status DEFAULT 'available'
│     ENUM: available | reserved | rented | sold | maintenance
├── is_published BOOLEAN DEFAULT false  — Controls public visibility
├── fuel TEXT                           — petrol | diesel | electric | hybrid | plug-in hybrid
├── transmission TEXT                   — automatic | manual | cvt
├── color TEXT
├── engine TEXT                         — e.g., "2.5L Turbo"
├── drive TEXT                          — fwd | rwd | awd | 4wd
└── seats INT (1–20)
```

### 7.3 Rentals Table — Key Fields

```
rentals
├── car_id UUID FK→cars RESTRICT        — Cannot delete car while rental exists
├── customer_id UUID FK→customers RESTRICT
├── start_date DATE NOT NULL            — Inclusive start
├── end_date DATE NOT NULL              — Inclusive end (≥ start_date)
├── price_per_day NUMERIC(12,2)         — SNAPSHOT: price agreed at booking time
├── total_price NUMERIC(12,2)           — = (end_date - start_date + 1) × price_per_day
├── deposit_amount NUMERIC(12,2) DEFAULT 0
├── currency_code CHAR(3) DEFAULT 'THB'
├── status rental_status DEFAULT 'pending'
│     ENUM: pending | confirmed | active | completed | cancelled
└── cancelled_reason TEXT               — Required when status = 'cancelled'
```

**Overlap Detection Rule**:
```
A new rental (new_start, new_end) overlaps an existing rental (ex_start, ex_end) when:
  new_start <= ex_end AND new_end >= ex_start
Checked only against rentals with status IN ('pending', 'confirmed', 'active')
```

### 7.4 Purchases Table — Key Fields

```
purchases
├── car_id UUID FK→cars RESTRICT
├── customer_id UUID FK→customers RESTRICT
├── sale_price NUMERIC(12,2) NOT NULL   — SNAPSHOT: price agreed at purchase time
├── currency_code CHAR(3) DEFAULT 'THB'
└── status purchase_status DEFAULT 'pending'
      ENUM: pending | paid | cancelled | refunded

UNIQUE INDEX on (car_id) WHERE status = 'paid'
— Prevents selling the same car twice
```

### 7.5 Price Snapshotting Rule

Prices are **always captured at transaction time** and stored independently of the car's current catalogue price. This means:

- If `cars.rent_price_per_day` changes from 1,500 to 2,000 THB, existing rentals are unaffected
- Historical financial records always reflect what was actually agreed upon
- Reports and audits produce accurate figures regardless of current pricing

### 7.6 Customers Table — Key Fields

```
customers
├── full_name TEXT NOT NULL
├── phone TEXT
├── email TEXT
├── address_line TEXT
├── city TEXT
└── country TEXT
CONSTRAINT: phone IS NOT NULL OR email IS NOT NULL
```

### 7.7 Car Documents (EAV Pattern)

`car_documents` uses an Entity-Attribute-Value design to allow staff to attach any label-value pair to a car without schema changes:

```
car_documents
├── car_id UUID FK→cars CASCADE
├── field_name TEXT NOT NULL    — e.g., "Registration Expiry"
├── field_value TEXT NOT NULL   — e.g., "2025-12-31"
└── sort_order INT DEFAULT 0
```

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metric | Target |
|---|---|
| Public car listing (`GET /cars`) response time | < 300ms (p95) under 50 concurrent users |
| Car detail page (`GET /cars/:id`) | < 300ms (p95) |
| Admin dashboard queries | < 500ms (p95) |
| Image load time (Cloudinary CDN) | < 1s for primary image on listing (Cloudinary optimization recommended: `f_auto,q_auto,w_800`) |
| Database query | Indexed on `is_published`, `status`, `brand`, `model`, `year`; rental overlap uses indexed `car_id` + date columns |

**Optimization Recommendations**:
- Add a composite index: `CREATE INDEX ON cars (is_published, status)` for the public listing query
- Add an index: `CREATE INDEX ON rentals (car_id, start_date, end_date)` for overlap checks
- Enable Cloudinary's automatic format conversion (`f_auto`) and quality optimization (`q_auto`) on all image URLs

### 8.2 Security

| Control | Implementation |
|---|---|
| Password hashing | bcrypt with 10 rounds — resistant to brute force |
| Session management | PostgreSQL-backed sessions; `HttpOnly`, `Secure` cookies in production |
| Token security | Email verification and password reset tokens stored as SHA-256 hashes; raw token only in email |
| Post-reset session revocation | All sessions for a user destroyed on password reset |
| Rate limiting | 100 requests / 15 min on login & register; 100 / 1 hour on forgot-password & resend-verification |
| Input validation | Zod schemas validate all request bodies and params; parameterized SQL queries (no ORM — manual parameterization) |
| Security headers | Helmet.js sets: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| CORS | Restricted to configured `CORS_ORIGIN` in production |
| Role enforcement | Middleware: `isAdmin` and `isAdminOrEmployee` on all protected routes |
| Admin protection | Admin account cannot be deleted, deactivated, or have its role changed (enforced in repository layer) |
| Credentials | Default seed credentials (`admin@example.com / admin123`) must be changed immediately on first production deploy |

### 8.3 Reliability

| Requirement | Detail |
|---|---|
| Database consistency | Atomic transactions for `purchase → paid` and `rental → active/completed` status changes |
| Overlap prevention | Rental overlap check runs within the same DB transaction as the insert; uses `SELECT ... FOR UPDATE` pattern where needed |
| Idempotent migrations | All migrations use `IF NOT EXISTS` or `DO $$ BEGIN ... EXCEPTION ...` to be safely re-runnable |
| Token cleanup | Expired verification/reset tokens purged on server startup via `src/db/cleanup.ts` |
| Startup validation | Zod-validated env vars fail fast on boot — no silent misconfiguration |
| Uptime target | 99.5% availability (Render.com managed hosting) |
| Data backup | Render PostgreSQL automatic daily backups; manual backup before any schema migration |
| Error handling | Global Express error handler returns structured `{ error, code, details }` JSON; no raw stack traces in production |

---

## 9. Edge Cases and Constraints

### 9.1 Rental-Specific Edge Cases

| Scenario | System Behaviour |
|---|---|
| Creating a rental on exact same start/end date as an existing rental | Blocked — overlap check is inclusive on both ends |
| Updating a rental's dates after creation | Not supported by current API; staff must cancel and re-create |
| Two staff members create overlapping rentals simultaneously | The second insert will fail at the database level (overlap query runs before insert in the same transaction) |
| Rental `active` → status set back to `pending` | Not permitted — status transitions are one-way (no backwards movement) |
| Car set to `maintenance` while an active rental exists | Not blocked at API level; staff must be trained not to do this manually |
| Car deleted while rental exists | Blocked: `ON DELETE RESTRICT` on `rentals.car_id` prevents deletion |

### 9.2 Purchase-Specific Edge Cases

| Scenario | System Behaviour |
|---|---|
| Attempting to create a second purchase for a car that is already `paid` | The `UNIQUE INDEX WHERE status = 'paid'` constraint returns a 409 Conflict |
| Marking a purchase `paid` while the car status is `rented` | Not explicitly blocked at application layer; staff must ensure car is not actively rented before marking sold |
| Refunded purchase — car remains `sold` | A refund transitions `purchases.status = 'refunded'` but does NOT automatically set `cars.status = 'available'`. Staff must manually update the car status. This is by design for auditability. |

### 9.3 Car Management Edge Cases

| Scenario | System Behaviour |
|---|---|
| Deleting a car with past (completed) rentals or purchases | Blocked — `RESTRICT` FK prevents deletion of any car with transaction history |
| Unpublishing a car that is currently `available` | Allowed — car disappears from public listing immediately |
| A car having no sale_price set (rent-only car) | Allowed — `sale_price` is nullable; public listing should not show a purchase option |
| A car having no rent_price_per_day (sale-only car) | Allowed — `rent_price_per_day` is nullable; rental creation will require manual price entry |
| Uploading two images with the same sort_order | Blocked — `UNIQUE (car_id, sort_order)` constraint returns a 409 Conflict |

### 9.4 User Management Edge Cases

| Scenario | System Behaviour |
|---|---|
| Attempting to delete the admin account | Hard-blocked in repository layer; returns 403 |
| Admin trying to delete their own account | Hard-blocked; returns 403 |
| Employee with existing rental/purchase records is soft-deleted | Their records remain intact; `created_by_user_id` is preserved. Their login is blocked. |
| Employee hard-deleted | `created_by_user_id` on their created records is set to NULL (SET NULL FK behaviour) |
| Client tries to access `/admin/*` routes | Returns 403 Forbidden |
| Unverified user tries to log in | Returns 403 with message to verify email; Google OAuth users are auto-verified |

### 9.5 Business Constraints (Hard Rules)

1. **No online payment** — The system must never integrate a payment gateway or accept money
2. **No automated booking confirmation** — Rentals start as `pending` and require manual staff action to advance
3. **No public rental or purchase form** — The API has no public-facing endpoint for creating transactions
4. **Price immutability** — Once a rental or purchase is created, its `price_per_day` or `sale_price` cannot be updated (the record is a contract snapshot)
5. **One admin only** — The system is designed for a single admin account; multiple admin accounts are not supported

---

## 10. Future Improvements

These features are explicitly out of scope for version 1.0 but are logical next steps for the platform.

### 10.1 Short-Term (v1.1 – v1.2)

| Feature | Description | Priority |
|---|---|---|
| **Car availability calendar** | Visual calendar on the public car detail page showing which dates are already booked (rented), without revealing customer details | High |
| **Admin rental calendar view** | Calendar view in the admin panel showing all rentals across all cars in a timeline/gantt layout | High |
| **Basic analytics dashboard** | Revenue summary, cars rented per month, top-rented vehicles, current inventory status breakdown | Medium |
| **Car `is_public` flag on documents** | Control which `car_documents` fields are visible on the public car detail page vs. internal-only | Medium |
| **Rental date edit** | Allow staff to extend or shorten a rental's end date with automatic overlap re-validation | Medium |
| **Customer history view** | On the customer detail page, show a linked list of all their rentals and purchases | Medium |

### 10.2 Medium-Term (v2.0)

| Feature | Description |
|---|---|
| **Online inquiry / reservation form** | A form on the car detail page that submits an inquiry (not a confirmed booking) — notifies staff via email/LINE, but requires manual confirmation |
| **Staff notifications** | Email or Line Notify alerts when: a rental is approaching its end date, a car is returned, a purchase is marked paid |
| **Document generation** | Generate a formatted rental or purchase receipt/agreement PDF from the system records (using a library like Puppeteer or PDFKit) |
| **Multi-image reorder UI** | Drag-and-drop interface in the admin panel for sorting car images |
| **Reporting & export** | Monthly revenue report, inventory export as CSV/Excel |

### 10.3 Long-Term (v3.0+)

| Feature | Description |
|---|---|
| **Online booking (with deposit)** | Customers initiate a rental request online; deposit paid via Stripe/PromptPay; staff confirms. This requires payment gateway integration (currently fully out of scope) |
| **Customer portal** | Logged-in customers can view their own rental and purchase history |
| **Multi-branch support** | Each branch has its own inventory and staff; admin can view across all branches |
| **WhatsApp Business API integration** | Automated acknowledgement messages when a customer contacts via WhatsApp, using the WhatsApp Business Cloud API |
| **LINE OA integration** | Contact via LINE Official Account with auto-reply for car catalogue queries |
| **Mobile app** | React Native companion app for staff to manage rentals and car status on the go |

---

*Document end. For implementation questions, see `CLAUDE.md` (developer reference) and `Database_design.md` (schema documentation).*
