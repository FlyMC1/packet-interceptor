# Release Checklist

## 1. Environment

- Install Node.js 18.x.
- Run `npm install`.

## 2. Verification

- Run `npm run check`.
- Run `npm run build`.
- Start desktop test build with `npm run desktop`.

## 3. Value Monitor QA

- Open `/configuration` and select protocol version.
- Choose value preset (`all`, `combat`, `movement`, or `player_state`).
- Start proxy and connect Minecraft through source port.
- Open `/values` and confirm health/position/rotation updates.
- Export both JSON and CSV and verify timestamps, paths, and confidence fields.
- Open `/compare`, load two exports from different versions, and verify added/removed/changed counts.
- Confirm changed rows include value, path, source packet, and confidence delta visibility.

## 4. Packaging

- Windows: `npm run dist:win`
- Linux: `npm run dist:linux`
- Multi-platform: `npm run dist:all`

## 5. Release Notes Template

- Target game versions tested.
- New extracted keys added.
- Any packet-path changes requiring utility-client updates.
- Known unsupported values.
