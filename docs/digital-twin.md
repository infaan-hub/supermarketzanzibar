# 3D Digital Twin Supermarket — Spatial Design Specification (Phase 2)

## 1. Metric Scale & Building Envelope
- **Coordinate Convention:** Right-handed Y-up, `1.0 unit = 1.0 meter`, finished floor at `y = 0.0m`.
- **Main Retail Hall:** `38.0m` (East–West, `X: -19..+19`) × `28.0m` (North–South, `Z: -14..+14`) × `5.2m` clear ceiling height (`1,064 m²`).
- **Back-of-House Annex:** `38.0m` (`X: -19..+19`) × `16.0m` (`Z: -30..-14`) × `6.4m` warehouse clearance (`608 m²`).
- **Combined Footprint:** `38.0m × 44.0m` (`1,672 m²`).

## 2. Architectural Floor Plan (Top-Down, North = Top)

```text
  X = -19                 X = -10                 X = 0                   X = +10                 X = +19
Z=-30 +----------------------------------------------------------------------------------------------------+
      |  [18] STAFF-ONLY  |            [16] STORAGE WAREHOUSE (Zones A, B, C)             | [17] RECEIVING |
      |   Manager Office  |  Rack_A02       Rack_B02         Rack_C02                     |   Rack_D02     |
      |   Break Room      |  =========      =========        =========                    |   Loading Dock |
      |   Server / POS    |  Rack_A01       Rack_B01         Rack_C01                     |   Rack_D01     |
Z=-14 +=======[DOORS]=====+=====================[DOUBLE SWING DOORS]======================+=====[DOCK]=====+
      |   [12] HOUSEHOLD (SH-HSH-01)       |       [13] ELECTRONICS (SH-ELC-01)           |                |
Z=-10 |------------------------------------+----------------------------------------------+  [7] DAIRY     |
      | [10] MEAT | [11] COSMETICS         |       [8] FROZEN FOODS                       |  FR-DAI-02     |
      |  & FISH   |  SH-COS-01  SH-COS-02  |        FR-FRZ-01      FR-FRZ-02              |  FR-DAI-01     |
      | FR-MEA-01 |                        |                                              |                |
Z=-4  |-----------+------------------------+----------------------------------------------+----------------|
      |           | [4] GROCERY            | [5] BEVERAGES                                | [6] FRUITS &   |
      | [9] BAKERY|  SH-GRO-01  02   03    |  SH-BEV-01   SH-BEV-02   FR-BEV-01           |  VEGETABLES    |
      | SH-BAK-01 |     ||      ||   ||    |     ||          ||          ||               |  SH-PRO-02     |
      |           |     ||      ||   ||    |     ||          ||          ||               |  SH-PRO-01     |
Z=+5  |-----------+------------------------+----------------------------------------------+----------------|
      |           |         [14] CHECKOUT COUNTERS (CHK-01 .. CHK-04)                     |                |
Z=+10 | [15] SVC  | [2] RECEPTION   |  [1] MAIN ENTRANCE (GLASS)  | [3] SHOPPING CARTS    |                |
Z=+14 +------------------------------------[SLIDING GLASS DOORS]-------------------------------------------+
```

## 3. All 18 Required Physical Areas
1. **Main Entrance (`ENT`)** — Automated glass sliding doors & windbreak vestibule.
2. **Customer Reception (`REC`)** — Welcome kiosk and promotional endcap.
3. **Shopping Cart Collection (`CRT`)** — Cart corral & basket stacks.
4. **Grocery Department (`GRO`)** — 3 double-sided gondolas (`SH-GRO-01`..`03`), `3.4m` center spacing (`2.4m` clear aisle).
5. **Beverage Department (`BEV`)** — 2 heavy-duty gondolas (`SH-BEV-01`..`02`) + chilled cooler (`FR-BEV-01`).
6. **Fruits & Vegetables (`PRO`)** — 2 timber produce islands (`SH-PRO-01`..`02`) with weighing scales.
7. **Dairy Products (`DAI`)** — 2 multi-deck glass chillers (`FR-DAI-01`..`02`).
8. **Frozen Foods (`FRZ`)** — 2 island freezers (`FR-FRZ-01`..`02`).
9. **Bakery (`BAK`)** — Illuminated bakery display case (`SH-BAK-01`).
10. **Meat & Fish (`MEA`)** — Refrigerated stainless butcher & seafood counter (`FR-MEA-01`).
11. **Cosmetics & Personal Care (`COS`)** — 2 illuminated boutique shelves (`SH-COS-01`..`02`).
12. **Household Products (`HSH`)** — North-west wall shelving (`SH-HSH-01`).
13. **Electronics & Accessories (`ELC`)** — Secured showcase (`SH-ELC-01`).
14. **Checkout Counters (`CHK`)** — 4 POS lanes (`CHK-01`..`CHK-04`) with conveyors, scanners, and displays.
15. **Customer Service Desk (`SVC`)** — Front-west returns & loyalty desk.
16. **Storage Warehouse (`WH`)** — Zones A–C with 6 industrial high-bay racks (`Rack_A01`..`Rack_C02`).
17. **Receiving & Delivery Area (`RCV`)** — Zone D loading bay & staging racks (`Rack_D01`..`Rack_D02`).
18. **Staff-Only Areas (`STF`)** — Office, server rack, break area, and fire exit.

## 4. Ergonomic Scale & Clearance Guarantees
- **Walkable Aisle Width:** `2.4m` clear between parallel gondolas (exceeds 1.8m two-cart passing minimum).
- **Standard Gondola Height:** `2.1m` with 4 product tiers (`0.36m` base deck to `1.95m` top shelf).
- **Chiller / Refrigerator Height:** `2.2m`; **Produce/Freezer Islands:** `1.10m–1.15m` for clear sightlines across the store.
- **Warehouse Pallet Racks:** `4.2m` tall, 3 beam levels, `5.8m` forklift aisle between facing racks.
- **Camera Constraints:** Polar angle `[0.12 rad, π/2 − 0.04 rad]`, distance `[2.2m, 56m]`, preventing clipping underground or escaping the scene envelope.
