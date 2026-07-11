import crypto from 'node:crypto';
import { resolveParkingPackage } from './packages.js';

const SESSION_PREFIX = 'ps';
const SESSION_ID_PREFIX = 'sess';

export function normalizePlate(plate) {
  return String(plate ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

export function createSession({ plate, packageId, durationUnit, durationValue, now = new Date() }) {
  const parkingPackage = resolveParkingPackage({ packageId, durationUnit, durationValue });
  const createdAt = new Date(now);
  const paidUntil = new Date(createdAt.getTime() + parkingPackage.durationMinutes * 60_000);

  return {
    id: `${SESSION_ID_PREFIX}_${crypto.randomBytes(8).toString('hex')}`,
    token: `${SESSION_PREFIX}_${crypto.randomBytes(10).toString('hex')}`,
    plate: String(plate ?? '').trim(),
    normalizedPlate: normalizePlate(plate),
    packageId: parkingPackage.id,
    amountThb: parkingPackage.amountThb,
    createdAt,
    paidUntil,
    status: 'paid'
  };
}

export function findSessionForExit({ token, plate, sessions, now = new Date() }) {
  const activeSessions = sessions.filter((session) => session.status !== 'closed');

  if (token) {
    const byToken = activeSessions.find((session) => session.token === token);
    if (byToken) return byToken;
  }

  const normalizedPlate = normalizePlate(plate);
  if (!normalizedPlate) return null;

  return activeSessions
    .filter((session) => session.normalizedPlate === normalizedPlate)
    .sort((a, b) => Math.abs(new Date(a.createdAt) - now) - Math.abs(new Date(b.createdAt) - now))[0] ?? null;
}

export function calculateOvertime({ session, now = new Date(), hourlyRateThb = 20 }) {
  const overtimeMs = new Date(now).getTime() - new Date(session.paidUntil).getTime();
  if (overtimeMs <= 0) {
    return { overtimeMinutes: 0, billableHours: 0, amountDueThb: 0 };
  }

  const overtimeMinutes = Math.ceil(overtimeMs / 60_000);
  const billableHours = Math.ceil(overtimeMinutes / 60);

  return {
    overtimeMinutes,
    billableHours,
    amountDueThb: billableHours * hourlyRateThb
  };
}
