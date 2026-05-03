# Bedrock Value Monitor v1.0.3

## Highlights

- Added internal server port fallback for desktop mode to avoid startup failure when the default port is already in use.
- Added explicit alternate dev/preview port scripts for faster local recovery from occupied ports.
- Added Configuration page port presets for quick source/destination setup while keeping manual input.
- Improved Microsoft device-code auth error messaging for expired codes.

## Port Improvements

- Electron internal server now checks and selects the first free port from defaults (`4173`, `4174`, `4175`).
- You can override internal server port selection with:
  - `APP_PORT`
  - `APP_PORTS` (comma-separated list)
- Vite dev and preview now use non-strict port binding to reduce hard failures on occupied ports.

## New NPM Scripts

- `npm run dev:5174`
- `npm run dev:5175`
- `npm run preview:4174`
- `npm run preview:4175`

## UI Updates

- `/configuration` now includes source and destination port preset pickers.
- Preset values include: `19132`, `19133`, `25565`, `3000`, `8080`.

## Auth Handling

- Expired Microsoft device-code errors now surface an actionable message:
  - Restart proxy to get a fresh code.
  - Complete sign-in immediately.

## Validation Summary

- `npm run build`: successful.
- Existing `svelte-check` issues remain in unrelated files and are not introduced by this release.

## Known Environment Notes

- Build/test workflow remains most predictable on Node.js 18.x.
