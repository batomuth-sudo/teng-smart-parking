# TENG Smart Parking Hybrid Kiosk/Mobile MVP Design

Date: 2026-07-11

## Purpose

Build the next MVP flow so TENG Smart Parking feels like a real automated parking product while staying fast, cheap, and practical for a 10-20 bay pilot.

The current demo proves the backend, QR payment simulation, and ESP32 gate-command concept. The next version starts with a clear two-choice hub, then separates customer journeys into clear modes:

- Start hub with two primary choices: scan in and scan out.
- Kiosk entry mode for entering the parking lot.
- Mobile pass mode for the customer's digital parking ticket.
- Exit mode for checking entitlement and opening the exit gate.

The core UX rule is:

> Customer-facing screens must be no-scroll, single-purpose screens.

Each screen must fit inside one viewport without vertical or horizontal scrolling. If a step needs more information, it becomes the next screen instead of being added below the fold.

## Product Principles

1. One screen, one task.
2. Thai and English are shown together, not hidden behind a language toggle.
3. The customer never needs to install an app.
4. The customer should not need a paper slip.
5. The gate opens only after verified payment or a valid paid pass.
6. After a car enters or exits, the kiosk/exit screen resets automatically for the next customer.
7. License plate remains a low-cost fallback identity method until camera LPR is added later.

## Routes

The MVP should use separate routes while sharing the same backend state.

| Route | Purpose | Primary user |
| --- | --- | --- |
| `/` | Customer start hub with Scan In and Scan Out choices | Driver |
| `/kiosk` | Entry kiosk flow after Scan In | Driver entering the lot |
| `/pass?token=...` | Mobile digital parking pass | Driver on phone |
| `/exit` | Exit flow after Scan Out | Driver leaving the lot |

The first implementation will use `/pass?token=...` because it is faster to support with the current simple Node server. A cleaner `/pass/:token` route can be added later when routing is expanded.

## Start Hub

The first customer-facing screen must show exactly two primary choices:

1. "สแกนเข้า / Scan In"
2. "สแกนออก / Scan Out"

This screen is the default `/` route. It must be usable on a kiosk, tablet, or mobile browser and must stay no-scroll.

Content:

- TENG logo.
- Two large equal-weight action buttons: Scan In and Scan Out.
- Short trust line: "ไม่ต้องโหลดแอป / No app install".

Behavior:

- Scan In opens `/kiosk`.
- Scan Out opens `/exit`.
- No package list, status log, QR, or technical debug content appears on this screen.

## Kiosk Entry Flow

Kiosk mode is for the entry path after the driver chooses Scan In. It should feel like a self-service machine, not a dashboard.

### Screen 1: Plate

Goal: Capture fallback identity.

Content:

- License plate input.
- Continue button.
- Back button.

Behavior:

- Continue is disabled or shows an inline error if the plate is empty.
- Plate is normalized by the backend as it is today.
- Back returns to the Start Hub.

### Screen 2: Package

Goal: Choose paid parking duration.

Content:

- 1 hour, 3 hours, 6 hours, 12 hours, 24 hours packages.
- Each option shows price in THB.
- Back button.

Behavior:

- Selecting a package creates the parking session and payment intent.
- The selected session stores plate, package, token, entry gate ID, and payment ID.

### Screen 3: Pay QR

Goal: Complete payment.

Content:

- Large QR code.
- Amount due.
- Short message: "สแกนจ่ายแล้วรอยืนยัน / Scan and wait for confirmation".
- Demo payment button remains only for MVP testing.

Behavior:

- Production will wait for bank/payment-gateway callback.
- MVP can keep the demo confirm button, but it should be visually labeled as demo/test.
- On payment success, backend marks the session as paid and creates `OPEN_GATE` for `entry-1`.

### Screen 4: Opening Gate

Goal: Confirm that the barrier is opening.

Content:

- "กำลังเปิดไม้กั้น / Opening gate".
- Minimal progress indicator.

Behavior:

- The screen should stay briefly while the backend command is created.
- If gate command creation fails, show a clear error with retry and staff-call fallback.

### Screen 5: Please Enter

Goal: Tell the driver to enter now.

Content:

- "เข้าได้เลย / Please enter".
- Optional countdown, 3-5 seconds.

Behavior:

- After countdown, kiosk clears local state for this entry flow and returns to the Start Hub.
- The mobile pass token remains valid and can be opened from the QR/link shown during or after payment.

## Mobile Pass Flow

Mobile pass is the customer's digital ticket. It should be lighter than kiosk mode and optimized for phone screens.

### Pass Screen

Content:

- TENG logo and "บัตรจอดรถ / Parking Pass".
- Plate.
- Package.
- Paid-until time.
- Current status: paid, active, expired, or needs overtime payment.
- Exit instruction: "ใช้ QR นี้ตอนออก / Use this QR at exit".
- QR or token code for exit verification.

Behavior:

- The pass can be opened from `/pass?token=...`.
- The pass does not open the entry gate directly; entry gate is opened by payment success in kiosk flow.
- If the pass is expired, the pass screen directs the driver to the `/exit` flow, where overtime payment is calculated and collected.

## Exit Flow

Exit mode is for the exit point. It may run on another kiosk, a tablet, or a staff phone in the MVP.

### Screen 1: Exit Standby

Goal: Invite driver to scan or enter fallback identity.

Content:

- "สแกนบัตรจอด / Scan parking pass".
- Token input or plate input fallback.

Behavior:

- MVP can use typed token/plate fallback before camera scanning is added.
- Browser token can be used if the same phone opens the exit page.

### Screen 2: Checking

Goal: Show that the system is verifying pass validity.

Behavior:

- Backend finds session by token first, then plate fallback.
- Backend calculates overtime using paid-until time.

### Screen 3A: Exit Approved

Goal: Open the exit gate.

Content:

- "ออกได้เลย / Please exit".

Behavior:

- Backend creates `OPEN_GATE` for `exit-1`.
- Screen resets to the Start Hub after 3-5 seconds.

### Screen 3B: Overtime Payment Required

Goal: Collect additional payment before exit.

Content:

- Amount due.
- QR payment.
- Demo confirm button only for MVP testing.

Behavior:

- After overtime payment is confirmed, backend creates `OPEN_GATE` for `exit-1`.
- Screen shows Exit Approved and resets.

## Backend Data Flow

The existing backend concepts remain valid:

1. Package list comes from the current package API.
2. Session creation stores plate, package, token, payment state, gate IDs, and paid-until time.
3. Payment confirmation marks the session paid.
4. Gate commands are generated only after payment success or valid exit approval.
5. ESP32 polls or subscribes for commands by gate ID.
6. Each gate command remains single-use and expires quickly.

Needed backend additions:

- A pass lookup route that can return session status by token.
- A route-friendly way to serve `/`, `/kiosk`, `/pass?token=...`, and `/exit`.
- Optional response fields for kiosk screens: next route, pass URL, countdown seconds.

## ESP32 And Gate Control

The ESP32 role stays intentionally simple for the MVP:

- Connect to Wi-Fi.
- Poll `/gate/{gateId}/command`.
- If command is `OPEN_GATE`, pulse the relay for the configured duration.
- Report or log consumed command.

The barrier motor is not powered directly by ESP32. ESP32 controls a relay or dry-contact input, similar to pressing a physical open button on the barrier controller.

## No-Scroll UI Requirements

Every customer-facing screen must meet these layout rules:

- Viewport height: use a fixed full-screen layout such as `100vh` or `100dvh`.
- No vertical scrolling in normal kiosk and mobile sizes.
- No horizontal scrolling at any size.
- Primary action must be visible without scrolling.
- QR code must remain fully visible with its amount and one short instruction.
- Text must be short enough to fit Thai and English together.
- Long technical status/debug logs must not appear on customer screens.
- Development-only details may be hidden behind a debug flag or separate internal route.

Target screen classes:

- Kiosk/tablet landscape: 1024 x 768 and larger.
- Kiosk portrait: 768 x 1024.
- Mobile pass: 360 x 740 and larger.

## Error Handling

Error screens should still be one-screen, one-task.

Examples:

- Empty plate: stay on Plate screen and show a short inline error.
- Payment failed: stay on Pay QR screen and allow retry.
- Gate command failed: show "เรียกเจ้าหน้าที่ / Call staff" and retry.
- Session not found at exit: return to Exit Standby with plate fallback.
- Internet unavailable: show offline message and staff-call fallback.

## Testing And Verification

Implementation should be verified with:

- Existing API tests must continue to pass.
- New route tests for `/`, `/kiosk`, `/pass`, and `/exit`.
- Browser checks for no horizontal overflow.
- Browser checks for no vertical scroll on customer screens at target viewport sizes.
- Manual flow test:
  1. Start Hub shows Scan In and Scan Out.
  2. Scan In opens Kiosk Entry.
  3. Enter plate.
  4. Select package.
  5. Generate QR.
  6. Confirm demo payment.
  7. Entry gate command created.
  8. Please Enter screen appears.
  9. Kiosk returns to Start Hub.
  10. Pass route can show the session.
  11. Scan Out opens Exit.
  12. Exit route can approve exit and create `OPEN_GATE` for `exit-1`.

## Out Of Scope For This MVP

- Real bank/payment gateway production integration.
- Camera-based license plate recognition.
- Full admin dashboard.
- Member subscription management.
- Multi-site owner reporting.
- Hardware cabinet industrial design.

These are intentionally deferred so the pilot can launch faster and prove revenue sharing with land owners.

## Success Criteria

The design is successful when a first-time driver can enter and exit without staff help, without downloading an app, without a paper ticket, and without seeing more than one task per screen.

For the business demo, the system should look credible enough to show a vacant-land owner how the site can become paid parking with automated access control and revenue tracking.
