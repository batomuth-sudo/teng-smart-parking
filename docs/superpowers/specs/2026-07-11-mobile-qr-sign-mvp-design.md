# TENG Smart Parking Mobile QR Sign MVP Design

Date: 2026-07-11

## Goal

Replace the kiosk-first MVP with a lower-cost mobile-first parking flow. The site only needs printed QR signs at entry and exit, plus ESP32 gate controllers.

## Customer Flow

Entry sign QR opens `/entry`.

1. Customer scans the entry sign.
2. Customer enters license plate.
3. Customer chooses hours or days.
4. Customer pays by QR payment.
5. Payment confirmation marks the session paid.
6. Backend creates `OPEN_GATE` for the entry ESP32.
7. Customer phone shows the parking pass and exit instructions.

Exit sign QR opens `/exit`.

1. Customer scans exit sign.
2. System uses browser token if present.
3. If token is missing, customer enters license plate.
4. Backend checks paid time.
5. If valid, backend creates `OPEN_GATE` for the exit ESP32.
6. If overtime exists, customer pays the extra amount first.

## Payment Strategy

The production target is PromptPay QR through Opn Payments / Omise because it supports Thailand PromptPay QR, API charges, and webhooks.

The MVP keeps two payment providers:

- `mock`: works immediately for local testing and ESP32 gate testing.
- `opn`: scaffolded for real PromptPay integration once merchant onboarding, KYC, and secret keys are ready.

Secrets must not be committed or uploaded to Drive as raw keys. Keep real keys in local environment variables.

## Routes

- `/` redirects or shows the same entry flow as `/entry`.
- `/entry` customer entry QR flow.
- `/pass?token=...` parking pass.
- `/exit` customer exit QR flow.
- `/api/payments/webhook/opn` receives future Opn/Omise webhook events.

## Legal/Operations Copy

The customer-facing flow should say this is parking space rental, not vehicle custody:

> บริการให้เช่าพื้นที่จอดรถ ไม่ใช่บริการรับฝากรถ / Parking space rental, not vehicle custody.

Final legal wording should be reviewed by a Thai lawyer before production use.

## Out Of Scope For This Step

- Completing payment gateway KYC.
- Storing real payment secret keys in Drive.
- Production database persistence.
- LPR camera integration.
