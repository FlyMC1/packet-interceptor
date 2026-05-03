import fs from "fs";
import path from "path";
import { Relay } from "bedrock-protocol";
import type { Version } from "bedrock-protocol";

import type { ProxySettings, ProxyState, ServerPayload, ValuePreset } from "$lib/types";
import Emitter from "$lib/server/emitter";
import { extractDerivedValues } from "$lib/server/extractor";

const appDataDir = process.env.APP_DATA_DIR ?? process.cwd();
const profilesDir = path.join(appDataDir, "profiles");

let relay: Relay | undefined;

let proxySettings: ProxySettings | undefined;
const proxyState: ProxyState = {
    state: "uninitialized",
    isAuthenticated: fs.existsSync(profilesDir)
};
let allowedPackets: string[] = [];
let valuePreset: ValuePreset = "all";

const sleep = () => new Promise((r) => setTimeout(r, 60));

function emitProcessingError(error: unknown, context: string) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    Emitter.emit("server_error", {
        message: `${context}: ${message}`,
        stack
    });
}

/**
 * Normalizes a Minecraft Bedrock version string for use with bedrock-protocol.
 * GDK-format versions (1.21.120.4) use a 4-part scheme; bedrock-protocol expects
 * the 3-part protocol version (1.21.120). Strips the 4th part when present.
 */
function normalizeVersion(version: string): string {
    const parts = version.split(".");
    if (parts.length === 4) {
        return parts.slice(0, 3).join(".");
    }
    return version;
}

export async function start() {
    if (proxySettings === undefined || relay !== undefined) return;

    try {
        proxyState.state = "starting";
        Emitter.emit("proxy_state_update", proxyState);

        // ???
        await sleep();

        relay = new Relay({
            host: "0.0.0.0",
            port: proxySettings.sourcePort,
            destination: {
                host: proxySettings.ip,
                port: proxySettings.port,
                offline: proxySettings.offline
            },
            omitParseErrors: true,
            forceSingle: true,
            onMsaCode: (data) => {
                const codePayload: ServerPayload<"code_received"> = {
                    code: data.user_code,
                    url: data.verification_uri
                };

                Emitter.emit("code_received", codePayload);

                proxyState.isAuthenticated = true;
                Emitter.emit("proxy_state_update", proxyState);
            },
            version: normalizeVersion(proxySettings.version) as Version,
            // @ts-ignore
            profilesFolder: profilesDir
        });

        await relay.listen();
    } catch (e: any) {
        await stop(e);
        return;
    }

    proxyState.state = "running";
    Emitter.emit("proxy_state_update", proxyState);

    relay.on("connect", (player) => {
        const handlePacket = (boundary: "clientbound" | "serverbound", packet: Packet) => {
            try {
                const packetPayload: ServerPayload<"proxy_packet"> = {
                    ...packet,
                    boundary,
                    timestamp: Date.now()
                };

                if (allowedPackets.includes(packet.name)) {
                    Emitter.emit("proxy_packet", packetPayload);
                }

                const values = extractDerivedValues(packetPayload, valuePreset);
                if (values.length > 0) {
                    Emitter.emit("derived_values_update", { values });
                }
            } catch (error) {
                emitProcessingError(error, `Packet processing failed (${boundary})`);
            }
        };

        // @ts-ignore
        player.on("clientbound", (packet: Packet) => {
            handlePacket("clientbound", packet);
        });

        // @ts-ignore
        player.on("serverbound", (packet: Packet) => {
            handlePacket("serverbound", packet);
        });
    });

    // @ts-ignore
    relay.on("error", (error: Error) => stop(error));
}

export async function stop(error?: Error) {
    proxyState.state = "closing";
    Emitter.emit("proxy_state_update", proxyState);

    relay?.close();
    await sleep();
    relay = undefined;

    proxyState.state = "uninitialized";
    Emitter.emit("proxy_state_update", proxyState);

    if (error) {
        Emitter.emit("server_error", { stack: error.stack, message: error.message });
    }
}

export function setAllowedPackets(packets: string[]) {
    allowedPackets = packets;
}

export function setValuePreset(preset: ValuePreset) {
    valuePreset = preset;
}

export function setSettings(settings: ProxySettings) {
    proxySettings = settings;
}

export function logout() {
    fs.rmSync(profilesDir, { recursive: true, force: true });

    proxyState.isAuthenticated = false;
    Emitter.emit("proxy_state_update", proxyState);
}

export function getState() {
    return proxyState;
}
