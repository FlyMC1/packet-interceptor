# bedrock-packet-interceptor

MITM relay and packet inspector for Minecraft: Bedrock Edition, with a Svelte web UI for configuration and live packet analysis.

## What This Repository Does

This project runs a local proxy that sits between a Bedrock client and a Bedrock server:

1. Your game connects to the local proxy endpoint (source host/port).
2. The proxy forwards traffic to the real destination server (ip/port).
3. While relaying, it inspects packets and emits selected ones to a browser UI.
4. The UI shows packet logs in real time, and can "watch" specific packet names side by side.

Under the hood, it uses:

- `bedrock-protocol` Relay for packet transport/interception.
- SvelteKit backend routes for control and streaming events.
- Server-Sent Events (SSE) for live updates from backend to browser.
- Local protocol cache files for packet name lists by Bedrock version.

## High-Level Architecture

Main flow:

1. Server startup runs protocol initialization in `src/hooks.server.ts`.
2. Protocol initialization loads known Bedrock versions and cached packet-name files from `protocol/`.
3. Browser startup opens an SSE connection via `src/hooks.client.ts` -> `src/lib/api/events.ts`.
4. UI controls send proxy commands to `POST /api/events`.
5. Backend proxy (`src/lib/server/proxy.ts`) starts/stops relay and emits typed events.
6. SSE endpoint (`src/routes/api/events/+server.ts`) forwards all backend events to browser subscribers.
7. UI stores update logs, watched packets, state, and settings.

## Architecture Diagram

```mermaid
flowchart LR
	A[Bedrock Client] -->|Connects to source port| B[Relay Proxy\nsrc/lib/server/proxy.ts]
	B -->|Forwards packets| C[Destination Bedrock Server]

	D[Configuration UI\n/configuration] -->|POST commands| E[/api/events POST]
	E -->|proxy_start/stop/settings/filters| B

	B -->|Emits typed events| F[Emitter\nsrc/lib/server/emitter.ts]
	F -->|all event| G[/api/events GET\nSSE stream]
	G -->|Live SSE events| H[Frontend client\nsrc/lib/api/events.ts]

	H --> I[Logger UI\n/logger]
	H --> J[Watcher UI\n/watcher]

	K[Protocol service\nsrc/lib/server/protocol.ts] -->|GET versions/packets| L[/api/protocol/versions*]
	L --> H
	K --> M[protocol/*.json cache]
```

## Directory Guide

- `src/lib/server/proxy.ts`: Starts/stops relay, filters allowed packets, emits live packet events.
- `src/lib/server/protocol.ts`: Loads Bedrock versions and packet names, downloads packet names on demand.
- `src/lib/server/emitter.ts`: Typed event bus used by backend modules.
- `src/routes/api/events/+server.ts`: SSE stream + command endpoint.
- `src/routes/api/protocol/versions/+server.ts`: Returns supported Bedrock versions.
- `src/routes/api/protocol/versions/[slug]/+server.ts`: Returns packet names for a version (or triggers async download).
- `src/lib/api/events.ts`: Frontend SSE client and command helpers.
- `src/routes/configuration/+page.svelte`: Proxy settings, packet filter controls, start/stop.
- `src/routes/logger/+page.svelte`: Real-time allowed packet log.
- `src/routes/watcher/+page.svelte`: Focused watch view for selected packet names.
- `src/lib/store/index.ts`: Reactive stores and localStorage-backed settings.

## Event Model (How Data Moves)

Backend events emitted via `Emitter`:

- `proxy_state_update`: proxy lifecycle state and auth state.
- `proxy_packet`: intercepted packet with boundary (`serverbound` or `clientbound`) and timestamp.
- `protocol_downloaded`: packet names downloaded for a Bedrock version.
- `code_received`: MSA device code + URL for authentication flows.
- `server_error`: relay/runtime errors.
- `all`: wrapper event automatically emitted for every event above.

The SSE endpoint subscribes to `all`, then sends each message to the browser as an SSE event with JSON payload.

## Step-by-Step Tutorial

## Quick Start (First 5 Minutes)

Use this path if you want to see packets quickly before reading all details.

1. Run the app:
	- `npm install`
	- `npm run dev`
2. Open `/configuration`.
3. Fill proxy settings:
	- `SOURCE PORT`: e.g. `19132`
	- `DESTINATION IP` and `DESTINATION PORT`: the real Bedrock server
	- `VERSION`: select your Bedrock version
4. Click `FILTERS`, then click `TOGGLE ALL FILTERS`.
5. Click `START`.
6. In Minecraft Bedrock, connect to `<proxy-host>:<SOURCE PORT>`.
7. Open `/logger` and confirm packets appear in real time.
8. Use `[+]` next to a packet in logger, then open `/watcher` to track it.

If nothing appears, check the Troubleshooting section below.

## 1. Prerequisites

- Node.js 18+ recommended.
- npm.
- Network access to Bedrock destination servers.

## 2. Install and Run

```bash
git clone https://github.com/MrSterdy/bedrock-packet-interceptor
cd bedrock-packet-interceptor
npm install
```

Development mode:

```bash
npm run dev
```

Production-style run:

```bash
npm run build
npm run preview
```

The UI opens in your browser and exposes pages:

- `/configuration`
- `/logger`
- `/watcher`

## 3. Configure the Proxy

Go to `/configuration` and set:

- `SOURCE PORT`: local listening port for the relay.
- `DESTINATION IP`: remote Bedrock server host/IP.
- `DESTINATION PORT`: remote Bedrock server port.
- `VERSION`: Bedrock protocol version for relay parsing.
- `Offline`: whether to use offline mode for destination.

Details:

- Packet-version metadata is loaded from Prismarine data paths.
- Packet name lists are cached in `protocol/<version>.json`.
- If a chosen version is missing locally, backend starts async download and emits `protocol_downloaded` when complete.

## 4. Choose Packet Filters

Still in `/configuration`:

- `FILTERS` opens packet checkboxes.
- First checkbox controls whether packet name is logged at all.
- Eye checkbox adds packet name to watcher mode.
- `TOGGLE ALL FILTERS` includes/excludes all packet names for current version.

Important behavior:

- Only packet names in `allowedPackets` are emitted as `proxy_packet` events.
- Watching a packet auto-enables it in allowed filters if needed.

## 5. Start Interception

Press `START`:

1. Frontend sends current allowed packets to backend.
2. Frontend sends proxy settings.
3. Frontend sends `proxy_start` command.
4. Backend creates `bedrock-protocol` Relay and listens on source port.

Proxy states:

- `uninitialized` -> `starting` -> `running` -> `closing` -> `uninitialized`.

If relay errors, backend emits `server_error` and resets state.

## 6. Connect Your Game Client

Point your Bedrock client to the machine running this project, using the configured source port.

Example:

- If `SOURCE PORT` is `19132`, connect client to `<proxy-host>:19132`.
- Relay forwards traffic to destination IP/port configured in UI.

## 7. Inspect Traffic in Logger

Open `/logger`:

- Shows timestamp, packet boundary, packet name.
- Renders packet params as JSON tree.
- `CLEAR` empties current log list.
- `[X]` removes one log item.
- `[+]` adds a packet name to watch list.

Packet volume control:

- `PACKET LIMIT` (in configuration) caps retained live logs by trimming older entries.

## 8. Compare Watched Packets in Watcher

Open `/watcher`:

- Shows watched packet names and their latest payloads.
- Keeps values grouped by boundary (`serverbound`, `clientbound`) for each watched packet name.
- Useful to track request/response-like packet transitions over time.

## 9. Authentication Notes

When `bedrock-protocol` requests MSA device auth, proxy emits `code_received`:

- Logger gets synthetic `msa_code` entry.
- Toast prompts you to check logger.
- Backend auth status updates and is stored in proxy state.

Profile storage:

- Auth profiles are stored in local `profiles/`.
- `LOGOUT` deletes `profiles/` recursively and resets auth flag.

## API Reference

## `GET /api/events`

Starts SSE stream. Emits:

- `proxy_state_update`
- `proxy_packet`
- `protocol_downloaded`
- `code_received`
- `server_error`

## `POST /api/events`

Accepts JSON `{ event, payload? }`:

- `proxy_start`
- `proxy_stop`
- `proxy_logout`
- `proxy_set_allowed_packets` with `string[]`
- `proxy_settings_update` with `{ sourcePort, ip, port, version, offline }`

## `GET /api/protocol/versions`

Returns Bedrock versions loaded from Prismarine data paths.

## `GET /api/protocol/versions/:slug`

- Returns packet-name array if cached/loaded.
- Otherwise returns `{ "status": "downloading" }` and triggers async fetch.

## Troubleshooting

- No packets in logger:
	- Confirm proxy is `running`.
	- Confirm game connects to source port, not destination.
	- Confirm packet filters are enabled.
- Version list empty:
	- Check internet connectivity to GitHub raw content endpoints.
- Version stuck downloading:
	- Reopen configuration page and retry version selection.
	- Check server logs for fetch errors.
- Auth issues:
	- Remove stale profiles with `LOGOUT`.

## Development Commands

- `npm run dev`: local dev server.
- `npm run build`: production build.
- `npm run preview`: run built app.
- `npm run check`: type and Svelte checks.
- `npm run lint`: prettier check + eslint.
- `npm run format`: prettier write.

## Security and Usage Notice

Use this tool only in environments you own or are authorized to test. Intercepting traffic without authorization can violate terms of service, laws, or privacy requirements.
