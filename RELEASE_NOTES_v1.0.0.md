# Bedrock Value Monitor v1.0.0

## Highlights

- Repurposed from packet-only logging into a gameplay value monitor for Bedrock protocol traffic.
- Added real-time derived value extraction from packet payloads.
- Added focus presets to target specific value categories.
- Added confidence scoring and extraction strategy metadata per value.
- Added one-click JSON/CSV export for captured values.
- Added in-app cross-version export comparison.

## New Pages

- `/values`: Live values, confidence metadata, and export actions.
- `/compare`: Diff two export files and review key-level changes.

## Value Presets

- `all`
- `combat`
- `movement`
- `player_state`

## Exports

- JSON: full value metadata.
- CSV: spreadsheet-friendly format with confidence and path fields.

## Compare Workflow

- Load baseline export and target export.
- Review added keys, removed keys, changed keys, and unchanged key count.
- Inspect value/path/source/confidence differences for changed keys.

## Release Notes For Utility Client Updates

- Validate mappings on each Bedrock version through proxy traffic.
- Use compare output to identify moved or renamed fields.
- Prioritize high-confidence mapping paths before runtime integration.

## Known Environment Requirement

- Build/test/package workflow requires Node.js 18.x in this codebase.
