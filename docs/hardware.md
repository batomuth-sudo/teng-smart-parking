# TENG Smart Parking Hardware Notes

Date: 2026-07-11

## First Pilot Hardware

Use one controller per gate.

- ESP32 DevKitC or ESP32-S3 DevKitC
- 1-channel relay module or optocoupler relay board
- Barrier gate with dry-contact trigger input
- Manual override push button
- Magnetic or limit sensor for gate position feedback
- Weatherproof IP65 enclosure
- Surge protection and proper grounding
- 12V/24V power for the gate
- Regulated 5V supply for controller electronics
- Wi-Fi router or 4G router
- Optional UPS for controller and network equipment

## Relay Safety

The ESP32 must not directly drive high-current or AC loads. The ESP32 should drive an isolated relay or optocoupler input, and the relay should only short the barrier gate control input according to the gate manufacturer's dry-contact wiring diagram.

## Suggested GPIO Map

- Relay open pulse: GPIO 26
- Manual override button: GPIO 27
- Gate closed sensor: GPIO 32
- Status LED: GPIO 2

## Field Rules

- Manual override must remain available when internet is down.
- The gate should open only for short pulses, not continuous relay-on.
- All external wiring should be strain-relieved and protected from rain.
- Put a clear support phone number near the QR sign during pilot operation.

