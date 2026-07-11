const appRoot = document.querySelector('#appRoot');

const state = {
  plate: '',
  packages: [],
  customRates: null,
  overtimePolicy: null,
  durationUnit: 'hour',
  durationValue: 1,
  selectedPackageId: null,
  currentPaymentId: null,
  currentSession: null,
  currentPayment: null,
  currentOvertime: null,
  error: '',
  resetTimer: null
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function packageText(item) {
  return `${item.label} / ${item.amountThb} บาท / THB`;
}

function getCurrentRate() {
  return state.customRates?.[state.durationUnit] ?? {
    unit: state.durationUnit,
    minutes: state.durationUnit === 'day' ? 1440 : 60,
    amountThb: state.durationUnit === 'day' ? 180 : 20,
    min: 1,
    max: state.durationUnit === 'day' ? 30 : 24
  };
}

function getCustomEstimate() {
  const rate = getCurrentRate();
  return {
    amountThb: state.durationValue * rate.amountThb,
    durationMinutes: state.durationValue * rate.minutes,
    paidUntil: new Date(Date.now() + state.durationValue * rate.minutes * 60_000)
  };
}

function clampDuration(value) {
  const rate = getCurrentRate();
  return Math.min(rate.max, Math.max(rate.min, value));
}

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

async function copyToken(token, button) {
  try {
    await navigator.clipboard.writeText(token);
    button.textContent = 'คัดลอกแล้ว / Copied';
  } catch {
    const range = document.createRange();
    const tokenElement = document.querySelector('.pass-code');
    if (tokenElement) {
      range.selectNodeContents(tokenElement);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    button.textContent = 'เลือก token แล้ว / Token selected';
  }
}

function renderHub() {
  setScreen(`
    <section class="stage hub-stage">
      <img class="brand-logo hero-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">TENG Smart Parking</p>
        <h1>เลือกการใช้งาน / Choose action</h1>
        <p>ไม่ต้องโหลดแอป ไม่ต้องใช้บัตรกระดาษ / No app install, no paper ticket</p>
      </div>
      <div class="two-actions">
        <button class="choice-button entry" id="scanIn">สแกนเข้า<br /><span>Scan In</span></button>
        <button class="choice-button exit" id="scanOut">สแกนออก<br /><span>Scan Out</span></button>
      </div>
      <p class="screen-note">ระบบจอดรถอัจฉริยะโดย TENG Asset Co., Ltd.</p>
    </section>
  `);
  document.querySelector('#scanIn').addEventListener('click', () => navigate('/entry'));
  document.querySelector('#scanOut').addEventListener('click', () => navigate('/exit'));
}

function renderPlate() {
  setScreen(`
    <section class="stage form-stage">
      <button class="back-button" id="backHome">← เริ่มใหม่ / Restart</button>
      <img class="brand-logo flow-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">สแกนเข้า / Scan In</p>
        <h1>กรอกทะเบียนรถ / Enter plate</h1>
        <p>บริการให้เช่าพื้นที่จอดรถ ไม่ใช่บริการรับฝากรถ / Parking space rental, not vehicle custody</p>
      </div>
      <form class="single-form" id="plateForm">
        <input id="plateInput" value="${escapeHtml(state.plate)}" autocomplete="off" placeholder="UBON 1234" />
        <p class="inline-error">${escapeHtml(state.error)}</p>
        <button class="primary-action" type="submit">ต่อไป / Continue</button>
      </form>
    </section>
  `);
  document.querySelector('#backHome').addEventListener('click', () => navigate('/entry'));
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

async function loadPackagesOnce() {
  if (state.packages.length > 0) return state.packages;
  const data = await api('/api/packages');
  state.packages = data.packages;
  state.customRates = data.customRates;
  state.overtimePolicy = data.overtimePolicy;
  return state.packages;
}

async function renderPackages() {
  await loadPackagesOnce();
  state.durationValue = clampDuration(state.durationValue);
  const estimate = getCustomEstimate();
  const unitLabel = state.durationUnit === 'day' ? 'วัน / Days' : 'ชั่วโมง / Hours';
  const overtimeText = state.overtimePolicy
    ? `${state.overtimePolicy.disclosureTh} / ${state.overtimePolicy.disclosureEn}`
    : 'ค่าจอดเกินเวลา 20 บาทต่อชั่วโมง เศษเวลาปัดขึ้น / Overtime is rounded up hourly.';
  setScreen(`
    <section class="stage duration-stage">
      <button class="back-button" id="backPlate">← ทะเบียน / Plate</button>
      <img class="brand-logo flow-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">เลือกเวลา / Choose duration</p>
        <h1>กำหนดเวลาจอด / Set parking time</h1>
        <p>${escapeHtml(state.plate)}</p>
      </div>
      <div class="duration-panel">
        <div class="segmented-control" role="group" aria-label="Duration unit">
          <button class="${state.durationUnit === 'hour' ? 'active' : ''}" type="button" data-unit="hour">ชั่วโมง<br /><span>Hours</span></button>
          <button class="${state.durationUnit === 'day' ? 'active' : ''}" type="button" data-unit="day">วัน<br /><span>Days</span></button>
        </div>
        <div class="stepper-control">
          <button class="stepper-button" id="decreaseDuration" type="button">−</button>
          <div class="duration-value">
            <strong>${state.durationValue}</strong>
            <span>${unitLabel}</span>
          </div>
          <button class="stepper-button" id="increaseDuration" type="button">+</button>
        </div>
        <div class="price-preview">
          <span>ยอดชำระ / Amount</span>
          <strong>${estimate.amountThb} บาท / THB</strong>
          <small>ใช้ได้ถึง / Valid until ${formatDateTime(estimate.paidUntil)}</small>
        </div>
        <p class="policy-note">${escapeHtml(overtimeText)}</p>
      </div>
      <p class="inline-error">${escapeHtml(state.error)}</p>
      <button class="primary-action" id="createCustomQr" type="button">สร้าง QR / Generate QR</button>
    </section>
  `);
  document.querySelector('#backPlate').addEventListener('click', renderPlate);
  for (const button of document.querySelectorAll('[data-unit]')) {
    button.addEventListener('click', () => {
      state.durationUnit = button.dataset.unit;
      state.durationValue = 1;
      renderPackages();
    });
  }
  document.querySelector('#decreaseDuration').addEventListener('click', () => {
    state.durationValue = clampDuration(state.durationValue - 1);
    renderPackages();
  });
  document.querySelector('#increaseDuration').addEventListener('click', () => {
    state.durationValue = clampDuration(state.durationValue + 1);
    renderPackages();
  });
  document.querySelector('#createCustomQr').addEventListener('click', createCustomSessionAndPayment);
}

async function createSessionAndPayment(packageId, duration = {}) {
  try {
    state.error = '';
    state.selectedPackageId = packageId;
    const data = await api('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        plate: state.plate,
        packageId,
        ...duration,
        gateId: 'entry-1'
      })
    });

    state.currentSession = data.session;
    state.currentPayment = data.payment;
    state.currentPaymentId = data.payment.id;
    localStorage.setItem('tengParkingToken', data.session.token);
    localStorage.setItem('tengParkingPlate', data.session.plate);
    await renderPayment(data.payment);
  } catch (error) {
    state.error = `สร้าง QR ไม่สำเร็จ / QR failed: ${error.message}`;
    renderPackages();
  }
}

async function createCustomSessionAndPayment() {
  await createSessionAndPayment('custom', {
    durationUnit: state.durationUnit,
    durationValue: state.durationValue
  });
}

async function renderQr(canvas, qrText) {
  if (globalThis.QRCode?.toCanvas) {
    await globalThis.QRCode.toCanvas(canvas, qrText, {
      width: 260,
      margin: 1,
      color: {
        dark: '#171717',
        light: '#ffffff'
      }
    });
  }
}

async function renderPayment(payment) {
  setScreen(`
    <section class="stage pay-stage">
      <button class="back-button" id="backPackages">← เลือกเวลา / Duration</button>
      <img class="brand-logo flow-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">ชำระเงิน / Payment</p>
        <h1>สแกน QR เพื่อจ่าย / Scan to pay</h1>
        <p>ยอดชำระ / Amount: ${payment.amountThb} บาท / THB</p>
      </div>
      <div class="qr-panel">
        ${payment.qrImageUrl
          ? `<img class="qr-canvas qr-image" src="${escapeHtml(payment.qrImageUrl)}" alt="PromptPay QR" />`
          : '<canvas class="qr-canvas" id="qrCanvas" width="260" height="260" aria-label="Payment QR"></canvas>'}
      </div>
      <div class="pay-actions">
        ${payment.qrImageUrl
          ? `<a class="secondary-action" id="saveQr" href="/api/payments/${encodeURIComponent(payment.id)}/qr" download="teng-parking-qr.svg">บันทึก QR / Save QR</a>`
          : ''}
        <button class="primary-action" id="confirmPayment">เดโม: ยืนยันจ่ายแล้ว / Demo paid</button>
      </div>
      <p class="screen-note">เมื่อจ่ายสำเร็จ ระบบจะสั่ง ESP32 เปิดไม้กั้น / Payment success opens the ESP32 gate</p>
    </section>
  `);
  document.querySelector('#backPackages').addEventListener('click', renderPackages);
  document.querySelector('#confirmPayment').addEventListener('click', confirmDemoPayment);
  if (payment.qrText) await renderQr(document.querySelector('#qrCanvas'), payment.qrText);
}

async function confirmDemoPayment() {
  if (!state.currentPaymentId) {
    state.error = 'ยังไม่มีรายการจ่ายเงิน / No payment';
    return;
  }

  try {
    const data = await api(`/api/payments/${state.currentPaymentId}/confirm`, { method: 'POST' });
    state.currentSession = data.session;
    renderOpeningGate();
  } catch (error) {
    setScreen(`
      <section class="stage status-stage">
        <h1>จ่ายไม่สำเร็จ / Payment failed</h1>
        <p>${escapeHtml(error.message)}</p>
        <button class="primary-action" id="retryPay">ลองอีกครั้ง / Retry</button>
      </section>
    `);
    document.querySelector('#retryPay').addEventListener('click', () => renderPayment(state.currentPayment));
  }
}

function renderOpeningGate() {
  setScreen(`
    <section class="stage status-stage dark-stage">
      <img class="brand-logo hero-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">OPEN_GATE</p>
        <h1>กำลังเปิดไม้กั้น / Opening gate</h1>
        <p>กรุณารอสักครู่ / Please wait</p>
      </div>
      <div class="pulse-line" aria-hidden="true"></div>
    </section>
  `);
  state.resetTimer = window.setTimeout(renderPleaseEnter, 900);
}

function renderPleaseEnter() {
  const session = state.currentSession;
  setScreen(`
    <section class="stage pass-success-stage success-stage">
      <img class="brand-logo hero-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">Entry approved</p>
        <h1>เข้าได้เลย / Please enter</h1>
        <p>บัตรจอดอยู่บนหน้านี้แล้ว / Parking pass is shown here</p>
      </div>
      <div class="pass-panel compact-pass">
        <div><span>ทะเบียน / Plate</span><strong>${escapeHtml(session?.plate ?? '-')}</strong></div>
        <div><span>แพ็กเกจ / Package</span><strong>${escapeHtml(session?.packageId ?? '-')} / ${session?.amountThb ?? '-'} บาท</strong></div>
        <div><span>หมดเวลา / Paid until</span><strong>${formatDateTime(session?.paidUntil)}</strong></div>
      </div>
      <code class="pass-code">${escapeHtml(session?.token ?? '-')}</code>
      <button class="secondary-action" id="copyPassToken">คัดลอก token / Copy token</button>
      <button class="primary-action" id="goExitFromPass">สแกนออก / Scan Out</button>
      <p class="screen-note">หน้านี้คือบัตรจอด ใช้ token/ทะเบียนนี้ตอนออก / This is your parking pass</p>
    </section>
  `);
  document.querySelector('#copyPassToken').addEventListener('click', (event) => {
    copyToken(session?.token ?? '', event.currentTarget);
  });
  document.querySelector('#goExitFromPass').addEventListener('click', () => navigate('/exit'));
}

async function renderPass() {
  const token = new URL(location.href).searchParams.get('token') || localStorage.getItem('tengParkingToken');
  if (!token) {
    setScreen(`
      <section class="stage status-stage">
        <h1>ไม่พบบัตรจอด / Pass not found</h1>
        <p>กรุณากลับหน้าแรกหรือใช้ทะเบียนรถตอนออก / Return home or use plate at exit</p>
        <button class="primary-action" id="home">หน้าแรก / Home</button>
      </section>
    `);
    document.querySelector('#home').addEventListener('click', () => navigate('/'));
    return;
  }

  try {
    const data = await api(`/api/sessions/pass?token=${encodeURIComponent(token)}`);
    const session = data.session;
    setScreen(`
      <section class="stage pass-stage">
        <img class="brand-logo hero-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
        <div class="headline-block">
          <p class="eyebrow">บัตรจอดรถ / Parking Pass</p>
          <h1>${escapeHtml(session.plate)}</h1>
          <p>ใช้ QR นี้ตอนออก / Use this QR at exit</p>
        </div>
        <div class="pass-panel">
          <div><span>แพ็กเกจ / Package</span><strong>${escapeHtml(session.packageId)} / ${session.amountThb} บาท</strong></div>
          <div><span>หมดเวลา / Paid until</span><strong>${formatDateTime(session.paidUntil)}</strong></div>
          <div><span>สถานะ / Status</span><strong>${escapeHtml(session.status)}</strong></div>
        </div>
        <code class="pass-code">${escapeHtml(session.token)}</code>
        <button class="secondary-action" id="copyPassToken">คัดลอก token / Copy token</button>
        <button class="primary-action" id="goExit">สแกนออก / Scan Out</button>
      </section>
    `);
    document.querySelector('#copyPassToken').addEventListener('click', (event) => {
      copyToken(session.token, event.currentTarget);
    });
    document.querySelector('#goExit').addEventListener('click', () => navigate('/exit'));
  } catch (error) {
    setScreen(`
      <section class="stage status-stage">
        <h1>ไม่พบบัตรจอด / Pass not found</h1>
        <p>${escapeHtml(error.message)}</p>
        <button class="primary-action" id="home">หน้าแรก / Home</button>
      </section>
    `);
    document.querySelector('#home').addEventListener('click', () => navigate('/'));
  }
}

function renderExitLookup() {
  const savedPlate = localStorage.getItem('tengParkingPlate') || '';
  setScreen(`
    <section class="stage form-stage">
      <button class="back-button" id="backHome">← สแกนเข้า / Entry</button>
      <img class="brand-logo flow-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">สแกนออก / Scan Out</p>
        <h1>ตรวจบัตรจอด / Check parking pass</h1>
        <p>ใช้ token จากมือถือ หรือกรอกทะเบียน / Use token or plate fallback</p>
      </div>
      <form class="single-form" id="exitForm">
        <input id="exitToken" autocomplete="off" placeholder="Pass token" value="${escapeHtml(localStorage.getItem('tengParkingToken') || '')}" />
        <input id="exitPlate" autocomplete="off" placeholder="UBON 1234" value="${escapeHtml(savedPlate)}" />
        <p class="inline-error">${escapeHtml(state.error)}</p>
        <button class="primary-action" type="submit">ตรวจสิทธิ์ / Check pass</button>
      </form>
    </section>
  `);
  document.querySelector('#backHome').addEventListener('click', () => navigate('/entry'));
  document.querySelector('#exitForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = document.querySelector('#exitToken').value.trim();
    const plate = document.querySelector('#exitPlate').value.trim();
    await submitExitLookup({ token, plate });
  });
}

function renderChecking() {
  setScreen(`
    <section class="stage status-stage">
      <div class="headline-block">
        <p class="eyebrow">Checking</p>
        <h1>กำลังตรวจสิทธิ์ / Checking pass</h1>
        <p>กรุณารอสักครู่ / Please wait</p>
      </div>
      <div class="pulse-line" aria-hidden="true"></div>
    </section>
  `);
}

async function submitExitLookup({ token, plate }) {
  if (!token && !plate) {
    state.error = 'กรอก token หรือทะเบียน / Token or plate required';
    renderExitLookup();
    return;
  }

  try {
    state.error = '';
    renderChecking();
    const data = await api('/api/sessions/exit', {
      method: 'POST',
      body: JSON.stringify({ token, plate, gateId: 'exit-1' })
    });
    state.currentSession = data.session;
    state.currentOvertime = data.overtime;

    if (data.overtime.amountDueThb === 0) {
      renderExitApproved();
      return;
    }

    renderOvertime(data.overtime);
  } catch (error) {
    state.error = `ไม่พบบัตรจอด / Not found: ${error.message}`;
    renderExitLookup();
  }
}

function renderExitApproved() {
  setScreen(`
    <section class="stage status-stage success-stage">
      <img class="brand-logo hero-logo" src="/assets/teng-logo-gold.png" alt="TENG Asset logo" />
      <div class="headline-block">
        <p class="eyebrow">Exit approved</p>
        <h1>ออกได้เลย / Please exit</h1>
        <p>ระบบจะกลับหน้าแรกอัตโนมัติ / Returning to start screen</p>
      </div>
    </section>
  `);
  state.resetTimer = window.setTimeout(() => navigate('/'), 4000);
}

function renderOvertime(overtime) {
  setScreen(`
    <section class="stage pay-stage">
      <div class="headline-block">
        <p class="eyebrow">ชำระเพิ่ม / Overtime</p>
        <h1>เกินเวลา / Extra payment required</h1>
        <p>ยอดชำระเพิ่ม / Extra due: ${overtime.amountDueThb} บาท / THB</p>
      </div>
      <div class="qr-panel">
        <canvas class="qr-canvas" id="overtimeQr" width="260" height="260" aria-label="Overtime QR"></canvas>
      </div>
      <button class="primary-action" id="confirmOvertime">เดโม: จ่ายเพิ่มแล้ว / Demo paid</button>
    </section>
  `);
  const qrText = `DEMO_OVERTIME_QR:${overtime.amountDueThb}:${state.currentSession?.id ?? 'unknown'}`;
  renderQr(document.querySelector('#overtimeQr'), qrText);
  document.querySelector('#confirmOvertime').addEventListener('click', renderExitApproved);
}

async function renderRoute() {
  clearResetTimer();
  state.error = '';

  if (location.pathname === '/' || location.pathname === '/entry' || location.pathname === '/kiosk') {
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
  setScreen(`
    <section class="stage status-stage">
      <h1>ระบบขัดข้อง / System error</h1>
      <p>${escapeHtml(error.message)}</p>
      <button class="primary-action" id="home">หน้าแรก / Home</button>
    </section>
  `);
  document.querySelector('#home').addEventListener('click', () => navigate('/'));
});
