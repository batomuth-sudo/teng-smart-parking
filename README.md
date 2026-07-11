# TENG Smart Parking

TENG Smart Parking is an MVP for turning vacant urban land in Ubon Ratchathani into automated paid parking without requiring customers to install an app.

The first pilot targets 10-20 parking bays and uses:

- Mobile web session tickets
- PromptPay QR payment confirmation
- ESP32 gate control
- Manual override for operations
- A simple admin/revenue record

## MVP Flow

1. Customer scans the entry QR.
2. Customer enters license plate details and selects a parking package.
3. System creates a parking session and payment request.
4. Payment confirmation unlocks the entry gate.
5. Customer scans the exit QR.
6. System identifies the session by browser token or license plate fallback.
7. If paid time remains, the exit gate opens. If overtime exists, customer pays the difference first.

## Run Locally

Use the bundled Codex Node runtime or any modern Node.js runtime.

```powershell
& 'C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' src/server.js
```

Then open:

```text
http://127.0.0.1:8080/
```

Run tests:

```powershell
& 'C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test
```

ESP32 demo polling endpoint:

```text
GET http://127.0.0.1:8080/gate/entry-1/command
GET http://127.0.0.1:8080/gate/exit-1/command
```

Convenience wrappers are also included:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-web.ps1
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

## Project Memory

Business and technical notes live in `docs/` so the same source can be synced to the company Google Drive folder.
