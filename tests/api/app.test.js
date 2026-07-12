import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { createApp } from '../../src/app.js';

function listen(app) {
  const server = createServer(app);

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        baseUrl: `http://${address.address}:${address.port}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

test('serves the web app shell', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const response = await fetch(`${server.baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /TENG Smart Parking/);
    assert.match(html, /appRoot/);
  } finally {
    await server.close();
  }
});

test('requires basic auth when demo password is configured', async () => {
  const previousUser = process.env.DEMO_USER;
  const previousPassword = process.env.DEMO_PASSWORD;
  process.env.DEMO_USER = 'teng';
  process.env.DEMO_PASSWORD = 'secret-demo';

  const app = createApp();
  const server = await listen(app);

  try {
    const blocked = await fetch(`${server.baseUrl}/`);
    assert.equal(blocked.status, 401);
    assert.equal(blocked.headers.get('www-authenticate'), 'Basic realm="TENG Smart Parking"');

    const credentials = Buffer.from('teng:secret-demo').toString('base64');
    const allowed = await fetch(`${server.baseUrl}/`, {
      headers: { authorization: `Basic ${credentials}` }
    });
    const html = await allowed.text();

    assert.equal(allowed.status, 200);
    assert.match(html, /TENG Smart Parking/);
  } finally {
    if (previousUser === undefined) delete process.env.DEMO_USER;
    else process.env.DEMO_USER = previousUser;

    if (previousPassword === undefined) delete process.env.DEMO_PASSWORD;
    else process.env.DEMO_PASSWORD = previousPassword;

    await server.close();
  }
});

test('serves customer app shell for entry sign, pass, and exit routes', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    for (const route of ['/', '/entry', '/kiosk', '/pass?token=demo', '/exit']) {
      const response = await fetch(`${server.baseUrl}${route}`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /TENG Smart Parking/);
      assert.match(html, /appRoot/);
    }
  } finally {
    await server.close();
  }
});

test('reports active payment provider and accepts opn webhook scaffold', async () => {
  const previousProvider = process.env.PAYMENT_PROVIDER;
  process.env.PAYMENT_PROVIDER = 'mock';

  const app = createApp();
  const server = await listen(app);

  try {
    const provider = await request(server.baseUrl, '/api/payment-provider');
    assert.equal(provider.status, 200);
    assert.equal(provider.body.provider, 'mock');
    assert.equal(provider.body.ready, true);

    const webhook = await request(server.baseUrl, '/api/payments/webhook/opn', {
      method: 'POST',
      body: JSON.stringify({ key: 'charge.complete', data: { id: 'chrg_test' } })
    });

    assert.equal(webhook.status, 202);
    assert.equal(webhook.body.received, true);
  } finally {
    if (previousProvider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previousProvider;

    await server.close();
  }
});

test('verifies opn webhook signature when a webhook secret is configured', async () => {
  const previousSecret = process.env.OPN_WEBHOOK_SECRET;
  process.env.OPN_WEBHOOK_SECRET = Buffer.from('test-webhook-secret').toString('base64');

  const app = createApp();
  const server = await listen(app);

  try {
    const rawBody = JSON.stringify({ key: 'charge.complete', data: { id: 'chrg_signed' } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto
      .createHmac('sha256', Buffer.from(process.env.OPN_WEBHOOK_SECRET, 'base64'))
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const webhook = await request(server.baseUrl, '/api/payments/webhook/opn', {
      method: 'POST',
      headers: {
        'omise-signature': signature,
        'omise-signature-timestamp': timestamp
      },
      body: rawBody
    });

    assert.equal(webhook.status, 202);
    assert.equal(webhook.body.received, true);
    assert.equal(webhook.body.chargeId, 'chrg_signed');
    assert.equal(webhook.body.signatureVerified, true);
  } finally {
    if (previousSecret === undefined) delete process.env.OPN_WEBHOOK_SECRET;
    else process.env.OPN_WEBHOOK_SECRET = previousSecret;

    await server.close();
  }
});

test('rejects opn webhook when configured signature does not match', async () => {
  const previousSecret = process.env.OPN_WEBHOOK_SECRET;
  process.env.OPN_WEBHOOK_SECRET = Buffer.from('test-webhook-secret').toString('base64');

  const app = createApp();
  const server = await listen(app);

  try {
    const webhook = await request(server.baseUrl, '/api/payments/webhook/opn', {
      method: 'POST',
      headers: {
        'omise-signature': '00',
        'omise-signature-timestamp': String(Math.floor(Date.now() / 1000))
      },
      body: JSON.stringify({ key: 'charge.complete', data: { id: 'chrg_bad' } })
    });

    assert.equal(webhook.status, 401);
    assert.equal(webhook.body.error, 'Invalid webhook signature');
  } finally {
    if (previousSecret === undefined) delete process.env.OPN_WEBHOOK_SECRET;
    else process.env.OPN_WEBHOOK_SECRET = previousSecret;

    await server.close();
  }
});

test('returns overtime pricing policy for customer disclosure', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const response = await request(server.baseUrl, '/api/packages');

    assert.equal(response.status, 200);
    assert.equal(response.body.overtimePolicy.hourlyRateThb, 20);
    assert.equal(response.body.overtimePolicy.rounding, 'ceil_to_next_hour');
    assert.match(response.body.overtimePolicy.disclosureTh, /ปัดขึ้น/);
    assert.match(response.body.overtimePolicy.disclosureEn, /rounded up/i);
  } finally {
    await server.close();
  }
});

test('looks up a mobile pass by session token', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const created = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'UBON-4321', packageId: '3h', gateId: 'entry-1' })
    });
    await request(server.baseUrl, `/api/payments/${created.body.payment.id}/confirm`, { method: 'POST' });

    const pass = await request(server.baseUrl, `/api/sessions/pass?token=${created.body.session.token}`);

    assert.equal(pass.status, 200);
    assert.equal(pass.body.session.id, created.body.session.id);
    assert.equal(pass.body.session.plate, 'UBON-4321');
    assert.equal(pass.body.session.status, 'paid');
  } finally {
    await server.close();
  }
});

test('returns 404 when mobile pass token is unknown', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const pass = await request(server.baseUrl, '/api/sessions/pass?token=missing');

    assert.equal(pass.status, 404);
    assert.equal(pass.body.error, 'Session not found');
  } finally {
    await server.close();
  }
});

test('creates a demo session, confirms payment, and exposes gate command once', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const created = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'UBON-1234', packageId: '1h', gateId: 'entry-1' })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.session.status, 'pending_payment');
    assert.equal(created.body.payment.amountThb, 20);

    const confirmed = await request(server.baseUrl, `/api/payments/${created.body.payment.id}/confirm`, {
      method: 'POST'
    });

    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.session.status, 'paid');
    assert.equal(confirmed.body.gateCommand.action, 'OPEN_GATE');

    const command = await request(server.baseUrl, '/gate/entry-1/command');
    assert.equal(command.status, 200);
    assert.equal(command.body.action, 'OPEN_GATE');

    const consumed = await request(server.baseUrl, '/gate/entry-1/command');
    assert.equal(consumed.status, 204);
    assert.equal(consumed.body, null);
  } finally {
    await server.close();
  }
});

test('creates an Opn PromptPay payment when provider is configured', async () => {
  const app = createApp({
    env: {
      PAYMENT_PROVIDER: 'opn',
      OPN_PUBLIC_KEY: 'pkey_test_abc',
      OPN_SECRET_KEY: 'skey_test_abc'
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'chrg_test_entry',
        status: 'pending',
        source: {
          scannable_code: {
            image: { download_uri: 'https://api.omise.co/entry-qr.svg' }
          }
        }
      })
    })
  });
  const server = await listen(app);

  try {
    const created = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'UBON-1234', packageId: '1h', gateId: 'entry-1' })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.payment.provider, 'opn');
    assert.equal(created.body.payment.providerChargeId, 'chrg_test_entry');
    assert.equal(created.body.payment.qrImageUrl, 'https://api.omise.co/entry-qr.svg');
    assert.equal(created.body.payment.qrText, null);
  } finally {
    await server.close();
  }
});

test('proxies an Opn QR image for mobile saving', async () => {
  const app = createApp({
    env: {
      PAYMENT_PROVIDER: 'opn',
      OPN_PUBLIC_KEY: 'pkey_test_abc',
      OPN_SECRET_KEY: 'skey_test_abc'
    },
    fetchImpl: async (url) => {
      if (url === 'https://api.omise.co/entry-qr.svg') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/svg+xml' }),
          arrayBuffer: async () => Buffer.from(`
            <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
              <rect width="128" height="128" fill="#fff"/>
              <image x="8" y="8" width="16" height="16" href="data:image/png;base64,iVBORw0KGgo="/>
              <image x="32" y="32" width="96" height="96" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="/>
            </svg>
          `)
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chrg_test_entry',
          status: 'pending',
          source: {
            scannable_code: {
              image: { download_uri: 'https://api.omise.co/entry-qr.svg' }
            }
          }
        })
      };
    }
  });
  const server = await listen(app);

  try {
    const created = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'UBON-1234', packageId: '1h', gateId: 'entry-1' })
    });

    const qr = await fetch(`${server.baseUrl}/api/payments/${created.body.payment.id}/qr`);
    const bytes = Buffer.from(await qr.arrayBuffer());

    assert.equal(qr.status, 200);
    assert.equal(qr.headers.get('content-type'), 'image/png');
    assert.equal(qr.headers.get('content-disposition'), 'attachment; filename="teng-parking-qr.png"');
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  } finally {
    await server.close();
  }
});

test('manual admin gate open creates a gate command for emergency control', async () => {
  const app = createApp({
    env: { ADMIN_GATE_TOKEN: 'admin-test-token' }
  });
  const server = await listen(app);

  try {
    const blocked = await request(server.baseUrl, '/api/gates/entry-1/open', { method: 'POST' });
    assert.equal(blocked.status, 401);

    const opened = await request(server.baseUrl, '/api/gates/entry-1/open', {
      method: 'POST',
      headers: { authorization: 'Bearer admin-test-token' },
      body: JSON.stringify({ sessionId: 'manual-entry' })
    });

    assert.equal(opened.status, 200);
    assert.equal(opened.body.gateCommand.action, 'OPEN_GATE');
    assert.equal(opened.body.gateCommand.sessionId, 'manual-entry');

    const command = await request(server.baseUrl, '/gate/entry-1/command');
    assert.equal(command.status, 200);
    assert.equal(command.body.action, 'OPEN_GATE');
  } finally {
    await server.close();
  }
});

test('manual admin gate open is disabled until an admin token is configured', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const opened = await request(server.baseUrl, '/api/gates/entry-1/open', {
      method: 'POST',
      headers: { authorization: 'Bearer anything' },
      body: JSON.stringify({ sessionId: 'manual-entry' })
    });

    assert.equal(opened.status, 503);
    assert.equal(opened.body.error, 'ADMIN_GATE_TOKEN is not configured');
  } finally {
    await server.close();
  }
});

test('marks an Opn session paid and opens the gate from charge.complete webhook', async () => {
  const app = createApp({
    env: {
      PAYMENT_PROVIDER: 'opn',
      OPN_PUBLIC_KEY: 'pkey_test_abc',
      OPN_SECRET_KEY: 'skey_test_abc'
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'chrg_test_webhook',
        status: 'pending',
        source: {
          scannable_code: {
            image: { download_uri: 'https://api.omise.co/webhook-qr.svg' }
          }
        }
      })
    })
  });
  const server = await listen(app);

  try {
    await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'UBON-1234', packageId: '1h', gateId: 'entry-1' })
    });

    const webhook = await request(server.baseUrl, '/api/payments/webhook/opn', {
      method: 'POST',
      body: JSON.stringify({
        key: 'charge.complete',
        data: {
          id: 'chrg_test_webhook',
          status: 'successful'
        }
      })
    });

    assert.equal(webhook.status, 202);
    assert.equal(webhook.body.paymentStatus, 'confirmed');
    assert.equal(webhook.body.gateCommand.action, 'OPEN_GATE');

    const command = await request(server.baseUrl, '/gate/entry-1/command');
    assert.equal(command.status, 200);
    assert.equal(command.body.action, 'OPEN_GATE');
  } finally {
    await server.close();
  }
});

test('creates a custom duration session from hourly or daily unit', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const hourly = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        plate: 'UBON-5555',
        packageId: 'custom',
        durationUnit: 'hour',
        durationValue: 4,
        gateId: 'entry-1'
      })
    });

    assert.equal(hourly.status, 201);
    assert.equal(hourly.body.session.packageId, 'custom-hour-4');
    assert.equal(hourly.body.payment.amountThb, 80);

    const daily = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        plate: 'UBON-7777',
        packageId: 'custom',
        durationUnit: 'day',
        durationValue: 3,
        gateId: 'entry-1'
      })
    });

    assert.equal(daily.status, 201);
    assert.equal(daily.body.session.packageId, 'custom-day-3');
    assert.equal(daily.body.payment.amountThb, 540);
  } finally {
    await server.close();
  }
});

test('finds a paid session for exit by license plate fallback', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    const created = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'ubon 1234', packageId: '1h', gateId: 'entry-1' })
    });
    await request(server.baseUrl, `/api/payments/${created.body.payment.id}/confirm`, { method: 'POST' });

    const exit = await request(server.baseUrl, '/api/sessions/exit', {
      method: 'POST',
      body: JSON.stringify({ plate: 'UBON-1234', gateId: 'exit-1' })
    });

    assert.equal(exit.status, 200);
    assert.equal(exit.body.session.id, created.body.session.id);
    assert.equal(exit.body.overtime.amountDueThb, 0);
    assert.equal(exit.body.gateCommand.action, 'OPEN_GATE');
  } finally {
    await server.close();
  }
});

test('records operations logs for entry, payment, and exit events', async () => {
  const app = createApp({
    env: { ADMIN_GATE_TOKEN: 'admin-test-token' }
  });
  const server = await listen(app);

  try {
    const created = await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'ubon 2468', packageId: '1h', gateId: 'entry-1' })
    });
    await request(server.baseUrl, `/api/payments/${created.body.payment.id}/confirm`, { method: 'POST' });
    await request(server.baseUrl, '/api/sessions/exit', {
      method: 'POST',
      body: JSON.stringify({ token: created.body.session.token, gateId: 'exit-1' })
    });

    const logs = await request(server.baseUrl, '/api/operations/logs', {
      headers: { authorization: 'Bearer admin-test-token' }
    });

    assert.equal(logs.status, 200);
    assert.deepEqual(logs.body.events.map((event) => event.eventType), [
      'entry_created',
      'payment_confirmed',
      'exit_approved'
    ]);
    assert.equal(logs.body.events[0].plate, 'ubon 2468');
    assert.equal(logs.body.events[0].normalizedPlate, 'UBON2468');
    assert.equal(logs.body.events[1].amountThb, 20);
    assert.equal(logs.body.events[2].gateId, 'exit-1');
  } finally {
    await server.close();
  }
});

test('exports operations logs as CSV for Google Sheets import', async () => {
  const app = createApp({
    env: { ADMIN_GATE_TOKEN: 'admin-test-token' }
  });
  const server = await listen(app);

  try {
    await request(server.baseUrl, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ plate: 'UBON-9999', packageId: '3h', gateId: 'entry-1' })
    });

    const response = await fetch(`${server.baseUrl}/api/operations/logs.csv`, {
      headers: { authorization: 'Bearer admin-test-token' }
    });
    const csv = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.match(csv, /Event ID,Session ID,Payment ID,Charge ID,Event Type/);
    assert.match(csv, /entry_created/);
    assert.match(csv, /UBON-9999/);
  } finally {
    await server.close();
  }
});
