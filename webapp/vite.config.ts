import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const ROOT_DIR = path.resolve(__dirname, '..')
const TEMPLATES_DIR = path.resolve(ROOT_DIR, 'src/templates')
const HTML_TEMPLATE_PATH = path.resolve(TEMPLATES_DIR, 'entry.html.hbs')
const MD_TEMPLATE_PATH = path.resolve(TEMPLATES_DIR, 'entry.md.hbs')
const CSS_TEMPLATE_PATH = path.resolve(TEMPLATES_DIR, 'entry.css')
const BUNDLE_PATH = path.resolve(TEMPLATES_DIR, 'templates.ts')

function toTemplateLiteralSource(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

function buildTemplateBundleSource(): string {
  const html = toTemplateLiteralSource(fs.readFileSync(HTML_TEMPLATE_PATH, 'utf8'))
  const md = toTemplateLiteralSource(fs.readFileSync(MD_TEMPLATE_PATH, 'utf8'))
  const css = toTemplateLiteralSource(fs.readFileSync(CSS_TEMPLATE_PATH, 'utf8'))

  return `/**
 * AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * Source files:
 * - src/templates/entry.html.hbs
 * - src/templates/entry.md.hbs
 * - src/templates/entry.css
 */

export const HTML_ENTRY_TEMPLATE = \`${html}\`;

export const MD_ENTRY_TEMPLATE = \`${md}\`;

export const ENTRY_CSS = \`${css}\`;
`
}

function syncTemplateBundle(): boolean {
  const next = buildTemplateBundleSource()
  const prev = fs.existsSync(BUNDLE_PATH) ? fs.readFileSync(BUNDLE_PATH, 'utf8') : ''
  if (prev === next) return false
  fs.writeFileSync(BUNDLE_PATH, next, 'utf8')
  return true
}

function templateSyncPlugin() {
  const sourceFiles = [HTML_TEMPLATE_PATH, MD_TEMPLATE_PATH, CSS_TEMPLATE_PATH]
  return {
    name: 'template-source-sync',
    buildStart() {
      syncTemplateBundle()
    },
    configureServer(server: any) {
      server.watcher.add(sourceFiles)
      const resync = () => {
        const updated = syncTemplateBundle()
        if (updated) {
          server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('change', (filePath: string) => {
        if (sourceFiles.includes(path.resolve(filePath))) resync()
      })
      server.watcher.on('add', (filePath: string) => {
        if (sourceFiles.includes(path.resolve(filePath))) resync()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/wiktionary-sdk/',
  plugins: [react(), templateSyncPlugin()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../src')
    }
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})

