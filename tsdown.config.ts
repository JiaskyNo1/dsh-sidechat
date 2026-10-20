/**
 * Self-contained build for the dsh-sidechat bundle package (DSH 0.2.1-rc.2).
 *
 * Two faces, selected by `--env.DSH_BUILD_FACE`:
 * - `host`: transpile the tsc-emitted lib/types/*.js into lib/*.js (node half:
 *   SidechatService + the hand-written ./typert host manifest). Every
 *   @deepseek-ai/* import is type-only except the package's own runtime
 *   dependencies (zod), so the installed copy runs from the profile's
 *   node_modules without peer resolution.
 * - `client`: bundle src/client/index.ts into lib/client.js — the browser half
 *   wrapped in `window.__ModuleLoader__.load({ id, factory })`, with CSS
 *   Modules compiled by lightningcss inside the bundle (virtual-id wrapper
 *   keeps module CSS out of tsdown's own pipeline) and externals resolved from
 *   the web shell's platform module table.
 *
 * The platform module table mirrors the one the shipped web frontend seeds into
 * its module system (`staticModules` in the application bundle):
 * react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis,
 * zod, @tanstack/react-virtual, @deepseek-ai/dsh-client-store,
 * @deepseek-ai/dsh-client-ui-slots, @deepseek-ai/dsh-client-ui-primitives,
 * @deepseek-ai/dsh-client-ui-dockkit.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** Browser bundle id: the package name, stamped into the ModuleLoader handoff. */
const BUNDLE_ID = 'dsh-sidechat'

/** Platform modules resolvable from the loader module table (never bundled). */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** Externals resolved from the loader module table. */
const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES]

/** Wire/type layers a client bundle may inline. */
const INLINE_SAFE = /^@deepseek-ai\/dsh-(session|llm|brand|package-manifest)(\/|$)/

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

const REPOSITORY_ROOT = fileURLToPath(new URL('.', import.meta.url))

/** Rebase a physical lib-relative source onto a browser URL that mirrors the repository directories. */
function browserSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physicalSource = resolvePath(dirname(sourcemapPath), source)
  const rel = physicalSource.startsWith(REPOSITORY_ROOT)
    ? physicalSource.slice(REPOSITORY_ROOT.length).split(sep).join('/')
    : source
  return rel.startsWith('src/') ? `../../${rel}` : source
}

/** Node-half config: transpile tsc-emitted lib/types/*.js into lib/*.js. */
const hostConfig: UserConfig = {
  name: BUNDLE_ID,
  entry: ['lib/types/index.js', 'lib/types/typert.js', 'lib/types/types.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

/** Browser-half config: bundle src/client/index.ts into lib/client.js. */
const clientConfig: UserConfig = {
  name: `${BUNDLE_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  plugins: [{
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      if (INLINE_SAFE.test(source)) return null
      throw new Error(
        `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS) and is not an inline-safe wire layer — `
        + 'cross-plugin value imports are forbidden; collaborate through cordis services and type-only imports',
      )
    },
  }, {
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(`${BUNDLE_ID}/${basename(fileId)}`)};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(BUNDLE_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapPathTransform: browserSourcePath,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(BUNDLE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

/** Resolve an emitted JS asset import against its source-tree counterpart. */
function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${sep}lib${sep}types${sep}`
  const boundary = emitted.indexOf(marker)
  if (boundary < 0) return emitted
  return resolvePath(emitted.slice(0, boundary), 'src', emitted.slice(boundary + marker.length))
}

/** Select the current build face from the environment. */
export default (inlineConfig: Pick<UserConfig, 'env'>): UserConfig[] => {
  const face = inlineConfig.env?.DSH_BUILD_FACE
  if (face === undefined || face === 'client') return [hostConfig, clientConfig]
  if (face === 'host') return [hostConfig]
  throw new Error(`tsdown: --env.DSH_BUILD_FACE must be host or client, received ${String(face)}`)
}
