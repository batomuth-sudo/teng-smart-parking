# Opn / Omise PromptPay Integration Notes

Date: 2026-07-11

## Recommended Gateway

Start with Opn Payments / Omise for Thailand PromptPay QR.

Why:

- Supports Thailand PromptPay QR.
- Has API and webhook flow suitable for opening ESP32 gate after confirmed payment.
- Public docs and Thailand pricing are clear enough for MVP planning.

## Current Code State

The code now has a payment provider boundary:

- `PAYMENT_PROVIDER=mock` works immediately for demo and ESP32 testing.
- `PAYMENT_PROVIDER=opn` is scaffolded for real integration after merchant onboarding.
- `/api/payment-provider` reports current provider readiness.
- `/api/payments/webhook/opn` accepts future webhook events.
- If `OPN_WEBHOOK_SECRET` is configured, `/api/payments/webhook/opn` verifies `Omise-Signature`
  with HMAC-SHA256 before accepting the event.

## Signup/KYC Checklist

These steps must be completed by the business owner because they require company and banking information:

1. Create an Opn/Omise merchant account.
2. Submit TENG Asset Co., Ltd. company documents.
3. Add settlement bank account.
4. Enable PromptPay QR payment method.
5. Add webhook URL from the public tunnel or production domain:
   - MVP online testing: `https://<your-render-service>.onrender.com/api/payments/webhook/opn`
   - Local temporary demo only: `https://<current-tunnel>.trycloudflare.com/api/payments/webhook/opn`
   - Production: use a stable custom domain.
6. Copy test keys into local environment variables only:
   - `OPN_PUBLIC_KEY`
   - `OPN_SECRET_KEY`
   - `OPN_WEBHOOK_SECRET`

## Security Rule

Do not save real secret keys in Drive, screenshots, chat, source code, or markdown docs. Keep them in local environment variables or a secrets manager.

For online testing, store `OPN_WEBHOOK_SECRET`, `OPN_PUBLIC_KEY`, and `OPN_SECRET_KEY` in Render Environment Variables.

## Next Implementation Step

After keys are available, implement:

1. Create PromptPay charge through Opn API when the customer chooses duration.
2. Render the provider QR image or QR payload.
3. Create a real Opn charge and map the Opn charge ID back to the TENG parking session.
4. On confirmed charge, mark session paid and create `OPEN_GATE`.
