import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Vite config for building the MCP App UI as a single self-contained HTML file.
 *
 * Key constraints:
 * - `vite-plugin-singlefile` inlines JS + CSS into index.html so the MCP host
 *   can serve it as a single text/html resource blob with no external deps.
 * - All console.* calls are stripped from production builds by terser so they
 *   don't appear in the host developer console.
 * - INPUT env var specifies which HTML file to build (for multiple UI bundles)
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
    emptyOutDir: false, // Don't empty - we're building multiple files
    target: 'esnext',
    // Large assets (tone, wavesurfer) must be inlined — raise the limit
    assetsInlineLimit: 100 * 1024 * 1024, // 100 MB cap
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      input: process.env.INPUT || 'src/ui/index.html',
      output: {
        // viteSingleFile requires inlineDynamicImports to produce one file.
        inlineDynamicImports: true,
        manualChunks: undefined,
        entryFileNames: (chunkInfo) => {
          // Extract the base name from the input path
          const input = process.env.INPUT || 'src/ui/index.html';
          const baseName = input.split('/').pop()?.replace('.html', '') || 'index';
          return `${baseName}.js`;
        },
        assetFileNames: (assetInfo) => {
          const input = process.env.INPUT || 'src/ui/index.html';
          const baseName = input.split('/').pop()?.replace('.html', '') || 'index';
          const ext = assetInfo.name?.split('.').pop() || 'css';
          return `${baseName}.${ext}`;
        },
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