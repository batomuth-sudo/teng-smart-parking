# Mobile QR Sign MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TENG Smart Parking usable without a kiosk: printed QR signs open mobile entry/exit flows, payment success opens ESP32 gates.

**Architecture:** Keep the current Node.js MVP server and vanilla frontend. Add a small payment provider boundary so mock payments work now and Opn/Omise can be connected with environment variables later.

**Tech Stack:** Node.js ESM, native `node:test`, vanilla HTML/CSS/JS, QRCode CDN, Cloudflare Quick Tunnel for public demo.

## Global Constraints

- No kiosk is required for MVP.
- Entry sign URL is `/entry`.
- Exit sign URL is `/exit`.
- Customer screens must stay mobile-first and no-scroll where practical.
- Payment provider defaults to `mock`.
- Real gateway secrets must be read from environment variables, not code or Drive.

---

### Task 1: Backend Payment Provider Boundary

- Add tests for `/api/payment-provider` and `/api/payments/webhook/opn`.
- Add `src/core/paymentProviders.js`.
- Keep existing demo confirm behavior.
- Add Opn scaffold that reports missing config until keys exist.

### Task 2: Mobile QR Entry/Exit Frontend

- Serve `/entry` with the frontend shell.
- Make `/` render entry flow by default.
- Remove kiosk language from customer screens.
- Keep `/pass?token=...` and `/exit`.
- After payment success, show pass and exit instruction on the same phone.

### Task 3: Docs, Access, Verification

- Update `docs/mvp-spec.md`.
- Add `.env.example` with payment placeholders.
- Run tests and syntax checks.
- Restart public demo tunnel.
- Upload snapshot and docs to Drive.
