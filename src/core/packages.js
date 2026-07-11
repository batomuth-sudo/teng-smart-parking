export const PARKING_PACKAGES = Object.freeze({
  '1h': Object.freeze({ id: '1h', label: '1 hour', durationMinutes: 60, amountThb: 20 }),
  '3h': Object.freeze({ id: '3h', label: '3 hours', durationMinutes: 180, amountThb: 50 }),
  '6h': Object.freeze({ id: '6h', label: '6 hours', durationMinutes: 360, amountThb: 80 }),
  '12h': Object.freeze({ id: '12h', label: '12 hours', durationMinutes: 720, amountThb: 120 }),
  '24h': Object.freeze({ id: '24h', label: '24 hours', durationMinutes: 1440, amountThb: 180 })
});

export const CUSTOM_DURATION_RATES = Object.freeze({
  hour: Object.freeze({ unit: 'hour', label: 'hour', minutes: 60, amountThb: 20, min: 1, max: 24 }),
  day: Object.freeze({ unit: 'day', label: 'day', minutes: 1440, amountThb: 180, min: 1, max: 30 })
});

export function getParkingPackage(packageId) {
  const parkingPackage = PARKING_PACKAGES[packageId];
  if (!parkingPackage) {
    throw new Error(`Unknown parking package: ${packageId}`);
  }
  return parkingPackage;
}

export function createCustomParkingPackage({ durationUnit, durationValue }) {
  const rate = CUSTOM_DURATION_RATES[durationUnit];
  if (!rate) {
    throw new Error(`Unknown duration unit: ${durationUnit}`);
  }

  const value = Number(durationValue);
  if (!Number.isInteger(value) || value < rate.min || value > rate.max) {
    throw new Error(`Duration value must be ${rate.min}-${rate.max} ${rate.unit}`);
  }

  return {
    id: `custom-${rate.unit}-${value}`,
    label: `${value} ${value === 1 ? rate.label : `${rate.label}s`}`,
    durationMinutes: value * rate.minutes,
    amountThb: value * rate.amountThb,
    durationUnit: rate.unit,
    durationValue: value
  };
}

export function resolveParkingPackage({ packageId, durationUnit, durationValue }) {
  if (packageId === 'custom') {
    return createCustomParkingPackage({ durationUnit, durationValue });
  }

  return getParkingPackage(packageId);
}
