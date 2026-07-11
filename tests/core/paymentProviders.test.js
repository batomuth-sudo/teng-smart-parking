import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpnPromptPayCharge } from '../../src/core/paymentProviders.js';

test('creates an Opn PromptPay charge and extracts its QR image URL', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'chrg_test_123',
        status: 'pending',
        source: {
          scannable_code: {
            image: {
              download_uri: 'https://api.omise.co/qr-test.svg'
            }
          }
        }
      })
    };
  };

  const charge = await createOpnPromptPayCharge({
    amountThb: 20,
    sessionId: 'sess_123',
    plate: 'UBON-1234',
    env: { OPN_SECRET_KEY: 'skey_test_abc' },
    fetchImpl
  });

  assert.equal(charge.id, 'chrg_test_123');
  assert.equal(charge.status, 'pending');
  assert.equal(charge.qrImageUrl, 'https://api.omise.co/qr-test.svg');
  assert.equal(calls[0].url, 'https://api.omise.co/charges');
  assert.match(calls[0].options.headers.authorization, /^Basic /);
  assert.equal(calls[0].options.body.get('amount'), '2000');
  assert.equal(calls[0].options.body.get('currency'), 'THB');
  assert.equal(calls[0].options.body.get('source[type]'), 'promptpay');
  assert.equal(calls[0].options.body.get('metadata[session_id]'), 'sess_123');
  assert.equal(calls[0].options.body.get('metadata[plate]'), 'UBON-1234');
});

test('reports Opn charge creation errors without exposing the secret key', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    text: async () => 'authentication failed for skey_test_abc'
  });

  await assert.rejects(
    createOpnPromptPayCharge({
      amountThb: 20,
      sessionId: 'sess_123',
      plate: 'UBON-1234',
      env: { OPN_SECRET_KEY: 'skey_test_abc' },
      fetchImpl
    }),
    /Opn PromptPay charge failed: 401/
  );
});
