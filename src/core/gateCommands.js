import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 15_000;

export function createGateCommand({ gateId, sessionId, now = new Date(), ttlMs = DEFAULT_TTL_MS }) {
  const createdAt = new Date(now);

  return {
    id: `gatecmd_${crypto.randomBytes(8).toString('hex')}`,
    gateId,
    sessionId,
    action: 'OPEN_GATE',
    createdAt,
    expiresAt: new Date(createdAt.getTime() + ttlMs),
    consumedAt: null
  };
}

export function consumeGateCommand({ command, now = new Date() }) {
  if (command.consumedAt) {
    return { status: 'already_consumed', command };
  }

  if (new Date(now).getTime() > new Date(command.expiresAt).getTime()) {
    return { status: 'expired', command };
  }

  return {
    status: 'ok',
    command: {
      ...command,
      consumedAt: new Date(now)
    }
  };
}

