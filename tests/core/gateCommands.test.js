import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeGateCommand,
  createGateCommand
} from '../../src/core/gateCommands.js';

test('creates a gate command that expires quickly', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');

  const command = createGateCommand({
    gateId: 'entry-1',
    sessionId: 'sess_123',
    now
  });

  assert.equal(command.gateId, 'entry-1');
  assert.equal(command.sessionId, 'sess_123');
  assert.equal(command.action, 'OPEN_GATE');
  assert.equal(command.expiresAt.toISOString(), '2026-07-11T02:00:15.000Z');
  assert.equal(command.consumedAt, null);
});

test('consumes a command once and rejects repeated consume', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');
  const command = createGateCommand({ gateId: 'exit-1', sessionId: 'sess_123', now });

  const first = consumeGateCommand({ command, now });
  const second = consumeGateCommand({
    command: first.command,
    now: new Date('2026-07-11T02:00:01.000Z')
  });

  assert.equal(first.status, 'ok');
  assert.equal(second.status, 'already_consumed');
});

test('rejects expired commands', () => {
  const now = new Date('2026-07-11T02:00:00.000Z');
  const command = createGateCommand({ gateId: 'exit-1', sessionId: 'sess_123', now });

  const result = consumeGateCommand({
    command,
    now: new Date('2026-07-11T02:00:16.000Z')
  });

  assert.equal(result.status, 'expired');
});

