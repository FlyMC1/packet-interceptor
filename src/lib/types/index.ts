export type Proxy = {
    sourcePort: number;
    ip: string;
    port: number;
    version: string;
    offline: boolean;
    isAuthenticated: boolean;
    state: "starting" | "running" | "closing" | "uninitialized";
};

export type ProxyState = Omit<Proxy, "sourcePort" | "ip" | "port" | "version" | "offline">;
export type ProxySettings = Omit<Proxy, "isAuthenticated" | "state">;

export type Packet = {
    name: string;
    params: object;
};
export type PacketBoundary = "serverbound" | "clientbound";

export type DerivedValue = {
    key: string;
    value: string | number | boolean | null;
    sourcePacket: string;
    boundary: PacketBoundary;
    path: string;
    confidence: number;
    matchedBy: "exact_key" | "path_contains" | "position_parent" | "effect_array";
    timestamp: number;
};

export type ValuePreset = "all" | "combat" | "movement" | "player_state";

export type ServerEvent =
    | "server_error"
    | "proxy_packet"
    | "derived_values_update"
    | "proxy_state_update"
    | "protocol_downloaded"
    | "code_received"
    | "all";

export type ServerPayload<
    TEvent extends ServerEvent,
    TPayloadEvent extends ServerEvent = ServerEvent
> = TEvent extends "code_received"
    ? {
          code: string;
          url: string;
      }
    : TEvent extends "server_error"
    ? { stack?: string; message?: string }
    : TEvent extends "protocol_downloaded"
    ? { version: string; packets: string[] }
    : TEvent extends "proxy_packet"
    ? Packet & { boundary: PacketBoundary; timestamp: number }
    : TEvent extends "derived_values_update"
    ? { values: DerivedValue[] }
    : TEvent extends "proxy_state_update"
    ? ProxyState
    : TEvent extends "all"
    ? { event: TPayloadEvent; payload: ServerPayload<TPayloadEvent> }
    : never;

export type ClientSignalEvent = "proxy_start" | "proxy_stop" | "proxy_logout";
export type ClientPayloadEvent =
    | "proxy_settings_update"
    | "proxy_set_allowed_packets"
    | "proxy_set_value_preset";
export type ClientEvent = ClientSignalEvent | ClientPayloadEvent;

export type ClientPayload<TEvent extends ClientPayloadEvent> =
    TEvent extends "proxy_settings_update"
        ? ProxySettings
        : TEvent extends "proxy_set_allowed_packets"
        ? string[]
        : TEvent extends "proxy_set_value_preset"
        ? ValuePreset
        : never;

export type ClientMessage<TEvent extends ClientEvent = ClientEvent> =
    TEvent extends ClientPayloadEvent
        ? {
              event: TEvent;
              payload: ClientPayload<TEvent>;
          }
        : {
              event: TEvent;
          };
