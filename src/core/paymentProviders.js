import crypto from 'node:crypto';

const PROVIDERS = Object.freeze({
  mock: Object.freeze({
    provider: 'mock',
    ready: true,
    mode: 'demo',
    message: 'Mock payment is ready for local gate testing.'
  }),
  opn: Object.freeze({
    provider: 'opn',
    ready: false,
    mode: 'promptpay',
    message: 'Set OPN_PUBLIC_KEY and OPN_SECRET_KEY after merchant onboarding.'
  })
});

export function getPaymentProviderStatus(env = process.env) {
  const provider = env.PAYMENT_PROVIDER ?? 'mock';

  if (provider === 'opn') {
    const ready = Boolean(env.OPN_PUBLIC_KEY && env.OPN_SECRET_KEY);
    return {
      ...PROVIDERS.opn,
      ready,
      message: ready
        ? 'Opn PromptPay configuration is present.'
        : PROVIDERS.opn.message
    };
  }

  return PROVIDERS.mock;
}

export function parseOpnWebhook(body) {
  return {
    received: true,
    provider: 'opn',
    eventKey: body?.key ?? null,
    chargeId: body?.data?.id ?? null
  };
}

export function getOpnQrImageUrl(charge) {
  return charge?.source?.scannable_code?.image?.download_uri ?? null;
}

export async function createOpnPromptPayCharge({
  amountThb,
  sessionId,
  plate,
  env = process.env,
  fetchImpl = fetch
}) {
  if (!env.OPN_SECRET_KEY) {
    throw new Error('OPN_SECRET_KEY is required to create an Opn PromptPay charge.');
  }

  const body = new URLSearchParams();
  body.set('amount', String(Math.round(amountThb * 100)));
  body.set('currency', 'THB');
  body.set('source[type]', 'promptpay');
  body.set('metadata[session_id]', sessionId);
  body.set('metadata[plate]', plate);

  const authorization = Buffer.from(`${env.OPN_SECRET_KEY}:`).toString('base64');
  const response = await fetchImpl('https://api.omise.co/charges', {
    method: 'POST',
    headers: {
      authorization: `Basic ${authorization}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    const sanitized = errorText.replaceAll(env.OPN_SECRET_KEY, '[redacted]');
    throw new Error(`Opn PromptPay charge failed: ${response.status} ${sanitized}`);
  }

  const charge = await response.json();
  return {
    id: charge.id,
    status: charge.status,
    qrImageUrl: getOpnQrImageUrl(charge),
    raw: charge
  };
}

export function verifyOpnWebhookSignature({
  rawBody,
  signatureHeader,
  timestampHeader,
  webhookSecret,
  now = new Date(),
  toleranceSeconds = 300
}) {
  if (!webhookSecret) return { ok: true, skipped: true };
  if (!rawBody || !signatureHeader || !timestampHeader) {
    return { ok: false, reason: 'missing_signature_headers' };
  }

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: 'invalid_signature_timestamp' };
  }

  const ageSeconds = Math.abs(Math.floor(now.getTime() / 1000) - timestampSeconds);
  if (ageSeconds > toleranceSeconds) {
    return { ok: false, reason: 'signature_timestamp_outside_tolerance' };
  }

  let secret;
  try {
    secret = Buffer.from(webhookSecret, 'base64');
  } catch {
    return { ok: false, reason: 'invalid_webhook_secret' };
  }

  const signedPayload = `${timestampHeader}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest();
  const signatures = signatureHeader.split(',').map((item) => item.trim()).filter(Boolean);

  for (const signature of signatures) {
    const actual = Buffer.from(signature, 'hex');
    if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
      return { ok: true, skipped: false };
    }
  }

  return { ok: false, reason: 'signature_mismatch' };
}
