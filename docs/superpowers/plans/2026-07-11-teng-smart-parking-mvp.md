# TENG Smart Parking MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable backend and ESP32 control foundation for a 10-20 bay smart parking pilot.

**Architecture:** Keep the first version modular and small. The backend owns sessions, pricing, payment state, and gate command state. The ESP32 firmware stays simple: connect to Wi-Fi, poll for commands, trigger relay, report result.

**Tech Stack:** Node.js ESM, built-in `node:test`, Arduino-style ESP32 firmware, JSON over HTTP for the first pilot, PromptPay provider integration in a later task.

## Global Constraints

- Customers must not need to install an app.
- Session identity must work with URL token, browser storage, and license plate fallback.
- Gate commands must expire and be idempotent.
- Manual override is required for field safety.
- No production payment opening should rely on customer-uploaded slip images alone.

---

### Task 1: Session Core

**Files:**
- Create: `src/core/packages.js`
- Create: `src/core/sessions.js`
- Test: `tests/core/sessions.test.js`

**Interfaces:**
- Produces: `createSession({ plate, packageId, now })`
- Produces: `findSessionForExit({ token, plate, sessions, now })`
- Produces: `calculateOvertime({ session, now })`

- [ ] **Step 1: Write failing tests for session creation and exit lookup**
- [ ] **Step 2: Run `node --test tests/core/sessions.test.js` and confirm missing exports fail**
- [ ] **Step 3: Implement package defaults and session functions**
- [ ] **Step 4: Run session tests and confirm pass**

### Task 2: Gate Command Core

**Files:**
- Create: `src/core/gateCommands.js`
- Test: `tests/core/gateCommands.test.js`

**Interfaces:**
- Produces: `createGateCommand({ gateId, sessionId, now })`
- Produces: `consumeGateCommand({ command, now })`

- [ ] **Step 1: Write failing tests for command expiry and idempotency**
- [ ] **Step 2: Run `node --test tests/core/gateCommands.test.js` and confirm missing exports fail**
- [ ] **Step 3: Implement command creation and consume logic**
- [ ] **Step 4: Run gate command tests and confirm pass**

### Task 3: HTTP API Skeleton

**Files:**
- Create: `src/server.js`
- Create: `src/app.js`
- Test: `tests/api/api.test.js`

**Interfaces:**
- Consumes: session and gate command core modules
- Produces: HTTP endpoints for demo operation

- [ ] **Step 1: Write failing API tests using Node HTTP client**
- [ ] **Step 2: Implement `/sessions`, `/sessions/exit`, and `/gate/:gateId/command`**
- [ ] **Step 3: Run all tests**

### Task 4: ESP32 Firmware Skeleton

**Files:**
- Create: `firmware/esp32-gate-controller/esp32-gate-controller.ino`
- Create: `firmware/esp32-gate-controller/config.example.h`

**Interfaces:**
- Consumes: `/gate/:gateId/command`
- Produces: relay pulse and serial logs

- [ ] **Step 1: Add compile-ready Arduino sketch skeleton**
- [ ] **Step 2: Add config example for Wi-Fi and API URL**
- [ ] **Step 3: Document wiring and relay safety in `docs/hardware.md`**

