<script lang="ts">
    import { browser } from "$app/environment";

    import { derivedValues } from "$lib/store";
    import { proxyVersion } from "$lib/store";

    function formatValue(value: string | number | boolean | null) {
        if (value === null) return "null";
        if (typeof value === "boolean") return value ? "true" : "false";
        return String(value);
    }

    function formatConfidence(score: number) {
        return `${Math.round(score * 100)}%`;
    }

    function slugify(input: string) {
        return input.replace(/[^a-zA-Z0-9._-]/g, "_");
    }

    function download(name: string, content: string, contentType: string) {
        if (!browser) return;

        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function exportJson() {
        const version = slugify($proxyVersion || "unknown_version");
        const now = new Date().toISOString().replaceAll(":", "-");
        download(
            `values_${version}_${now}.json`,
            JSON.stringify($derivedValues, null, 2),
            "application/json"
        );
    }

    function toCsvCell(value: string) {
        return `"${value.replaceAll('"', '""')}"`;
    }

    function exportCsv() {
        const version = slugify($proxyVersion || "unknown_version");
        const now = new Date().toISOString().replaceAll(":", "-");

        const headers = [
            "key",
            "value",
            "confidence",
            "matchedBy",
            "sourcePacket",
            "boundary",
            "path",
            "timestamp"
        ];

        const rows = $derivedValues.map((entry) =>
            [
                entry.key,
                formatValue(entry.value),
                formatConfidence(entry.confidence),
                entry.matchedBy,
                entry.sourcePacket,
                entry.boundary,
                entry.path,
                new Date(entry.timestamp).toISOString()
            ]
                .map((item) => toCsvCell(String(item)))
                .join(",")
        );

        download(
            `values_${version}_${now}.csv`,
            `${headers.join(",")}\n${rows.join("\n")}`,
            "text/csv;charset=utf-8"
        );
    }
</script>

<svelte:head>
    <title>Values</title>
</svelte:head>

<section class="flex flex-col h-full gap-4">
    <h1>Values</h1>

    <p class="text-neutral-300 text-sm md:text-base">
        Live packet-derived values for cross-version utility updates. Start the proxy and join through it.
    </p>

    <div class="flex gap-3">
        <button
            type="button"
            class:inactive={$derivedValues.length === 0}
            on:click={exportJson}>EXPORT JSON</button
        >
        <button
            type="button"
            class:inactive={$derivedValues.length === 0}
            on:click={exportCsv}>EXPORT CSV</button
        >
    </div>

    <ul class="terminal values-list">
        {#if $derivedValues.length === 0}
            <li class="text-neutral-400">No values detected yet. Interact in-game to produce packets.</li>
        {:else}
            {#each $derivedValues as value}
                <li class="value-row">
                    <div>
                        <span class="value-key">{value.key}</span>
                        <span class="value-item"> = {formatValue(value.value)}</span>
                    </div>

                    <div class="value-meta">
                        <span class="packet-prefix">[{new Date(value.timestamp).toTimeString().split(" ")[0]}]</span>
                        <span class="packet-prefix">[{value.boundary.toUpperCase()}]</span>
                        <span class="packet-prefix">[CONF {formatConfidence(value.confidence)}]</span>
                        <span class="packet-prefix">[{value.matchedBy}]</span>
                        <span>{value.sourcePacket}</span>
                        <span class="text-neutral-500">{value.path}</span>
                    </div>
                </li>
            {/each}
        {/if}
    </ul>
</section>

<style lang="postcss">
    .values-list {
        @apply flex flex-col gap-3;
    }

    .value-row {
        @apply border-b border-neutral-700 pb-2;
    }

    .value-key {
        @apply text-green-400 text-2xl;
    }

    .value-item {
        @apply text-2xl;
    }

    .value-meta {
        @apply text-base md:text-lg flex flex-wrap gap-2;
    }
</style>
