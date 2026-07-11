# ESP32 Gate Control Flow

Date: 2026-07-11

## Important Principle

The ESP32 does not power the barrier motor directly.

The barrier gate motor uses its own controller board and its own power supply. The ESP32 only sends a short relay signal that behaves like pressing the gate's wired push button.

## What Happens After Payment

1. Customer scans the web QR and creates a parking session.
2. Customer pays.
3. Payment gateway confirms payment to the backend.
4. Backend creates a short-lived `OPEN_GATE` command for a specific gate.
5. ESP32 polls `/gate/entry-1/command` or `/gate/exit-1/command`.
6. If the command is available, ESP32 pulses the relay for about 700 ms.
7. The relay closes the gate controller's dry-contact input.
8. The gate controller opens the motor using its own motor driver and safety logic.
9. The backend marks the command consumed so repeated polling does not keep opening the gate.

## Wiring Concept

```text
Backend API
    |
Wi-Fi / 4G Router
    |
ESP32 GPIO 26
    |
Relay / Optocoupler Relay
    |
Barrier Gate Dry Contact Input
    |
Gate Controller Board
    |
Motor
```

## Power Concept

- ESP32: 5V USB or 5V regulated power supply.
- Relay module: 5V or 3.3V according to the module.
- Barrier gate: usually 220VAC input to its own controller, or manufacturer-specific power.
- Do not connect ESP32 directly to the motor or 220VAC.
- Use an isolated relay or optocoupler interface.

## Relay Behavior

The firmware supports both relay styles:

- `RELAY_ACTIVE_HIGH true`: GPIO HIGH turns relay on.
- `RELAY_ACTIVE_HIGH false`: GPIO LOW turns relay on.

The relay should be on only for `RELAY_PULSE_MS`, then turn off.

## Manual Override

The manual override button is wired to `MANUAL_OVERRIDE_PIN`. Pressing it pulses the relay locally even if internet is down.

This is required for field safety.

## MVP Limitation

The current firmware is a pilot skeleton. Before field installation, add:

- HTTPS or local-network protection
- Device API key
- command acknowledgement endpoint
- gate sensor reporting
- watchdog reset
- enclosure and surge protection

