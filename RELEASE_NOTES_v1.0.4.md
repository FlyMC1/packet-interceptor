# Bedrock Value Monitor v1.0.4

## Highlights

- Added resilient internal server startup in desktop mode with automatic fallback ports.
- Added explicit alternate dev/preview port scripts for faster recovery when default ports are occupied.
- Added source and destination port preset selectors in Configuration for faster setup.
- Improved Microsoft device-code auth expiration messaging with clear retry guidance.

## Port Handling Improvements

- Desktop runtime now tries the first available port from `4173`, `4174`, and `4175`.
- Internal server ports can be customized with environment variables:
  - `APP_PORT`
  - `APP_PORTS` (comma-separated)
- Vite dev/preview runs are configured to avoid hard failures when a preferred port is already in use.

## New Commands

- `npm run dev:5174`
- `npm run dev:5175`
- `npm run preview:4174`
- `npm run preview:4175`

## UI Changes

- Configuration page now includes quick port presets for source and destination ports.
- Presets include `19132`, `19133`, `25565`, `3000`, and `8080`.

## Auth UX

- Expired Microsoft device-code flow now returns an actionable message to restart proxy and sign in again quickly.

## Validation

- Release build completed successfully with `npm run build`.
- Existing workspace type-check issues outside this release scope remain unchanged.
