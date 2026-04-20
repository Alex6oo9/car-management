# API Reference — Car Showroom Management System

## Base URL
```
http://localhost:5000
```

## Authentication
- Session-based (cookie). No Bearer tokens.
- Login via `POST /auth/login` or Google OAuth. The server sets an **HttpOnly** cookie automatically.
- Send requests with `credentials: 'include'` (fetch) or `withCredentials: true` (axios).

## Error Format
All errors follow this shape:
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_CODE"
}
```

Common HTTP codes: `400` validation, `401` not logged in, `403` wrong role, `404` not found, `409` conflict, `500` server error.

---

## Auth Routes

### `POST /auth/register`
Public. Creates a new client account and sends a verification email.

**Request**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "full_name": "John Doe"
}
```
**Response** `201`
```json
{
  "message": "Account created. Please check your email to verify your account."
}
```

---

### `GET /auth/verify-email?token=<token>`
Public. Verifies email using the token from the verification email.

**Response** `200`
```json
{
  "message": "Email verified successfully. You can now log in."
}
```

---

### `POST /auth/resend-verification`
Public. Resends the email verification link.

**Request**
```json
{
  "email": "user@example.com"
}
```
**Response** `200`
```json
{
  "message": "If an account exists for this email, a verification link has been sent."
}
```

---

### `POST /auth/forgot-password`
Public. Sends a password reset link to the email.

**Request**
```json
{
  "email": "user@example.com"
}
```
**Response** `200`
```json
{
  "message": "If an account exists for this email, you'll receive a password reset link shortly."
}
```

---

### `POST /auth/reset-password`
Public. Resets password using the token from the reset email.

**Request**
```json
{
  "token": "abc123resettoken",
  "new_password": "newSecret123"
}
```
**Response** `200`
```json
{
  "message": "Password reset successfully. You can now log in."
}
```

---

### `GET /auth/google`
Public. Redirects browser to Google OAuth. No request body needed — just navigate to this URL.

---

### `POST /auth/login`
Public. Login with email + password.

**Request**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```
**Response** `200`
```json
{
  "message": "Login successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "full_name": "Admin",
    "role": "admin"
  }
}
```

---

### `POST /auth/logout`
Requires: authenticated. Destroys the session.

**Response** `200`
```json
{
  "message": "Logout successful"
}
```

---

### `GET /auth/me`
Requires: authenticated. Returns the current logged-in user.

**Response** `200`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com",
  "full_name": "Admin",
  "role": "admin",
  "is_active": true
}
```

---

## Public Cars

### `GET /cars`
Public. Lists all published cars. Supports filters.

**Query params** (all optional)

| Param | Type | Description |
|---|---|---|
| `brand` | string | Filter by brand |
| `model` | string | Filter by model |
| `year_min` / `year_max` | number | Year range |
| `price_min` / `price_max` | number | Sale price range |
| `rent_price_min` / `rent_price_max` | number | Rent price range |
| `limit` | number | Default: 20 |
| `offset` | number | Default: 0 |

**Response** `200`
```json
[
  {
    "id": "car-uuid",
    "vin": "1HGCM82633A123456",
    "brand": "Toyota",
    "model": "Camry",
    "year": 2022,
    "mileage_km": 15000,
    "sale_price": 850000,
    "rent_price_per_day": 1500,
    "currency_code": "THB",
    "status": "available",
    "is_published": true,
    "created_at": "2024-01-15T10:00:00.000Z",
    "updated_at": "2024-01-15T10:00:00.000Z",
    "images": [
      {
        "id": "img-uuid",
        "storage_path": "/uploads/cars/camry-front.jpg",
        "is_primary": true,
        "sort_order": 0
      }
    ]
  }
]
```

---

### `GET /cars/:id`
Public. Get a single published car by ID.

**Response** `200` — same shape as one item from `GET /cars`.

---

## Admin — Users
Requires: **admin** role.

### `POST /admin/users`
Creates an employee account.

**Request**
```json
{
  "email": "employee@example.com",
  "password": "secret123",
  "full_name": "Jane Smith",
  "role": "employee"
}
```
**Response** `201`
```json
{
  "id": "user-uuid",
  "email": "employee@example.com",
  "full_name": "Jane Smith",
  "role": "employee",
  "is_active": true,
  "is_email_verified": false,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

---

### `GET /admin/users`
Lists users. Optional query params: `role`, `is_active` (boolean).

**Response** `200` — array of user objects (same shape as above).

---

### `GET /admin/users/:id`
Get a single user by ID.

**Response** `200` — single user object.

---

### `PATCH /admin/users/:id`
Update a user's name or active status.

**Request** (all fields optional)
```json
{
  "full_name": "Jane Updated",
  "is_active": false
}
```
**Response** `200` — updated user object.

---

### `PATCH /admin/users/:id/role`
Promote a client to employee. Cannot change admin role.

**Request**
```json
{
  "role": "employee"
}
```
**Response** `200` — updated user object.

---

### `DELETE /admin/users/:id`
Soft-delete a user (sets `is_active = false`). Cannot delete admin.

**Response** `200`
```json
{
  "message": "User deleted successfully"
}
```

---

### `DELETE /admin/users/:id/hard`
Permanently delete a user. Cannot delete admin or own account.

**Request**
```json
{
  "confirm": "DELETE"
}
```
**Response** `200`
```json
{
  "message": "User hard deleted successfully"
}
```

---

## Admin — Customers
Requires: **admin** or **employee**.

### `POST /admin/customers`
At least one of `phone` or `email` is required.

**Request**
```json
{
  "full_name": "Ahmed Al-Hassan",
  "phone": "+66812345678",
  "email": "ahmed@example.com",
  "address_line": "123 Main St",
  "city": "Bangkok",
  "country": "Thailand"
}
```
**Response** `201`
```json
{
  "id": "customer-uuid",
  "full_name": "Ahmed Al-Hassan",
  "phone": "+66812345678",
  "email": "ahmed@example.com",
  "address_line": "123 Main St",
  "city": "Bangkok",
  "country": "Thailand",
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

---

### `GET /admin/customers`
**Query params**: `search` (searches name, phone, email), `limit`, `offset`.

**Response** `200` — array of customer objects.

---

### `GET /admin/customers/:id`
**Response** `200` — single customer object.

---

### `PATCH /admin/customers/:id`
**Request** (all fields optional)
```json
{
  "full_name": "Ahmed Updated",
  "city": "Chiang Mai"
}
```
**Response** `200` — updated customer object.

---

## Admin — Cars
Requires: **admin** or **employee**.

### `POST /admin/cars`
**Request**
```json
{
  "vin": "1HGCM82633A123456",
  "brand": "Honda",
  "model": "Civic",
  "year": 2023,
  "mileage_km": 0,
  "sale_price": 750000,
  "rent_price_per_day": 1200,
  "currency_code": "THB",
  "status": "available",
  "is_published": false
}
```
**Response** `201`
```json
{
  "id": "car-uuid",
  "vin": "1HGCM82633A123456",
  "brand": "Honda",
  "model": "Civic",
  "year": 2023,
  "mileage_km": 0,
  "sale_price": 750000,
  "rent_price_per_day": 1200,
  "currency_code": "THB",
  "status": "available",
  "is_published": false,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z",
  "created_by_user_id": "user-uuid"
}
```

`status` values: `available` | `reserved` | `rented` | `sold` | `maintenance`

---

### `GET /admin/cars`
**Query params**: `limit`, `offset`.

**Response** `200` — array of car objects (with images).

---

### `GET /admin/cars/:id`
**Response** `200` — single car object with images array.

---

### `PATCH /admin/cars/:id`
**Request** (all fields optional)
```json
{
  "mileage_km": 5000,
  "sale_price": 720000,
  "status": "maintenance"
}
```
**Response** `200` — updated car object.

---

### `DELETE /admin/cars/:id`
Blocked if the car has existing rentals or purchases.

**Response** `200`
```json
{
  "message": "Car deleted successfully"
}
```

---

### `PATCH /admin/cars/:id/publish`
Toggle car visibility on the public listing.

**Request**
```json
{
  "is_published": true
}
```
**Response** `200` — updated car object.

---

### `POST /admin/cars/:id/images`
Add an image to a car. Only one image can be `is_primary = true` per car.

**Request**
```json
{
  "storage_path": "/uploads/cars/civic-front.jpg",
  "is_primary": true,
  "sort_order": 0
}
```
**Response** `201`
```json
{
  "id": "img-uuid",
  "car_id": "car-uuid",
  "storage_path": "/uploads/cars/civic-front.jpg",
  "is_primary": true,
  "sort_order": 0,
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

---

## Admin — Rentals
Requires: **admin** or **employee**.

`price_per_day` and `total_price` are auto-calculated from the car. You don't send them.

**Total price formula**: `(end_date - start_date + 1) × price_per_day` (end date is inclusive).

### `POST /admin/rentals`
**Request**
```json
{
  "car_id": "car-uuid",
  "customer_id": "customer-uuid",
  "start_date": "2024-02-01",
  "end_date": "2024-02-07",
  "deposit_amount": 5000
}
```
**Response** `201`
```json
{
  "id": "rental-uuid",
  "car_id": "car-uuid",
  "customer_id": "customer-uuid",
  "start_date": "2024-02-01",
  "end_date": "2024-02-07",
  "price_per_day": 1200,
  "total_price": 8400,
  "deposit_amount": 5000,
  "currency_code": "THB",
  "status": "pending",
  "cancelled_reason": null,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z",
  "created_by_user_id": "user-uuid"
}
```

---

### `GET /admin/rentals`
**Query params**: `car_id`, `customer_id`, `status`, `start_date_from` (YYYY-MM-DD), `start_date_to` (YYYY-MM-DD).

**Response** `200` — array of rental objects (includes car and customer info).

---

### `GET /admin/rentals/:id`
**Response** `200` — single rental object with car and customer details.

---

### `PATCH /admin/rentals/:id/status`
**Status transitions**:
```
pending → confirmed | cancelled
confirmed → active | cancelled
active → completed | cancelled
completed → (final)
cancelled → (final)
```
Setting to `active` changes car status to `rented`. Setting to `completed` or `cancelled` sets car back to `available`.

**Request**
```json
{
  "status": "confirmed",
  "cancelled_reason": null
}
```
**Response** `200` — updated rental object.

---

## Admin — Purchases
Requires: **admin** or **employee**.

`sale_price` is auto-snapshotted from the car at creation time.

### `POST /admin/purchases`
Car must have `status = available`.

**Request**
```json
{
  "car_id": "car-uuid",
  "customer_id": "customer-uuid"
}
```
**Response** `201`
```json
{
  "id": "purchase-uuid",
  "car_id": "car-uuid",
  "customer_id": "customer-uuid",
  "sale_price": 750000,
  "currency_code": "THB",
  "status": "pending",
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z",
  "created_by_user_id": "user-uuid"
}
```

---

### `GET /admin/purchases`
**Query params**: `car_id`, `customer_id`, `status`.

**Response** `200` — array of purchase objects (includes car and customer info).

---

### `GET /admin/purchases/:id`
**Response** `200` — single purchase object with car and customer details.

---

### `PATCH /admin/purchases/:id/status`
**Status transitions**:
```
pending → paid | cancelled
paid → refunded
cancelled → (final)
refunded → (final)
```
Setting to `paid` atomically changes car status to `sold`.

**Request**
```json
{
  "status": "paid"
}
```
**Response** `200` — updated purchase object.

---

## Health Check

### `GET /health`
Public. Use to verify the server is running.

**Response** `200`
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```
