import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The protocol package is aliased to its source rather than its build output.
 *
 * It means an edit to the type rules is visible in the editor immediately, with no build step
 * between them — which matters, because those rules are the one thing the editor and the
 * runtime must agree on, and a stale copy would be the exact failure ADR-0003 exists to
 * prevent.
 */
const protocolSource = fileURLToPath(
  new URL('../../packages/protocol/src/index.ts', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@encastra/protocol': protocolSource },
  },
  server: {
    port: 5173,
    // Tauri points at this exact port; failing loudly beats silently serving on another one
    // and leaving the window blank.
    strictPort: true,
  },
  build: {
    // The desktop app ships its own runtime and never runs in an old browser, so there is no
    // reason to ship downlevelled output.
    target: 'esnext',
    sourcemap: true,
  },
  // Tauri's dev server sets these; keeping them out of the bundle avoids leaking build paths.
  envPrefix: ['VITE_', 'TAURI_'],
});
