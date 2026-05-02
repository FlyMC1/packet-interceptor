import type { DerivedValue, ServerPayload, ValuePreset } from "$lib/types";

type Primitive = string | number | boolean | null;
type Candidate = {
    path: string;
    leaf: string;
    value: Primitive;
};

type PacketPayload = ServerPayload<"proxy_packet">;

const MAX_DEPTH = 8;
const MAX_NODES = 800;

const EFFECT_ARRAY_KEYS = new Set(["effects", "active_effects", "mob_effects"]);

const PRESET_KEYS: Record<ValuePreset, Set<string>> = {
    all: new Set(),
    combat: new Set(["health", "max_health", "absorption", "air", "effect_count", "on_ground"]),
    movement: new Set(["x", "y", "z", "yaw", "pitch", "head_yaw", "on_ground"]),
    player_state: new Set([
        "gamemode",
        "dimension",
        "runtime_id",
        "entity_type",
        "name_tag",
        "hunger",
        "saturation",
        "health",
        "max_health"
    ])
};

const RULES: Array<{
    key: string;
    aliases: string[];
    predicate: (value: Primitive) => boolean;
}> = [
    {
        key: "health",
        aliases: ["health", "current_health", "player_health", "hp"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "max_health",
        aliases: ["max_health", "maximum_health", "maxhp"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "absorption",
        aliases: ["absorption"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "hunger",
        aliases: ["hunger", "food", "food_level"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "saturation",
        aliases: ["saturation", "food_saturation"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "air",
        aliases: ["air", "air_supply", "breath"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "on_ground",
        aliases: ["on_ground", "is_on_ground", "onground"],
        predicate: (value) => typeof value === "boolean"
    },
    {
        key: "yaw",
        aliases: ["yaw", "rotation_y"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "pitch",
        aliases: ["pitch", "rotation_x"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "head_yaw",
        aliases: ["head_yaw", "headyaw"],
        predicate: (value) => typeof value === "number"
    },
    {
        key: "runtime_id",
        aliases: ["runtime_entity_id", "entity_runtime_id", "runtime_id"],
        predicate: (value) => typeof value === "number" || typeof value === "string"
    },
    {
        key: "entity_type",
        aliases: ["entity_type", "type", "actor_type"],
        predicate: (value) => typeof value === "number" || typeof value === "string"
    },
    {
        key: "gamemode",
        aliases: ["game_mode", "gamemode", "player_game_mode"],
        predicate: (value) => typeof value === "number" || typeof value === "string"
    },
    {
        key: "dimension",
        aliases: ["dimension", "dimension_id"],
        predicate: (value) => typeof value === "number" || typeof value === "string"
    },
    {
        key: "name_tag",
        aliases: ["name_tag", "nametag", "name"],
        predicate: (value) => typeof value === "string"
    }
];

function sanitizePrimitive(value: unknown): Primitive | undefined {
    if (value === null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "bigint") {
        const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
        if (value <= maxSafe && value >= -maxSafe) return Number(value);
        return value.toString();
    }

    return undefined;
}

function collectCandidates(
    value: unknown,
    path: string,
    candidates: Candidate[],
    counters: { visited: number },
    depth = 0
) {
    if (depth > MAX_DEPTH || counters.visited > MAX_NODES) return;

    const primitive = sanitizePrimitive(value);
    if (primitive !== undefined) {
        const pathParts = path.split(".");
        const leaf = pathParts[pathParts.length - 1] ?? path;
        candidates.push({ path, leaf: leaf.toLowerCase(), value: primitive });
        return;
    }

    if (Array.isArray(value)) {
        const maxItems = Math.min(value.length, 32);
        for (let index = 0; index < maxItems; index++) {
            counters.visited += 1;
            collectCandidates(value[index], `${path}[${index}]`, candidates, counters, depth + 1);
        }
        return;
    }

    if (value && typeof value === "object") {
        for (const [rawKey, nested] of Object.entries(value as Record<string, unknown>)) {
            counters.visited += 1;
            const nextPath = path ? `${path}.${rawKey}` : rawKey;
            collectCandidates(nested, nextPath, candidates, counters, depth + 1);
        }
    }
}

function addValue(results: Map<string, DerivedValue>, key: string, value: DerivedValue) {
    const previous = results.get(key);
    if (
        !previous ||
        previous.confidence < value.confidence ||
        (previous.confidence === value.confidence && previous.path.length > value.path.length)
    ) {
        results.set(key, value);
    }
}

function getMatchType(candidate: Candidate, alias: string): DerivedValue["matchedBy"] | undefined {
    if (candidate.leaf === alias) return "exact_key";
    if (candidate.path.toLowerCase().includes(alias)) return "path_contains";
    return undefined;
}

function confidenceFromMatchType(matchType: DerivedValue["matchedBy"]): number {
    if (matchType === "exact_key") return 0.98;
    if (matchType === "path_contains") return 0.83;
    if (matchType === "position_parent") return 0.9;
    return 0.92;
}

function isPositionParent(path: string) {
    const normalized = path.toLowerCase();
    return (
        normalized.includes("position") ||
        normalized.includes("pos") ||
        normalized.includes("location") ||
        normalized.includes("coordinates")
    );
}

function collectEffects(
    params: unknown,
    packet: PacketPayload,
    results: Map<string, DerivedValue>
): void {
    const stack: Array<{ value: unknown; path: string }> = [{ value: params, path: "params" }];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) break;

        const { value, path } = current;
        if (!value || typeof value !== "object") continue;

        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            const nextPath = `${path}.${key}`;

            if (Array.isArray(nested) && EFFECT_ARRAY_KEYS.has(key.toLowerCase())) {
                addValue(results, "effect_count", {
                    key: "effect_count",
                    value: nested.length,
                    sourcePacket: packet.name,
                    boundary: packet.boundary,
                    path: nextPath,
                    confidence: confidenceFromMatchType("effect_array"),
                    matchedBy: "effect_array",
                    timestamp: packet.timestamp
                });
            }

            if (nested && typeof nested === "object") {
                stack.push({ value: nested, path: nextPath });
            }
        }
    }
}

function filterByPreset(values: DerivedValue[], preset: ValuePreset): DerivedValue[] {
    if (preset === "all") return values;

    const allowed = PRESET_KEYS[preset];
    return values.filter((value) => allowed.has(value.key));
}

export function extractDerivedValues(packet: PacketPayload, preset: ValuePreset): DerivedValue[] {
    const candidates: Candidate[] = [];
    collectCandidates(packet.params, "params", candidates, { visited: 0 });

    const results = new Map<string, DerivedValue>();

    for (const rule of RULES) {
        let matched: Candidate | undefined;
        let matchedBy: DerivedValue["matchedBy"] | undefined;

        for (const candidate of candidates) {
            if (!rule.predicate(candidate.value)) continue;

            const aliasMatch = rule.aliases
                .map((alias) => getMatchType(candidate, alias))
                .find((matchType) => matchType !== undefined);

            if (!aliasMatch) continue;

            matched = candidate;
            matchedBy = aliasMatch;
            break;
        }

        if (!matched || !matchedBy) continue;

        addValue(results, rule.key, {
            key: rule.key,
            value: matched.value,
            sourcePacket: packet.name,
            boundary: packet.boundary,
            path: matched.path,
            confidence: confidenceFromMatchType(matchedBy),
            matchedBy,
            timestamp: packet.timestamp
        });
    }

    const numericCandidates = candidates.filter((candidate) => typeof candidate.value === "number");

    for (const axis of ["x", "y", "z"] as const) {
        const axisCandidate = numericCandidates.find((candidate) => {
            if (candidate.leaf !== axis) return false;

            const lastDot = candidate.path.lastIndexOf(".");
            const parentPath = lastDot === -1 ? candidate.path : candidate.path.slice(0, lastDot);

            return isPositionParent(parentPath);
        });

        if (!axisCandidate) continue;

        addValue(results, axis, {
            key: axis,
            value: axisCandidate.value,
            sourcePacket: packet.name,
            boundary: packet.boundary,
            path: axisCandidate.path,
            confidence: confidenceFromMatchType("position_parent"),
            matchedBy: "position_parent",
            timestamp: packet.timestamp
        });
    }

    collectEffects(packet.params, packet, results);

    return filterByPreset(Array.from(results.values()), preset);
}
