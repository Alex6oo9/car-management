export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  full_name: string;
  role: 'admin' | 'employee' | 'client';
  is_active: boolean;
  is_email_verified: boolean;
  created_at: Date;
  updated_at: Date;
  auth_provider: 'local' | 'google';
  google_id: string | null;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  created_at: Date;
  updated_at: Date;
}

export type CarStatus = 'available' | 'reserved' | 'rented' | 'sold' | 'maintenance';

export interface Car {
  id: string;
  vin: string | null;
  brand: string;
  model: string;
  year: number;
  mileage_km: number;
  sale_price: number | null;
  rent_price_per_day: number | null;
  currency_code: string;
  status: CarStatus;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: string | null;
}

export interface CarImage {
  id: string;
  car_id: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
  created_at: Date;
}

export type RentalStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';

export interface Rental {
  id: string;
  car_id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  price_per_day: number;
  total_price: number;
  deposit_amount: number;
  currency_code: string;
  status: RentalStatus;
  cancelled_reason: string | null;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: string | null;
}

export type PurchaseStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

export interface Purchase {
  id: string;
  car_id: string;
  customer_id: string;
  sale_price: number;
  currency_code: string;
  status: PurchaseStatus;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: string | null;
}
