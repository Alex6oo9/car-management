import {
  isValidRentalTransition,
  calculateRentalTotalPrice,
  snapshotPrice,
  type RentalStatus,
} from '../utils/rental.js';

// ─── 1. Rental Status Transitions ────────────────────────────────────────────

describe('Rental Status Transitions', () => {
  const validTransitions: [RentalStatus, RentalStatus][] = [
    ['pending', 'confirmed'],
    ['pending', 'cancelled'],
    ['confirmed', 'active'],
    ['confirmed', 'cancelled'],
    ['active', 'completed'],
    ['active', 'cancelled'],
  ];

  const invalidTransitions: [RentalStatus, RentalStatus][] = [
    // skipping states
    ['pending', 'active'],
    ['pending', 'completed'],
    ['confirmed', 'pending'],
    ['confirmed', 'completed'],
    // backwards movement
    ['active', 'pending'],
    ['active', 'confirmed'],
    // terminal → anything
    ['completed', 'pending'],
    ['completed', 'confirmed'],
    ['completed', 'active'],
    ['completed', 'cancelled'],
    ['cancelled', 'pending'],
    ['cancelled', 'confirmed'],
    ['cancelled', 'active'],
    ['cancelled', 'completed'],
  ];

  test.each(validTransitions)('%s → %s is allowed', (from, to) => {
    expect(isValidRentalTransition(from, to)).toBe(true);
  });

  test.each(invalidTransitions)('%s → %s is blocked', (from, to) => {
    expect(isValidRentalTransition(from, to)).toBe(false);
  });

  test('completed is a terminal state — no further transitions', () => {
    const allStatuses: RentalStatus[] = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
    for (const next of allStatuses) {
      expect(isValidRentalTransition('completed', next)).toBe(false);
    }
  });

  test('cancelled is a terminal state — no further transitions', () => {
    const allStatuses: RentalStatus[] = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
    for (const next of allStatuses) {
      expect(isValidRentalTransition('cancelled', next)).toBe(false);
    }
  });
});

// ─── 2. Price Snapshotting ────────────────────────────────────────────────────

describe('Price Snapshotting', () => {
  test('records the car price at the moment of booking', () => {
    const car = { rent_price_per_day: 1500 };
    const rentalPricePerDay = snapshotPrice(car.rent_price_per_day);
    expect(rentalPricePerDay).toBe(1500);
  });

  test('later car price changes do not affect an already-snapshotted rental', () => {
    const car = { rent_price_per_day: 1500 };
    const rentalPricePerDay = snapshotPrice(car.rent_price_per_day);

    // Showroom raises the rate after the booking was made
    car.rent_price_per_day = 2000;

    expect(rentalPricePerDay).toBe(1500);
    expect(rentalPricePerDay).not.toBe(car.rent_price_per_day);
  });

  test('two rentals booked at different times keep their own snapshots', () => {
    const car = { rent_price_per_day: 1200 };
    const firstRental = snapshotPrice(car.rent_price_per_day);

    car.rent_price_per_day = 1800; // price change between bookings

    const secondRental = snapshotPrice(car.rent_price_per_day);

    expect(firstRental).toBe(1200);
    expect(secondRental).toBe(1800);
  });
});

// ─── 3. Total Price Calculation ───────────────────────────────────────────────

describe('Total Price Calculation', () => {
  test('same-day rental counts as 1 day', () => {
    expect(calculateRentalTotalPrice('2025-06-01', '2025-06-01', 1000)).toBe(1000);
  });

  test('both start and end dates are inclusive', () => {
    // Jun 1, Jun 2, Jun 3 = 3 days
    expect(calculateRentalTotalPrice('2025-06-01', '2025-06-03', 1000)).toBe(3000);
  });

  test('one-week rental at 1500 THB/day totals 10500 THB', () => {
    expect(calculateRentalTotalPrice('2025-06-01', '2025-06-07', 1500)).toBe(10500);
  });

  test('matches the formula (endDate - startDate + 1) × pricePerDay', () => {
    const start = '2025-06-10';
    const end = '2025-06-20';    // 10 days apart + 1 = 11 days
    const pricePerDay = 800;
    expect(calculateRentalTotalPrice(start, end, pricePerDay)).toBe(11 * 800);
  });
});
