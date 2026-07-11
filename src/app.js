import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGateCommand, consumeGateCommand } from './core/gateCommands.js';
import { CUSTOM_DURATION_RATES } from './core/packages.js';
import {
  createOpnPromptPayCharge,
  getPaymentProviderStatus,
  parseOpnWebhook,
  verifyOpnWebhookSignature
} from './core/paymentProviders.js';
import { calculateOvertime, createSession, findSessionForExit } from './core/sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'web');
const OVERTIME_POLICY = Object.freeze({
  hourlyRateThb: 20,
  rounding: 'ceil_to_next_hour',
  disclosureTh: 'ค่าจอดเกินเวลา 20 บาทต่อชั่วโมง เศษเวลาปัดขึ้นเป็นชั่วโมงถัดไป',
  disclosureEn: 'Overtime is 20 THB per hour. Any partial hour is rounded up to the next hour.'
});

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function noContent(response) {
  response.writeHead(204);
  response.end();
}

function isDemoAuthRequired() {
  return Boolean(process.env.DEMO_PASSWORD);
}

function isAuthorized(request) {
  if (!isDemoAuthRequired()) return true;

  const header = request.headers.authorization ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return false;

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return user === (process.env.DEMO_USER ?? 'teng') && password === process.env.DEMO_PASSWORD;
}

function unauthorized(response) {
  response.writeHead(401, {
    'www-authenticate': 'Basic realm="TENG Smart Parking"',
    'content-type': 'text/plain; charset=utf-8'
  });
  response.end('Authentication required');
}

function isAdminGateAuthorized(request, env) {
  if (!env.ADMIN_GATE_TOKEN) return false;

  const authorization = request.headers.authorization ?? '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;
  const headerToken = request.headers['x-admin-token'];

  return bearerToken === env.ADMIN_GATE_TOKEN || headerToken === env.ADMIN_GATE_TOKEN;
}

async function parseJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function parseJsonWithRawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return {
    raw,
    body: raw ? JSON.parse(raw) : {}
  };
}

function serializeSession(session) {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    paidUntil: session.paidUntil.toISOString()
  };
}

function serializeCommand(command) {
  return {
    ...command,
    createdAt: command.createdAt.toISOString(),
    expiresAt: command.expiresAt.toISOString(),
    consumedAt: command.consumedAt ? command.consumedAt.toISOString() : null
  };
}

function decodeSvgEntityText(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#43;', '+')
    .replaceAll('&#x2B;', '+')
    .replaceAll('&#x2b;', '+');
}

function extractLargestEmbeddedPng(svgText) {
  const imageTags = svgText.match(/<image\b[^>]*>/gi) ?? [];
  let best = null;

  for (const tag of imageTags) {
    const hrefMatch = tag.match(/\bhref=["']data:image\/png;base64,([^"']+)["']/i);
    if (!hrefMatch) continue;

    const width = Number.parseFloat(tag.match(/\bwidth=["']([^"']+)["']/i)?.[1] ?? '0');
    const height = Number.parseFloat(tag.match(/\bheight=["']([^"']+)["']/i)?.[1] ?? '0');
    const area = Number.isFinite(width * height) ? width * height : 0;
    const base64 = decodeSvgEntityText(hrefMatch[1]).replace(/\s/g, '');
    const buffer = Buffer.from(base64, 'base64');

    if (!best || area > best.area || (area === best.area && buffer.length > best.buffer.length)) {
      best = { area, buffer };
    }
  }

  return best?.buffer ?? null;
}

async function createPayment({ session, env, fetchImpl }) {
  if (env.PAYMENT_PROVIDER === 'opn' && env.OPN_PUBLIC_KEY && env.OPN_SECRET_KEY) {
    const charge = await createOpnPromptPayCharge({
      amountThb: session.amountThb,
      sessionId: session.id,
      plate: session.plate,
      env,
      fetchImpl
    });

    return {
      id: `pay_${session.id.slice(5)}`,
      provider: 'opn',
      providerChargeId: charge.id,
      sessionId: session.id,
      amountThb: session.amountThb,
      status: charge.status === 'successful' ? 'confirmed' : 'pending',
      qrText: null,
      qrImageUrl: charge.qrImageUrl
    };
  }

  return {
    id: `pay_${session.id.slice(5)}`,
    provider: 'mock',
    providerChargeId: null,
    sessionId: session.id,
    amountThb: session.amountThb,
    status: 'pending',
    qrText: `DEMO_PROMPTPAY_QR:${session.amountThb}:${session.id}`,
    qrImageUrl: null
  };
}

function getStaticPathname(url) {
  const appRoutes = new Set(['/', '/entry', '/kiosk', '/pass', '/exit']);
  if (appRoutes.has(url.pathname)) return '/index.html';
  return url.pathname;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const pathname = getStaticPathname(url);
  const normalizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    json(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    }[ext] ?? 'application/octet-stream';

    response.writeHead(200, { 'content-type': contentType });
    response.end(content);
  } catch {
    json(response, 404, { error: 'Not found' });
  }
}

export function createApp({ env = process.env, fetchImpl = fetch } = {}) {
  const store = {
    sessions: [],
    payments: new Map(),
    commandsByGate: new Map()
  };

  return async function app(request, response) {
    const url = new URL(request.url, 'http://localhost');

    try {
      if (!isAuthorized(request)) {
        unauthorized(response);
        return;
      }

      if (request.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/gate/')) {
        await serveStatic(request, response);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/packages') {
        json(response, 200, {
          customRates: CUSTOM_DURATION_RATES,
          overtimePolicy: OVERTIME_POLICY,
          packages: [
            { id: '1h', label: '1 hour', amountThb: 20 },
            { id: '3h', label: '3 hours', amountThb: 50 },
            { id: '6h', label: '6 hours', amountThb: 80 },
            { id: '12h', label: '12 hours', amountThb: 120 },
            { id: '24h', label: '24 hours', amountThb: 180 }
          ]
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/payment-provider') {
        json(response, 200, getPaymentProviderStatus(env));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/payments/webhook/opn') {
        const { raw, body } = await parseJsonWithRawBody(request);
        const signature = verifyOpnWebhookSignature({
          rawBody: raw,
          signatureHeader: request.headers['omise-signature'],
          timestampHeader: request.headers['omise-signature-timestamp'],
          webhookSecret: env.OPN_WEBHOOK_SECRET
        });

        if (!signature.ok) {
          json(response, 401, { error: 'Invalid webhook signature', reason: signature.reason });
          return;
        }

        const parsedWebhook = parseOpnWebhook(body);
        let paymentStatus = null;
        let gateCommand = null;

        if (parsedWebhook.eventKey === 'charge.complete') {
          const payment = [...store.payments.values()].find(
            (item) => item.provider === 'opn' && item.providerChargeId === parsedWebhook.chargeId
          );
          const chargeStatus = body?.data?.status;

          if (payment && chargeStatus === 'successful') {
            payment.status = 'confirmed';
            paymentStatus = payment.status;
            const session = store.sessions.find((item) => item.id === payment.sessionId);

            if (session) {
              session.status = 'paid';
              gateCommand = createGateCommand({
                gateId: session.entryGateId,
                sessionId: session.id,
                now: new Date()
              });
              store.commandsByGate.set(gateCommand.gateId, gateCommand);
            }
          } else if (payment && chargeStatus) {
            payment.status = chargeStatus;
            paymentStatus = payment.status;
          }
        }

        json(response, 202, {
          ...parsedWebhook,
          signatureVerified: !signature.skipped,
          paymentStatus,
          gateCommand: gateCommand ? serializeCommand(gateCommand) : null
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/sessions') {
        const body = await parseJson(request);
        const session = {
          ...createSession({
            plate: body.plate,
            packageId: body.packageId,
            durationUnit: body.durationUnit,
            durationValue: body.durationValue,
            now: new Date()
          }),
          status: 'pending_payment',
          entryGateId: body.gateId ?? 'entry-1'
        };
        const payment = await createPayment({ session, env, fetchImpl });

        store.sessions.push(session);
        store.payments.set(payment.id, payment);

        json(response, 201, {
          session: serializeSession(session),
          payment
        });
        return;
      }

      const paymentQrMatch = url.pathname.match(/^\/api\/payments\/([^/]+)\/qr$/);
      if (request.method === 'GET' && paymentQrMatch) {
        const payment = store.payments.get(paymentQrMatch[1]);
        if (!payment?.qrImageUrl) {
          json(response, 404, { error: 'Payment QR not found' });
          return;
        }

        const upstream = await fetchImpl(payment.qrImageUrl);
        if (!upstream.ok) {
          json(response, 502, { error: 'Payment QR download failed' });
          return;
        }

        const contentType = upstream.headers?.get?.('content-type') ?? 'image/svg+xml';
        const sourceImage = Buffer.from(await upstream.arrayBuffer());
        let image = sourceImage;

        if (!contentType.includes('png')) {
          image = extractLargestEmbeddedPng(sourceImage.toString('utf8'));
          if (!image) {
            json(response, 502, { error: 'Payment QR PNG not found in provider image' });
            return;
          }
        }

        response.writeHead(200, {
          'content-type': 'image/png',
          'content-disposition': 'attachment; filename="teng-parking-qr.png"',
          'cache-control': 'no-store'
        });
        response.end(image);
        return;
      }

      const manualGateMatch = url.pathname.match(/^\/api\/gates\/([^/]+)\/open$/);
      if (request.method === 'POST' && manualGateMatch) {
        if (!env.ADMIN_GATE_TOKEN) {
          json(response, 503, { error: 'ADMIN_GATE_TOKEN is not configured' });
          return;
        }

        if (!isAdminGateAuthorized(request, env)) {
          json(response, 401, { error: 'Admin gate token required' });
          return;
        }

        const body = await parseJson(request);
        const gateCommand = createGateCommand({
          gateId: manualGateMatch[1],
          sessionId: body.sessionId ?? `manual_${Date.now()}`,
          now: new Date()
        });
        store.commandsByGate.set(gateCommand.gateId, gateCommand);

        json(response, 200, { gateCommand: serializeCommand(gateCommand) });
        return;
      }

      const paymentConfirmMatch = url.pathname.match(/^\/api\/payments\/([^/]+)\/confirm$/);
      if (request.method === 'POST' && paymentConfirmMatch) {
        const payment = store.payments.get(paymentConfirmMatch[1]);
        if (!payment) {
          json(response, 404, { error: 'Payment not found' });
          return;
        }

        payment.status = 'confirmed';
        const session = store.sessions.find((item) => item.id === payment.sessionId);
        session.status = 'paid';
        const gateCommand = createGateCommand({
          gateId: session.entryGateId,
          sessionId: session.id,
          now: new Date()
        });
        store.commandsByGate.set(gateCommand.gateId, gateCommand);

        json(response, 200, {
          session: serializeSession(session),
          payment,
          gateCommand: serializeCommand(gateCommand)
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/sessions/pass') {
        const token = url.searchParams.get('token');
        const session = store.sessions.find((item) => item.token === token && item.status !== 'closed');

        if (!session) {
          json(response, 404, { error: 'Session not found' });
          return;
        }

        json(response, 200, { session: serializeSession(session) });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/sessions/exit') {
        const body = await parseJson(request);
        const session = findSessionForExit({
          token: body.token,
          plate: body.plate,
          sessions: store.sessions,
          now: new Date()
        });

        if (!session || session.status !== 'paid') {
          json(response, 404, { error: 'Paid session not found' });
          return;
        }

        const overtime = calculateOvertime({ session, now: new Date() });
        let gateCommand = null;

        if (overtime.amountDueThb === 0) {
          gateCommand = createGateCommand({
            gateId: body.gateId ?? 'exit-1',
            sessionId: session.id,
            now: new Date()
          });
          store.commandsByGate.set(gateCommand.gateId, gateCommand);
        }

        json(response, 200, {
          session: serializeSession(session),
          overtime,
          gateCommand: gateCommand ? serializeCommand(gateCommand) : null
        });
        return;
      }

      const gateCommandMatch = url.pathname.match(/^\/gate\/([^/]+)\/command$/);
      if (request.method === 'GET' && gateCommandMatch) {
        const gateId = gateCommandMatch[1];
        const command = store.commandsByGate.get(gateId);
        if (!command) {
          noContent(response);
          return;
        }

        const result = consumeGateCommand({ command, now: new Date() });
        store.commandsByGate.set(gateId, result.command);

        if (result.status !== 'ok') {
          noContent(response);
          return;
        }

        json(response, 200, serializeCommand(result.command));
        return;
      }

      json(response, 404, { error: 'Not found' });
    } catch (error) {
      json(response, 500, { error: error.message });
    }
  };
}
