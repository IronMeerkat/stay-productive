import env, { IS_DEV, IS_PROD } from '@extension/env';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import type { UserConfig } from 'vite';

export const watchOption = IS_DEV
  ? {
      chokidar: {
        awaitWriteFinish: true,
      },
    }
  : undefined;

export const withPageConfig = (config: UserConfig) =>
  defineConfig(
    deepmerge(
      {
        define: {
          'process.env': env,
        },
        base: '',
        resolve: {
          alias: (() => {
            // Determine repo root from either dist/lib or lib execution
            const fourUp = resolve(import.meta.dirname, '..', '..', '..', '..');
            const threeUp = resolve(import.meta.dirname, '..', '..', '..');
            const repoRoot = existsSync(resolve(fourUp, 'packages')) ? fourUp : threeUp;
            const pkgs = resolve(repoRoot, 'packages');

            return {
              '@extension/agent-kit': resolve(pkgs, 'agent-kit', 'index.mts'),
              '@extension/contracts': resolve(pkgs, 'contracts', 'index.mts'),
              '@extension/llm': resolve(pkgs, 'llm', 'index.mts'),
              '@extension/env': resolve(pkgs, 'env', 'index.mts'),
              '@extension/shared': resolve(pkgs, 'shared', 'index.mts'),
              '@extension/storage': resolve(pkgs, 'storage', 'lib', 'index.ts'),
              '@extension/ui': resolve(pkgs, 'ui'),
              '@extension/i18n': resolve(pkgs, 'i18n', 'index.mts'),
            } as const;
          })(),
        },
        plugins: [react(), IS_DEV && watchRebuildPlugin({ refresh: true }), nodePolyfills()],
        build: {
          sourcemap: IS_DEV,
          minify: IS_PROD,
          reportCompressedSize: IS_PROD,
          emptyOutDir: IS_PROD,
          watch: watchOption,
          rollupOptions: {
            external: ['chrome'],
          },
        },
      },
      config,
    ),
  );
