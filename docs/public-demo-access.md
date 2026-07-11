# TENG Smart Parking Public Demo Access

Updated: 2026-07-11

## Current Public Demo Link

URL: https://sets-insert-generate-their.trycloudflare.com

Password: disabled for customer demo

## How This Works

This link is a Cloudflare Quick Tunnel from the public internet to the local Node.js server on this computer:

- Local app: `http://127.0.0.1:8080`
- Public tunnel: `https://sets-insert-generate-their.trycloudflare.com`
- Server password protection: disabled for customer demo

The link works only while this computer is on, the Node server is running, and `cloudflared.exe` is running.

Quick Tunnel URLs are temporary. If the tunnel is restarted, Cloudflare may create a new `trycloudflare.com` URL. For a stable permanent URL, use a named Cloudflare Tunnel with a real domain or use a hosted Node service later.

## Run Again

From the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-public-demo.ps1
```

The script starts the local server without a password, starts Cloudflare Tunnel, and prints the current public URL.

To run with password protection for internal testing:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-public-demo.ps1 -EnableAuth
```

## MVP Security Notes

- This password is for demo protection only, not production security.
- Do not use this same password for banking, Google, email, or server accounts.
- Before connecting real gates, add stronger gate-device authentication and move session/payment state into a database.
