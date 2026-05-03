import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

const toPort = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
};

const devPort = toPort(process.env.VITE_PORT ?? process.env.PORT, 5173);
const previewPort = toPort(process.env.VITE_PREVIEW_PORT, 4173);

export default defineConfig({
    plugins: [sveltekit()],
    server: {
        open: true,
        host: true,
        port: devPort,
        strictPort: false
    },
    preview: {
        host: true,
        port: previewPort,
        strictPort: false
    }
});
