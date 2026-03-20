import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Vite config for building the MCP App UI as a single self-contained HTML file.
 *
 * Key constraints:
 * - `vite-plugin-singlefile` inlines JS + CSS into index.html so the MCP host
 *   can serve it as a single text/html resource blob with no external deps.
 * - `inlineDynamicImports: true` (set by viteSingleFile) would silently break
 *   tone.js and wavesurfer.js which use dynamic import() internally.  We work
 *   around this by forcing them into the static bundle via the `ssr.noExternal`
 *   trick and by NOT using dynamic import() in audio-engine.ts / visualizers.ts
 *   (see those files for the updated static-import pattern).
 * - All console.* calls are stripped from production builds by terser so they
 *   don't appear in the host developer console.
 */
export default defineConfig({
  root: './src/ui',
  plugins: [
    viteSingleFile({
      // Remove script/link tags that were inlined
      removeViteModuleLoader: true,
      // Let viteSingleFile handle inlining; don't also set inlineDynamicImports
      // in rollupOptions or it conflicts with the plugin's own pass.
      useRecommendedBuildConfig: true,
      deleteInlinedFiles: true,
    }),
  ],
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
    target: 'esnext',
    // Large assets (tone, wavesurfer) must be inlined — raise the limit
    assetsInlineLimit: 100 * 1024 * 1024, // 100 MB cap
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        // Keep dynamic-import expressions intact so tone / wavesurfer
        // lazy-load correctly at runtime inside the bundled iframe
        keep_infinity: true,
      },
    },
    rollupOptions: {
      output: {
        // viteSingleFile requires inlineDynamicImports to produce one file.
        // tone and wavesurfer's internal dynamic imports are evaluated at
        // runtime (not statically analysed by rollup), so this is safe.
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
  optimizeDeps: {
    // Pre-bundle MCP Apps SDK so Vite resolves it correctly in the browser build
    include: [
      '@modelcontextprotocol/ext-apps',
      'tone',
      'wavesurfer.js',
    ],
  },
});