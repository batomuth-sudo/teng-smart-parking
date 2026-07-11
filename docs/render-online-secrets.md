# Render Online Hosting And Secrets

Date: 2026-07-11

## Why The Current Webhook URL Fails

Opn / Omise requires a webhook endpoint that is HTTPS with a valid SSL certificate. The temporary Cloudflare Quick Tunnel URL is useful for demos, but payment gateways may reject temporary tunnel domains or unstable endpoints.

For real payment testing, use a hosted URL such as Render:

```text
https://teng-smart-parking.onrender.com/api/payments/webhook/opn
```

The exact domain may differ depending on the service name Render assigns.

## Where To Store Webhook Secret

Store the webhook secret in Render Environment Variables, not in this repository, Drive, screenshots, or chat.

Use these variables:

```text
PAYMENT_PROVIDER=opn
OPN_PUBLIC_KEY=<from Opn dashboard>
OPN_SECRET_KEY=<from Opn dashboard>
OPN_WEBHOOK_SECRET=<from Opn webhook settings>
HOST=0.0.0.0
```

## Render Setup Steps

1. Create a Render account: https://render.com/
2. Put this project in a GitHub repository.
3. In Render, create a new Web Service from that GitHub repository.
4. Use:
   - Build command: empty
   - Start command: `node src/server.js`
   - Plan: Free for MVP testing
5. Add environment variables from the list above.
6. Deploy.
7. Copy the Render service URL.
8. In Opn / Omise webhook settings, set:

```text
https://<your-render-service>.onrender.com/api/payments/webhook/opn
```

## Important Notes

- Render free services may sleep when inactive, so first request after idle can be slow.
- Do not connect a real barrier gate to a free sleeping service for production.
- For production, use a paid always-on service or a stable Cloudflare named tunnel with a real domain.
- Keep real Opn keys private. Only paste them into Render Environment Variables.
