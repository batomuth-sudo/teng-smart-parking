# Hybrid Kiosk/Mobile MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current single-page demo into a pilot-ready hybrid MVP with a no-scroll two-button start hub, entry kiosk flow, mobile pass view, and exit flow.

**Architecture:** Keep the existing dependency-free Node.js server and in-memory MVP store. Serve the same frontend shell for `/`, `/kiosk`, `/pass`, and `/exit`, then let a small client-side state machine render one customer task per screen. Add only the backend lookup needed for the mobile pass.

**Tech Stack:** Node.js ESM, native `node:http`, native `node:test`, vanilla HTML/CSS/JS, QRCode CDN, ESP32 polling API already present.

## Global Constraints

- Customer-facing screens must be no-scroll, single-purpose screens.
- Thai and English are shown together, not hidden behind a language toggle.
- The customer never needs to install an app.
- The customer should not need a paper slip.
- The gate opens only after verified payment or a valid paid pass.
- After a car enters or exits, the kiosk/exit screen resets automatically for the next customer.
- The first screen at `/` must show exactly two primary choices: `สแกนเข้า / Scan In` and `สแกนออก / Scan Out`.
- First implementation uses `/pass?token=...` instead of `/pass/:token`.
- Do not add a frontend framework or build step.
- This folder is not a git repository, so replace commit steps with a local test run and Drive snapshot update.

---

## File Structure

- Modify `src/app.js`: add app-shell routing for `/`, `/kiosk`, `/pass`, `/exit`; add `GET /api/sessions/pass?token=...`; improve static MIME type for PNG logo if needed.
- Modify `web/index.html`: reduce the shell to one root app container and keep QRCode script.
- Replace `web/app.js`: implement the route-aware UI state machine and API calls.
- Replace `web/styles.css`: implement full-screen no-scroll customer screens.
- Modify `tests/api/app.test.js`: cover app routes and pass lookup endpoint.
- Update `docs/mvp-spec.md`: add the approved hybrid MVP flow summary.
- Update `outputs/teng-smart-parking-code-snapshot.zip`: include the finished code.

---

### Task 1: Backend Routes And Pass Lookup

**Files:**
- Modify: `src/app.js`
- Modify: `tests/api/app.test.js`

**Interfaces:**
- Consumes: existing `createApp()`, `serializeSession(session)`, in-memory `store.sessions`.
- Produces: `GET /`, `GET /kiosk`, `GET /pass`, `GET /exit` all serve `web/index.html`; `GET /api/sessions/pass?token=...` returns `{ session }` or `404`.

- [ ] **Step 1: Write failing route and pass lookup tests**

Add these tests to `tests/api/app.test.js`:

```js
test('serves customer app shell for hub, kiosk, pass, and exit routes', async () => {
  const app = createApp();
  const server = await listen(app);

  try {
    for (const route of ['/', '/kiosk', '/pass?token=demo', '/exit']) {
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
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

Expected: the new pass lookup test fails with `404` or route handling failure.

- [ ] **Step 3: Implement route shell and pass lookup**

In `src/app.js`, replace `serveStatic` pathname selection with route-aware shell serving:

```js
function getStaticPathname(url) {
  const appRoutes = new Set(['/', '/kiosk', '/pass', '/exit']);
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
```

Add this API branch before `/api/sessions/exit`:

```js
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
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

Expected: all tests pass.

---

### Task 2: Frontend Shell And State Machine

**Files:**
- Modify: `web/index.html`
- Replace: `web/app.js`

**Interfaces:**
- Consumes: `GET /api/packages`, `POST /api/sessions`, `POST /api/payments/:id/confirm`, `GET /api/sessions/pass?token=...`, `POST /api/sessions/exit`.
- Produces: route-aware screens: hub, entry plate, package, pay, opening, enter, pass, exit lookup, checking, exit approved, overtime.

- [ ] **Step 1: Write manual test checklist before implementation**

Create this checklist in the implementation notes for the task:

```text
Manual frontend flow:
1. / shows exactly Scan In and Scan Out as primary buttons.
2. Scan In navigates to /kiosk and shows plate entry only.
3. Empty plate shows inline error on the same screen.
4. Valid plate moves to package selection.
5. Selecting a package creates a QR payment.
6. Demo confirm moves through Opening Gate to Please Enter.
7. Please Enter auto-resets to / after 3-5 seconds.
8. /pass?token=<token> shows the parking pass.
9. Scan Out opens /exit.
10. Exit by plate opens exit gate and returns to /.
```

- [ ] **Step 2: Simplify HTML shell**

Replace the body content in `web/index.html` with:

```html
<body>
  <main class="screen" id="appRoot" aria-live="polite"></main>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
  <script src="/app.js"></script>
</body>
```

Keep the `<head>`, title, stylesheet link, and viewport meta.

- [ ] **Step 3: Replace client app with route-aware renderer**

Replace `web/app.js` with these top-level building blocks:

```js
const appRoot = document.querySelector('#appRoot');

const state = {
  plate: '',
  packages: [],
  selectedPackageId: null,
  currentPaymentId: null,
  currentSession: null,
  error: '',
  resetTimer: null
};

function clearResetTimer() {
  if (state.resetTimer) window.clearTimeout(state.resetTimer);
  state.resetTimer = null;
}

function navigate(path) {
  clearResetTimer();
  history.pushState({}, '', path);
  renderRoute();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body;
}

function setScreen(html) {
  appRoot.innerHTML = html;
}
```

Implement render functions with these exact screen responsibilities:

```js
function renderHub() {
  setScreen(`
    <section class="stage hub-stage">
      <img class="brand-logo hero-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">TENG Smart Parking</p>
        <h1>เลือกการใช้งาน / Choose action</h1>
        <p>ไม่ต้องโหลดแอป / No app install</p>
      </div>
      <div class="two-actions">
        <button class="choice-button entry" id="scanIn">สแกนเข้า<br /><span>Scan In</span></button>
        <button class="choice-button exit" id="scanOut">สแกนออก<br /><span>Scan Out</span></button>
      </div>
    </section>
  `);
  document.querySelector('#scanIn').addEventListener('click', () => navigate('/kiosk'));
  document.querySelector('#scanOut').addEventListener('click', () => navigate('/exit'));
}

function renderPlate() {
  setScreen(`
    <section class="stage form-stage">
      <button class="back-button" id="backHome">← หน้าแรก / Home</button>
      <div class="headline-block">
        <p class="eyebrow">สแกนเข้า / Scan In</p>
        <h1>กรอกทะเบียนรถ / Enter plate</h1>
        <p>ใช้ค้นบัตรจอดตอนออก / Used as exit fallback</p>
      </div>
      <form class="single-form" id="plateForm">
        <input id="plateInput" value="${state.plate}" autocomplete="off" placeholder="UBON 1234" />
        <p class="inline-error">${state.error}</p>
        <button class="primary-action" type="submit">ต่อไป / Continue</button>
      </form>
    </section>
  `);
  document.querySelector('#backHome').addEventListener('click', () => navigate('/'));
  document.querySelector('#plateForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const plate = document.querySelector('#plateInput').value.trim();
    if (!plate) {
      state.error = 'กรุณากรอกทะเบียน / Plate required';
      renderPlate();
      return;
    }
    state.plate = plate;
    state.error = '';
    renderPackages();
  });
}
```

Continue the same pattern for packages, QR pay, opening, enter, pass, and exit. Keep every rendered screen inside one `.stage` element.

- [ ] **Step 4: Implement package, pay, pass, and exit actions**

Use these function names so tests and future workers can find behavior:

```js
async function loadPackagesOnce() {}
function renderPackages() {}
async function createSessionAndPayment(packageId) {}
async function renderPayment(payment) {}
async function confirmDemoPayment() {}
function renderOpeningGate() {}
function renderPleaseEnter() {}
async function renderPass() {}
function renderExitLookup() {}
async function submitExitLookup({ token, plate }) {}
function renderExitApproved() {}
function renderOvertime(overtime) {}
```

Key behavior:

- `loadPackagesOnce()` caches package API results in `state.packages`.
- `createSessionAndPayment(packageId)` posts `{ plate: state.plate, packageId, gateId: 'entry-1' }`.
- Store `tengParkingToken` and `tengParkingPlate` in `localStorage` after session creation.
- `renderPayment(payment)` draws QR with `QRCode.toCanvas`.
- `confirmDemoPayment()` posts to `/api/payments/${state.currentPaymentId}/confirm`, then calls `renderOpeningGate()`.
- `renderOpeningGate()` waits about 900 ms, then calls `renderPleaseEnter()`.
- `renderPleaseEnter()` starts a 4 second timer, then `navigate('/')`.
- `renderPass()` reads token from `new URL(location.href).searchParams.get('token')`.
- `submitExitLookup()` posts to `/api/sessions/exit` with `{ token, plate, gateId: 'exit-1' }`.
- If exit `overtime.amountDueThb === 0`, show exit approved and reset to `/`.
- If overtime is due, show the amount and a demo confirm button for MVP.

- [ ] **Step 5: Wire route rendering**

At the bottom of `web/app.js`, add:

```js
async function renderRoute() {
  clearResetTimer();
  state.error = '';

  if (location.pathname === '/') {
    renderHub();
    return;
  }

  if (location.pathname === '/kiosk') {
    renderPlate();
    return;
  }

  if (location.pathname === '/pass') {
    await renderPass();
    return;
  }

  if (location.pathname === '/exit') {
    renderExitLookup();
    return;
  }

  renderHub();
}

window.addEventListener('popstate', renderRoute);
renderRoute().catch((error) => {
  setScreen(`<section class="stage"><h1>ระบบขัดข้อง / System error</h1><p>${error.message}</p><button class="primary-action" id="home">หน้าแรก / Home</button></section>`);
  document.querySelector('#home').addEventListener('click', () => navigate('/'));
});
```

- [ ] **Step 6: Run local smoke test**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

Expected: backend tests still pass. Frontend flow will be visually verified in Task 4.

---

### Task 3: No-Scroll Customer Screen Styling

**Files:**
- Replace: `web/styles.css`

**Interfaces:**
- Consumes: `.screen`, `.stage`, `.hub-stage`, `.form-stage`, `.choice-button`, `.primary-action`, `.back-button`, `.inline-error`, `.qr-canvas`, `.pass-code`.
- Produces: fixed one-screen layout with no body scroll for customer routes.

- [ ] **Step 1: Replace CSS with screen system**

Implement these base rules in `web/styles.css`:

```css
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --ink: #171717;
  --graphite: #232521;
  --paper: #fffdf8;
  --porcelain: #f6f4ef;
  --gold: #c8a24a;
  --cyan: #0f9aa7;
  --green: #137a55;
  --line: #ded8c9;
  --muted: #6b6a63;
  --danger: #b54c35;
}

* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
body {
  min-width: 320px;
  background: linear-gradient(180deg, #fffdf8 0%, #f6f4ef 100%);
  color: var(--ink);
}

.screen {
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
}

.stage {
  width: min(100%, 1180px);
  height: 100%;
  margin: 0 auto;
  display: grid;
  gap: 18px;
  align-content: center;
  padding: clamp(16px, 3vw, 34px);
}
```

- [ ] **Step 2: Add component styling**

Add styling for brand, buttons, forms, QR, and status:

```css
.brand-logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
  padding: 8px;
  border: 1px solid rgba(200, 162, 74, 0.5);
  border-radius: 8px;
  background: #171717;
}

.hero-logo { justify-self: center; width: 92px; height: 92px; }
.headline-block { display: grid; gap: 8px; text-align: center; }
.eyebrow { margin: 0; color: var(--gold); font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; }
h1 { margin: 0; font-size: 42px; line-height: 1.05; letter-spacing: 0; }
p { margin: 0; color: var(--muted); line-height: 1.45; }

.two-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.choice-button,
.primary-action,
.back-button {
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.choice-button {
  min-height: 220px;
  color: #fffdf8;
  font-size: 36px;
  box-shadow: 0 18px 48px rgba(35, 37, 33, 0.16);
}

.choice-button span { font-size: 24px; }
.choice-button.entry { background: var(--green); }
.choice-button.exit { background: var(--graphite); }
.primary-action { min-height: 58px; padding: 0 18px; background: var(--green); color: #fff; }
.back-button { min-height: 46px; justify-self: start; padding: 0 14px; background: #eee7d8; color: var(--graphite); }
```

Add responsive rules:

```css
@media (max-width: 680px) {
  .stage { padding: 14px; gap: 14px; }
  h1 { font-size: 32px; }
  .two-actions { grid-template-columns: 1fr; }
  .choice-button { min-height: 150px; font-size: 30px; }
  .choice-button span { font-size: 20px; }
}

@media (max-height: 620px) {
  .brand-logo.hero-logo { width: 70px; height: 70px; }
  h1 { font-size: 30px; }
  .choice-button { min-height: 128px; }
}
```

- [ ] **Step 3: Add no-scroll safety for dynamic content**

Add:

```css
.single-form,
.package-grid,
.pass-panel,
.qr-panel {
  min-height: 0;
}

.single-form {
  display: grid;
  gap: 12px;
}

input {
  width: 100%;
  min-height: 60px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 16px;
  font: inherit;
  font-size: 22px;
}

.inline-error {
  min-height: 24px;
  color: var(--danger);
  font-weight: 800;
}

.package-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.package-card {
  min-height: 120px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-weight: 900;
}

.qr-canvas {
  width: min(260px, 58vw, 34vh);
  height: min(260px, 58vw, 34vh);
  background: #fff;
  border-radius: 8px;
}

@media (max-width: 760px) {
  .package-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .package-card { min-height: 88px; }
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

Expected: all API tests pass.

---

### Task 4: Browser Verification And Flow QA

**Files:**
- No source files unless QA finds defects.

**Interfaces:**
- Consumes: running local server at `http://127.0.0.1:8080/`.
- Produces: verified screenshots/checks for no-scroll routes and basic customer flow.

- [ ] **Step 1: Start or reuse local server**

Run if needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-web.ps1
```

Expected: server available at `http://127.0.0.1:8080/`.

- [ ] **Step 2: Verify no-scroll by browser evaluation**

Use in-app browser and evaluate these checks for `/`, `/kiosk`, and `/exit`:

```js
({
  path: location.pathname,
  width: innerWidth,
  height: innerHeight,
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  verticalOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  primaryButtons: [...document.querySelectorAll('button')].map((button) => button.textContent.trim())
})
```

Expected:

- `/` has exactly two primary choice buttons containing `Scan In` and `Scan Out`.
- `horizontalOverflow` is `false`.
- `verticalOverflow` is `false`.

- [ ] **Step 3: Verify entry flow manually**

In browser:

1. Open `/`.
2. Click `สแกนเข้า / Scan In`.
3. Submit empty plate.
4. Confirm inline error appears.
5. Enter `UBON 1234`.
6. Continue.
7. Select `1 hour`.
8. Confirm QR screen appears.
9. Click demo confirm.
10. Confirm Opening Gate then Please Enter appear.
11. Wait 4 seconds.
12. Confirm route returns to `/`.

Expected: no customer-facing step requires scrolling.

- [ ] **Step 4: Verify pass and exit flow manually**

Use the token from localStorage or pass URL produced during entry:

1. Open `/pass?token=<token>`.
2. Confirm pass shows plate, package, paid-until, and exit instruction.
3. Open `/`.
4. Click `สแกนออก / Scan Out`.
5. Enter plate `UBON 1234`.
6. Submit.
7. Confirm `Please exit` appears.
8. Wait 4 seconds.
9. Confirm route returns to `/`.

Expected: `GET /gate/exit-1/command` returns one `OPEN_GATE` command after approval.

- [ ] **Step 5: Fix any QA defects and rerun tests**

If a defect is found, make the smallest source edit that fixes it, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

Expected: all tests pass after fixes.

---

### Task 5: Documentation And Drive Snapshot

**Files:**
- Modify: `docs/mvp-spec.md`
- Update: `outputs/teng-smart-parking-code-snapshot.zip`

**Interfaces:**
- Consumes: final verified implementation.
- Produces: local documentation and Drive-backed project memory.

- [ ] **Step 1: Update MVP spec summary**

Add this section to `docs/mvp-spec.md`:

```md
## Hybrid Kiosk/Mobile MVP Flow

The customer-facing MVP uses separate one-screen flows:

- `/` shows two choices: Scan In and Scan Out.
- `/kiosk` handles entry: plate, package, QR payment, gate opening, and auto-reset.
- `/pass?token=...` shows the customer's mobile parking pass.
- `/exit` handles exit lookup, overtime check, exit gate opening, and auto-reset.

Every customer-facing screen must fit in one viewport without vertical or horizontal scrolling.
```

- [ ] **Step 2: Run final verification**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

Expected: all tests pass.

- [ ] **Step 3: Create updated code snapshot**

Run:

```powershell
Compress-Archive -Path README.md,package.json,run-web.ps1,run-tests.ps1,src,web,firmware,docs,tests -DestinationPath outputs\teng-smart-parking-code-snapshot.zip -Force
```

Expected: `outputs\teng-smart-parking-code-snapshot.zip` exists and includes updated source.

- [ ] **Step 4: Update Google Drive code snapshot**

Use Google Drive `_update_file` with:

```text
fileId: 1TofTttlE21iz48QDd1ZumN2yG-oYZ-xO
file_uri: C:\Users\LENOVO\OneDrive\Documents\TENG-Parking\outputs\teng-smart-parking-code-snapshot.zip
mime_type: application/zip
name: teng-smart-parking-code-snapshot.zip
```

Expected: Drive update succeeds and keeps the same share URL.

- [ ] **Step 5: Update Google Drive MVP spec**

Upload or update `docs/mvp-spec.md` in the TENG Smart Parking Drive folder.

Expected: Drive contains the latest MVP flow summary for future conversations.

---

## Self-Review

Spec coverage:

- Two-button start hub: Task 2 and Task 4.
- No-scroll one-screen customer screens: Task 3 and Task 4.
- `/kiosk`, `/pass?token=...`, `/exit` routes: Task 1 and Task 2.
- Kiosk entry payment and auto reset: Task 2 and Task 4.
- Mobile pass lookup: Task 1 and Task 2.
- Exit lookup and gate command: Task 2 and Task 4.
- ESP32 command behavior remains covered by existing tests and Task 1 regression checks.
- Drive memory: Task 5.

Placeholder scan:

- No unfinished placeholders or vague error-handling steps are intentionally left in this plan.

Type consistency:

- `state.currentPaymentId`, `state.currentSession`, `renderRoute()`, `renderPass()`, and `submitExitLookup()` names are used consistently across tasks.
