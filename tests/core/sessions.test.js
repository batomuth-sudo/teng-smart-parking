import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOvertime,
  createSession,
  findSessionForExit
} from '../../src/core/sessions.js';

test('creates a paid parking session with token, package, and expiry', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');

  const session = createSession({
    plate: 'UBON-1234',
    packageId: '1h',
    now
  });

  assert.equal(session.plate, 'UBON-1234');
  assert.equal(session.packageId, '1h');
  assert.equal(session.amountThb, 20);
  assert.equal(session.paidUntil.toISOString(), '2026-07-11T03:00:00.000Z');
  assert.match(session.token, /^ps_[a-z0-9]{20}$/);
});

test('creates a custom hourly parking session from rate and quantity', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');

  const session = createSession({
    plate: 'UBON-1234',
    packageId: 'custom',
    durationUnit: 'hour',
    durationValue: 3,
    now
  });

  assert.equal(session.packageId, 'custom-hour-3');
  assert.equal(session.amountThb, 60);
  assert.equal(session.paidUntil.toISOString(), '2026-07-11T05:00:00.000Z');
});

test('creates a custom daily parking session from rate and quantity', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');

  const session = createSession({
    plate: 'UBON-1234',
    packageId: 'custom',
    durationUnit: 'day',
    durationValue: 2,
    now
  });

  assert.equal(session.packageId, 'custom-day-2');
  assert.equal(session.amountThb, 360);
  assert.equal(session.paidUntil.toISOString(), '2026-07-13T02:00:00.000Z');
});

test('finds exit session by browser token before using plate fallback', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');
  const session = createSession({ plate: 'UBON-1234', packageId: '3h', now });
  const other = createSession({ plate: 'UBON-9999', packageId: '1h', now });

  const found = findSessionForExit({
    token: session.token,
    plate: 'UBON-9999',
    sessions: [other, session],
    now
  });

  assert.equal(found.id, session.id);
});

test('uses normalized plate fallback when browser token is missing', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');
  const session = createSession({ plate: 'ubon 1234', packageId: '3h', now });

  const found = findSessionForExit({
    plate: 'UBON-1234',
    sessions: [session],
    now
  });

  assert.equal(found.id, session.id);
});

test('calculates overtime only after paid time expires', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');
  const session = createSession({ plate: 'UBON-1234', packageId: '1h', now });

  assert.equal(
    calculateOvertime({
      session,
      now: new Date('2026-07-11T02:59:00.000Z')
    }).amountDueThb,
    0
  );

  assert.equal(
    calculateOvertime({
      session,
      now: new Date('2026-07-11T03:01:00.000Z')
    }).amountDueThb,
    20
  );
});
