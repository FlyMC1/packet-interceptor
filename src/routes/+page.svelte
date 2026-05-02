<script>
    import logo from "$lib/images/logo.png";
</script>

<svelte:head>
    <title>Home</title>
</svelte:head>

<section class="flex flex-col gap-3 items-center p-4">
    <img src={logo} class="w-60 h-60" alt="" />
    <h1 class="title">Bedrock Value Monitor</h1>

    <h2>Inspect live packet-derived gameplay values across versions</h2>

    <div class="dashboard-grid w-full max-w-5xl mt-6">
        <a class="dashboard-card" href="/configuration">
            <h3>1. Configure Proxy</h3>
            <p>Set source/destination, choose protocol version, and select value preset.</p>
        </a>

        <a class="dashboard-card" href="/values">
            <h3>2. Capture Values</h3>
            <p>View latest detected values with confidence and extraction source path metadata.</p>
        </a>

        <a class="dashboard-card" href="/logger">
            <h3>3. Inspect Raw Packets</h3>
            <p>Trace packet events to validate mappings and find additional fields for future versions.</p>
        </a>

        <a class="dashboard-card" href="/watcher">
            <h3>4. Watch Targets</h3>
            <p>Pin packet names and compare clientbound/serverbound updates side-by-side.</p>
        </a>

        <a class="dashboard-card" href="/compare">
            <h3>5. Compare Versions</h3>
            <p>Load two exports and instantly see added, removed, and changed keys with confidence deltas.</p>
        </a>
    </div>

    <section class="quick-guide w-full max-w-5xl">
        <h3>Release Workflow</h3>
        <ol>
            <li>Start this app, then launch Minecraft and connect through the configured source port.</li>
            <li>Use Values page export buttons (JSON/CSV) per game version.</li>
            <li>Compare keys + paths across versions, then update your utility client mappings.</li>
        </ol>
    </section>
</section>

<style lang="postcss">
    .dashboard-grid {
        @apply grid gap-4 md:grid-cols-2;
    }

    .dashboard-card {
        @apply rounded-xl border border-neutral-700 bg-neutral-800/80 p-5 transition duration-200;
    }

    .dashboard-card:hover {
        @apply border-green-400 -translate-y-0.5;
    }

    .dashboard-card h3 {
        @apply text-xl font-quicksand;
    }

    .dashboard-card p {
        @apply text-neutral-300 mt-2;
    }

    .quick-guide {
        @apply mt-6 rounded-xl border border-neutral-700 bg-neutral-900/70 p-5;
    }

    .quick-guide h3 {
        @apply text-xl font-quicksand;
    }

    .quick-guide ol {
        @apply list-decimal ml-6 mt-3 flex flex-col gap-2 text-neutral-300;
    }
</style>
