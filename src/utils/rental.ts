export type RentalStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';

export const RENTAL_VALID_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isValidRentalTransition(current: RentalStatus, next: RentalStatus): boolean {
  return RENTAL_VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function calculateRentalTotalPrice(
  startDate: string,
  endDate: string,
  pricePerDay: number,
): number {
  const days = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;
  return days * pricePerDay;
}

export function snapshotPrice(price: number): number {
  return price;
}
