import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var rawBase = env.VITE_BASE_PATH || "/";
    var base = rawBase.endsWith("/") ? rawBase : "".concat(rawBase, "/");
    return {
        base: base,
        plugins: [react()],
        server: {
            port: Number(env.VITE_PORT || 5173),
            host: "0.0.0.0",
        },
        build: {
            outDir: "dist",
        },
    };
});
