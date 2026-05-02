import { get } from "svelte/store";

import {
    allowedLogs,
    derivedValues,
    packetLimit,
    packets,
    proxyAuthenticated,
    proxyState,
    watchedLogs,
    watchedPackets
} from "$lib/store";

import { sendToastDefault, sendToastError, sendToastSuccess } from "$lib/toasts";

import type {
    ClientEvent,
    ClientMessage,
    ClientPayload,
    ProxySettings,
    ProxyState,
    ServerPayload
} from "$lib/types";

let eventSource: EventSource;

export function init() {
    return new Promise((resolve) => {
        eventSource = new EventSource("/api/events");

        eventSource.onopen = resolve;

        eventSource.addEventListener("proxy_state_update", (event) => {
            const data: ProxyState = JSON.parse(event.data);

            if (data.state === "starting") {
                allowedLogs.set([]);
                watchedLogs.set([]);
                derivedValues.set([]);
            }

            proxyState.set(data.state);
            proxyAuthenticated.set(data.isAuthenticated);
        });

        eventSource.addEventListener("proxy_packet", (event) => {
            const packet: ServerPayload<"proxy_packet"> = JSON.parse(event.data);

            const $packetLimit = get(packetLimit);
            const $allowedLogs = get(allowedLogs);

            const diff = $allowedLogs.length - $packetLimit;

            allowedLogs.update((packets) =>
                diff >= 0 ? [...packets.slice(diff + 1), packet] : [...packets, packet]
            );

            const $watchedPackets = get(watchedPackets);

            const watchedIndex = $watchedPackets.indexOf(packet.name);
            if (watchedIndex === -1) return;

            const $watchedLogs = get(watchedLogs);

            if ($watchedLogs[watchedIndex] === undefined) {
                watchedLogs.update((logs) => {
                    logs[watchedIndex] = { [packet.boundary]: packet };
                    return logs;
                });
            } else {
                watchedLogs.update((logs) => {
                    logs[watchedIndex]![packet.boundary] = packet;
                    return logs;
                });
            }
        });

        eventSource.addEventListener("derived_values_update", (event) => {
            const data: ServerPayload<"derived_values_update"> = JSON.parse(event.data);

            derivedValues.update((currentValues) => {
                const next = new Map(currentValues.map((item) => [item.key, item]));

                for (const value of data.values) {
                    next.set(value.key, value);
                }

                return Array.from(next.values()).sort((a, b) => a.key.localeCompare(b.key));
            });
        });

        eventSource.addEventListener("code_received", (event) => {
            const codePayload: ServerPayload<"code_received"> = JSON.parse(event.data);

            allowedLogs.update((packets) => [
                ...packets,
                {
                    name: "msa_code",
                    params: codePayload,
                    boundary: "clientbound",
                    timestamp: Date.now()
                }
            ]);

            sendToastDefault("Received an MSA code. Please check the logger");
        });

        eventSource.addEventListener("server_error", (event) => {
            const error = JSON.parse(event.data);

            console.error(error);

            sendToastError(error.message ?? "An error occurred. Please check the debugger");
        });

        eventSource.addEventListener("protocol_downloaded", (event) => {
            const data = JSON.parse(event.data);

            packets.set(data.packets);

            sendToastSuccess(`The ${data.version} packets have been downloaded`);
        });

        eventSource.addEventListener("error", (err) => {
            console.error(err);

            sendToastError();
        });
    });
}

function post<TEvent extends ClientEvent>(message: ClientMessage<TEvent>) {
    return fetch("/api/events", {
        method: "post",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(message)
    });
}

export function start() {
    return post<"proxy_start">({ event: "proxy_start" });
}

export function stop() {
    return post<"proxy_stop">({ event: "proxy_stop" });
}

export function setAllowedPackets(payload: ClientPayload<"proxy_set_allowed_packets">) {
    return post<"proxy_set_allowed_packets">({
        event: "proxy_set_allowed_packets",
        payload
    });
}

export function setSettings(payload: ProxySettings) {
    return post<"proxy_settings_update">({
        event: "proxy_settings_update",
        payload
    });
}

export function setValuePreset(payload: ClientPayload<"proxy_set_value_preset">) {
    return post<"proxy_set_value_preset">({
        event: "proxy_set_value_preset",
        payload
    });
}

export function logout() {
    return post<"proxy_logout">({ event: "proxy_logout" });
}
