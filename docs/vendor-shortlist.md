# Vendor Shortlist - Gate And Parking System

Date: 2026-07-11

## Candidate 1: HIP Barrier Gate From Shopee

URL: https://shopee.co.th/product/29352057/8347410192

Observed product signal:

- Barrier arm length 4-6 m.
- Remote control opening.
- Photo sensor to reduce the risk of the barrier hitting a car.
- Expandable to EasyPass.
- Related listings mention EasyPass card range around 5-15 m, photo sensor, loop detector, and manual release when power fails.

Fit for TENG MVP:

- Good candidate for a low-cost pilot.
- Best if the gate controller has dry-contact input, push-button input, or external open terminal.
- TENG system can control it with ESP32 plus isolated relay.

Questions before buying:

- Does the controller board expose an external OPEN / PUSH / COM terminal?
- Does it include photo sensor?
- Does it include loop detector, or is loop detector optional?
- Is there manual release when power fails?
- What is the warranty and installer support in Ubon Ratchathani?
- Can the arm direction and length fit a 10-20 bay pilot site?

## Candidate 2: TrafficThai SMART Barrier System

URL: https://trafficthai.com/shop/product/smart-barrier-system/

Observed product signal:

- Full smart parking system with barrier gate, LPR, payment, reporting, member/visitor handling, and Wi-Fi connection.
- Claims support for QR code, RFID, barcode, proximity, and software control.
- Includes dashboards and real-time reporting.
- Mentions parking payment system connected to banks, credit cards, and other payment methods.
- Mentions service, site survey, warranty, and onsite support.

Fit for TENG MVP:

- Better as a reference architecture or phase-two/phase-three benchmark.
- Potentially too complete and too vendor-locked for TENG's first innovation MVP.
- Useful if TENG wants a partner/integrator or wants to compare professional system features.

Questions before buying:

- Can TENG backend integrate by API or webhook?
- Can TENG use its own QR payment/session flow?
- Can the barrier be opened by external relay or software API?
- What is the full installed price for 1 entry and 1 exit?
- What are the recurring software, cloud, SIM, and maintenance costs?
- Who owns the transaction and customer data?

## Recommendation

For the first TENG-controlled MVP, start with a HIP-style barrier gate that exposes dry-contact input and includes safety sensors. Keep TrafficThai SMART as a reference for the professional feature roadmap and as a quote benchmark.

The first purchase should not be made until the seller confirms the gate controller input terminals and safety sensor package.

