import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// Tiptap v3 ships source TypeScript without pre-built dist/ files, but their
// package.json "exports" reference ./dist/index.js. This function creates
// stub dist/ files that re-export from source so both esbuild (dev) and
// rollup (prod) can resolve packages correctly.
function patchTiptapPackage(pkgDir: string) {
  if (!fs.existsSync(pkgDir) || !fs.statSync(pkgDir).isDirectory()) return

  const srcEntry = path.join(pkgDir, 'src', 'index.ts')
  const distDir = path.join(pkgDir, 'dist')

  // Create main dist/index.js stub
  if (fs.existsSync(srcEntry) && !fs.existsSync(path.join(distDir, 'index.js'))) {
    fs.mkdirSync(distDir, { recursive: true })
    const srcContent = fs.readFileSync(srcEntry, 'utf-8')
    const hasDefault = /export\s+default\s/.test(srcContent)
    const defaultLine = hasDefault ? `\nexport { default } from '../src/index.ts';\n` : '\n'

    for (const ext of ['index.js', 'index.d.ts', 'index.d.cts']) {
      fs.writeFileSync(path.join(distDir, ext), `export * from '../src/index.ts';${defaultLine}`)
    }
    fs.writeFileSync(path.join(distDir, 'index.cjs'), `module.exports = require('../src/index.ts');\n`)
  }

  // Find wrapper .js files that reference ../dist/ and create missing targets
  // e.g. jsx-runtime/index.js -> export * from '../dist/jsx-runtime/jsx-runtime.js'
  const distRefRe = /from\s+['"](\.\.\/(dist\/[^'"]+))['"]/
  for (const entry of fs.readdirSync(pkgDir)) {
    const subDir = path.join(pkgDir, entry)
    if (entry === 'dist' || entry === 'src' || entry === 'node_modules') continue
    if (!fs.existsSync(subDir) || !fs.statSync(subDir).isDirectory()) continue

    for (const file of fs.readdirSync(subDir)) {
      if (!file.endsWith('.js')) continue
      const filePath = path.join(subDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const match = content.match(distRefRe)
      if (!match) continue

      const distTarget = path.join(pkgDir, match[2])
      if (fs.existsSync(distTarget)) continue

      // Find the source .ts equivalent
      // dist/jsx-runtime/jsx-runtime.js -> try src/jsx-runtime.ts, src/jsx-runtime/jsx-runtime.ts
      const distRelPath = match[2] // e.g. "dist/jsx-runtime/jsx-runtime.js"
      const distParts = distRelPath.replace(/^dist\//, '').replace(/\.js$/, '')
      const candidates = [
        path.join(pkgDir, 'src', `${distParts}.ts`),
        path.join(pkgDir, 'src', `${path.basename(distParts)}.ts`),
        path.join(pkgDir, 'src', `${path.dirname(distParts).split('/')[0]}.ts`),
      ]

      const srcFile = candidates.find((c) => fs.existsSync(c))
      if (srcFile) {
        const targetDir = path.dirname(distTarget)
        fs.mkdirSync(targetDir, { recursive: true })
        const relPath = path.relative(targetDir, srcFile)
        fs.writeFileSync(distTarget, `export * from '${relPath}';\n`)
      }
    }
  }

  // Handle @tiptap/pm submodules
  const pkgName = path.basename(pkgDir)
  if (pkgName === 'pm') {
    const pmDistDir = path.join(pkgDir, 'dist')
    for (const sub of fs.readdirSync(pkgDir)) {
      const subDir = path.join(pkgDir, sub)
      if (!fs.statSync(subDir).isDirectory()) continue
      if (['dist', 'node_modules'].includes(sub)) continue
      const subIndex = path.join(subDir, 'index.ts')
      if (!fs.existsSync(subIndex)) continue

      const distSubDir = path.join(pmDistDir, sub)
      const distSubFile = path.join(distSubDir, 'index.js')
      if (!fs.existsSync(distSubFile)) {
        fs.mkdirSync(distSubDir, { recursive: true })
        const relPath = path.relative(distSubDir, subIndex)
        fs.writeFileSync(distSubFile, `export * from '${relPath}';\n`)
        fs.writeFileSync(
          path.join(distSubDir, 'index.cjs'),
          `module.exports = require('${relPath}');\n`,
        )
      }
    }
  }
}

function ensureTiptapDistStubs() {
  const nodeModules = path.resolve(__dirname, 'node_modules')

  // Patch hoisted packages
  const tiptapDir = path.join(nodeModules, '@tiptap')
  if (fs.existsSync(tiptapDir)) {
    for (const entry of fs.readdirSync(tiptapDir)) {
      patchTiptapPackage(path.join(tiptapDir, entry))
    }
  }

  // Patch packages in pnpm store
  const pnpmDir = path.join(nodeModules, '.pnpm')
  if (!fs.existsSync(pnpmDir)) return

  for (const storeEntry of fs.readdirSync(pnpmDir)) {
    if (!storeEntry.startsWith('@tiptap+')) continue
    const nestedTiptapDir = path.join(pnpmDir, storeEntry, 'node_modules', '@tiptap')
    if (!fs.existsSync(nestedTiptapDir)) continue

    for (const pkg of fs.readdirSync(nestedTiptapDir)) {
      patchTiptapPackage(path.join(nestedTiptapDir, pkg))
    }
  }
}

// Run at config load time, before Vite's dep optimizer
ensureTiptapDistStubs()

const config = defineConfig({
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})

export default config
