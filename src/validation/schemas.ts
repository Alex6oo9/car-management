import { z } from 'zod';

// ── User Schemas ──

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(['employee']),
});

export const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['employee']),
});

// ── Auth Schemas ──

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

//ForgetPassword Schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

//resetPassword Schemas
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8),
}); 

// ── Customer Schemas ──

export const createCustomerSchema = z.object({
  full_name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address_line: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
}).refine(data => data.phone || data.email, {
  message: 'At least one contact method (phone or email) is required',
});

export const updateCustomerSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address_line: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

//Delete User Schemas
export const hardDeleteUserSchema = z.object({
  confirm: z.literal('DELETE'),
});

// ── Car Schemas ──

export const createCarSchema = z.object({
  vin: z.string().optional(),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  mileage_km: z.number().int().min(0).optional(),
  sale_price: z.number().min(0).optional(),
  rent_price_per_day: z.number().min(0).optional(),
  currency_code: z.string().length(3).default('THB'),
  status: z.enum(['available', 'reserved', 'rented', 'sold', 'maintenance']).default('available'),
  is_published: z.boolean().default(false),
});

export const updateCarSchema = z.object({
  vin: z.string().optional(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  mileage_km: z.number().int().min(0).optional(),
  sale_price: z.number().min(0).optional(),
  rent_price_per_day: z.number().min(0).optional(),
  currency_code: z.string().length(3).optional(),
  status: z.enum(['available', 'reserved', 'rented', 'sold', 'maintenance']).optional(),
  is_published: z.boolean().optional(),
});

export const publishCarSchema = z.object({
  is_published: z.boolean(),
});

export const createCarImageSchema = z.object({
  storage_path: z.string().min(1),
  is_primary: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
});

// ── Rental Schemas ──

export const createRentalSchema = z.object({
  car_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  deposit_amount: z.number().min(0).optional(),
}).refine(data => {
  return new Date(data.end_date) >= new Date(data.start_date);
}, {
  message: 'end_date must be >= start_date',
});

export const updateRentalStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'active', 'completed', 'cancelled']),
  cancelled_reason: z.string().optional(),
});

// ── Purchase Schemas ──

export const createPurchaseSchema = z.object({
  car_id: z.string().uuid(),
  customer_id: z.string().uuid(),
});

export const updatePurchaseStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'cancelled', 'refunded']),
});

// ── Query Schemas ──

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});
