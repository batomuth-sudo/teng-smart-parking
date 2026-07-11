# TENG Smart Parking MVP Specification

Date: 2026-07-11

## Goal

Build a pilot-ready smart parking system for 10-20 bays that can prove business demand, operational reliability, and land-owner revenue sharing before investing in license-plate recognition or a full kiosk network.

## Parking Bay Sizing

Recommended bay size:

- Minimum: 2.40 m x 5.00 m
- Better pilot size: 2.50-2.70 m x 5.00-5.50 m
- SUV/pickup-friendly: 2.70 m x 5.50 m

Planning rule of thumb:

- Use 25-30 sq.m. per car when including aisles and turning space.
- 10 bays need about 250-300 sq.m.
- 20 bays need about 500-600 sq.m.

## Session Identity Strategy

The MVP should avoid a required app while still identifying the same customer at exit.

Use four layers:

1. Session URL token: unique link created at entry.
2. Browser storage token: stored in the customer's mobile browser.
3. License plate fallback: customer enters plate or partial plate at entry.
4. Admin evidence: optional entry photo or manual note for dispute handling.

The MVP should not require automatic license-plate recognition. LPR can be a phase-two module.

## Entry Flow

1. Customer scans entry QR.
2. Web app creates or resumes a session.
3. Customer enters license plate.
4. Customer selects package.
5. System creates a payment intent and QR.
6. Payment provider confirms payment by callback.
7. Server marks session as paid and sends `OPEN_GATE` command.
8. ESP32 opens the entry gate and reports the event.

## Exit Flow

1. Customer scans exit QR.
2. Web app looks for browser session token.
3. If token is missing, customer searches by license plate.
4. Server calculates remaining paid time or overtime.
5. If no overtime is due, server sends `OPEN_GATE`.
6. If overtime is due, customer pays the balance before exit opens.

## Hardware MVP

- ESP32 DevKitC or ESP32-S3 DevKitC
- Relay or optocoupler relay module
- Barrier gate with dry-contact input
- Magnetic or limit sensor for gate state
- Manual override button
- Weatherproof enclosure
- 12V/24V gate power and regulated 5V/3.3V controller power
- Wi-Fi or 4G router depending on site
- Optional UPS for router and controller

## Software MVP

- Node.js API for parking sessions, packages, payments, and gate commands
- Mobile web page for entry/exit
- ESP32 firmware polling or subscribing for gate commands
- Admin CSV/Google Sheet export for daily revenue

## Mobile QR Sign MVP Flow

The customer-facing MVP no longer requires an entry kiosk screen. A parking site can start with printed QR signs:

- `/entry` is printed on the entry sign and handles plate, duration, QR payment, ESP32 entry gate opening, and the parking pass.
- `/pass?token=...` shows the customer's mobile parking pass.
- `/exit` is printed on the exit sign and handles exit lookup, overtime check, ESP32 exit gate opening, and fallback plate search.

Every customer-facing screen must fit in one viewport without vertical or horizontal scrolling.

After payment succeeds, the customer phone stays on the parking pass screen with a Scan Out action instead of returning to a kiosk start screen.

Customer-facing legal copy should state: parking space rental, not vehicle custody. Final legal wording should be reviewed by a Thai lawyer before production use.

## Public Demo Link Strategy

For the free MVP stage, the live demo can run from this computer through Cloudflare Quick Tunnel:

- Local server runs on `http://127.0.0.1:8080`.
- Public demo URL is a temporary `trycloudflare.com` link.
- Demo access is protected by HTTP Basic Auth using `DEMO_USER` and `DEMO_PASSWORD`.
- The link updates immediately when frontend files change; backend code changes require restarting the local server.
- For a stable production URL, move to a named Cloudflare Tunnel with a real domain or a hosted Node service later.

## Payment Gateway Strategy

The production target is PromptPay QR through Opn Payments / Omise:

- `PAYMENT_PROVIDER=mock` works immediately for MVP testing and ESP32 gate tests.
- `PAYMENT_PROVIDER=opn` is scaffolded for real PromptPay integration once merchant KYC and API keys are ready.
- `/api/payment-provider` reports current provider readiness.
- `/api/payments/webhook/opn` is reserved for Opn webhook events.

Real secret keys must stay in local environment variables and must not be uploaded to Drive as plain text.

## Package Defaults

- Custom hourly parking: THB 20 per hour, 1-24 hours
- Custom daily parking: THB 180 per day, 1-30 days
- Preset packages can remain available internally for future promotions or quick buttons.
- Daily member: configurable
- Monthly member: configurable

## Overtime Disclosure

The duration selection screen must disclose the overtime rule before payment:

- Overtime rate: THB 20 per hour
- Rounding: any partial overtime hour is rounded up to the next full hour
- Example: 5 minutes overtime = THB 20, 61 minutes overtime = THB 40

## Safety And Fallback

- Manual override must work even if internet fails.
- Gate command must expire after a short time.
- Each command must be idempotent to avoid repeated opens.
- Payment confirmation must come from provider callback, not only uploaded slip images.
- If payment provider is not integrated yet, a manual admin approval mode may be used only for demo.
