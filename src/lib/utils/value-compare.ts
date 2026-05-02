import type { DerivedValue } from "$lib/types";

export type ValueSnapshot = {
    key: string;
    value: string | number | boolean | null;
    confidence: number;
    matchedBy: string;
    sourcePacket: string;
    boundary: string;
    path: string;
    timestamp: string;
};

export type ComparisonResult = {
    onlyInA: ValueSnapshot[];
    onlyInB: ValueSnapshot[];
    changed: Array<{
        key: string;
        before: ValueSnapshot;
        after: ValueSnapshot;
        changes: string[];
    }>;
    unchanged: ValueSnapshot[];
};

function normalizeNumber(input: unknown): number | undefined {
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "string") return undefined;

    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function toValue(input: unknown): string | number | boolean | null {
    if (input === null) return null;
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
        return input;
    }

    return String(input);
}

function toSnapshot(input: Partial<DerivedValue> & { key: string }): ValueSnapshot {
    return {
        key: input.key,
        value: toValue(input.value ?? null),
        confidence: normalizeNumber(input.confidence) ?? 0,
        matchedBy: String(input.matchedBy ?? "unknown"),
        sourcePacket: String(input.sourcePacket ?? "unknown"),
        boundary: String(input.boundary ?? "unknown"),
        path: String(input.path ?? "unknown"),
        timestamp: new Date(normalizeNumber(input.timestamp) ?? Date.now()).toISOString()
    };
}

export function parseJsonSnapshot(content: string): ValueSnapshot[] {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];

    return parsed
        .filter((item) => item && typeof item === "object" && typeof item.key === "string")
        .map((item) => toSnapshot(item as Partial<DerivedValue> & { key: string }));
}

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
                continue;
            }

            inQuotes = !inQuotes;
            continue;
        }

        if (char === "," && !inQuotes) {
            cells.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    cells.push(current);
    return cells;
}

export function parseCsvSnapshot(content: string): ValueSnapshot[] {
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length < 2) return [];

    const header = parseCsvLine(lines[0]).map((column) => column.trim());
    const required = ["key", "value", "confidence", "matchedBy", "sourcePacket", "boundary", "path"];
    const hasRequired = required.every((column) => header.includes(column));
    if (!hasRequired) return [];

    const index = (column: string) => header.indexOf(column);

    const rows: ValueSnapshot[] = [];

    for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line);
        const key = cells[index("key")];
        if (!key) continue;

        const rawValue = cells[index("value")];
        const normalizedValue =
            rawValue === "null"
                ? null
                : rawValue === "true"
                ? true
                : rawValue === "false"
                ? false
                : normalizeNumber(rawValue) ?? rawValue;

        rows.push({
            key,
            value: normalizedValue,
            confidence: (normalizeNumber(cells[index("confidence")]) ?? 0) / 100,
            matchedBy: cells[index("matchedBy")] ?? "unknown",
            sourcePacket: cells[index("sourcePacket")] ?? "unknown",
            boundary: cells[index("boundary")] ?? "unknown",
            path: cells[index("path")] ?? "unknown",
            timestamp: cells[index("timestamp")] || new Date().toISOString()
        });
    }

    return rows;
}

export function compareSnapshots(a: ValueSnapshot[], b: ValueSnapshot[]): ComparisonResult {
    const mapA = new Map(a.map((item) => [item.key, item]));
    const mapB = new Map(b.map((item) => [item.key, item]));

    const onlyInA: ValueSnapshot[] = [];
    const onlyInB: ValueSnapshot[] = [];
    const changed: ComparisonResult["changed"] = [];
    const unchanged: ValueSnapshot[] = [];

    for (const [key, before] of mapA.entries()) {
        const after = mapB.get(key);

        if (!after) {
            onlyInA.push(before);
            continue;
        }

        const changes: string[] = [];

        if (before.value !== after.value) changes.push("value");
        if (before.path !== after.path) changes.push("path");
        if (before.sourcePacket !== after.sourcePacket) changes.push("sourcePacket");
        if (before.boundary !== after.boundary) changes.push("boundary");

        const confidenceDelta = Math.abs(before.confidence - after.confidence);
        if (confidenceDelta >= 0.02) changes.push("confidence");

        if (changes.length === 0) {
            unchanged.push(after);
        } else {
            changed.push({ key, before, after, changes });
        }
    }

    for (const [key, after] of mapB.entries()) {
        if (!mapA.has(key)) {
            onlyInB.push(after);
        }
    }

    onlyInA.sort((x, y) => x.key.localeCompare(y.key));
    onlyInB.sort((x, y) => x.key.localeCompare(y.key));
    unchanged.sort((x, y) => x.key.localeCompare(y.key));
    changed.sort((x, y) => x.key.localeCompare(y.key));

    return { onlyInA, onlyInB, changed, unchanged };
}
