# Operations Log And Google Sheets

Date: 2026-07-12

Google Sheet:

```text
Operations Log - TENG Smart Parking
https://docs.google.com/spreadsheets/d/15SdZkGsXwoPtAD0LMUWbTAGorYSTg6LL0ojISL4WgkM/edit
```

## What The Sheet Tracks

The `Parking Log` tab is the source log for:

- entry/session created
- payment confirmed
- exit approved
- overtime due
- manual gate open
- license plate and normalized plate
- base amount and overtime amount
- entry, paid, and exit timestamps
- gate ID and source

The `Daily Summary` tab summarizes daily entries, paid events, exits, gross revenue, overtime, total revenue, and unique plates.

## Backend Export Endpoints

The live Render app stores operations events and can export them:

```text
GET https://teng-smart-parking.onrender.com/api/operations/logs
GET https://teng-smart-parking.onrender.com/api/operations/logs.csv
```

Both endpoints require:

```text
Authorization: Bearer <ADMIN_GATE_TOKEN>
```

If `ADMIN_GATE_TOKEN` is not configured, exports are disabled.

## Current MVP Sync Model

Current MVP:

1. Render records operations events in backend memory.
2. Admin exports `/api/operations/logs.csv`.
3. CSV rows can be pasted/imported into the Google Sheet `Parking Log` tab.

Next production step:

- Add persistent database storage.
- Add automated Google Sheets sync through either Google Apps Script Web App or a Google service account.
- Keep all Google credentials in Render Environment Variables, not in Drive or source code.
