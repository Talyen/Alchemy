import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

type GuardrailFinding = {
  file: string
  line: number
  rule: string
  snippet: string
}

type GuardrailMatch = {
  index: number
  line: number
  snippet: string
}

const INCLUDED_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js'])
const SCAN_DIRECTORIES = ['src/components', 'src/ui']
const ALLOW_ABSOLUTE_MARKER = 'ui-allow-absolute'

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const CLASSNAME_ABSOLUTE_PATTERN = /className\s*=\s*["'`][^"'`]*(?:\babsolute\b|\bfixed\b)[^"'`]*["'`]/g
const INLINE_OFFSET_PATTERN = /style\s*=\s*\{\{[^}]*\b(left|right|top|bottom)\s*:\s*['"]?\d+px/gs
const FIXED_SIZE_PATTERN = /(?:className\s*=\s*["'`][^"'`]*(?:\bw-\[\d+px\]|\bh-\[\d+px\]|\bmin-w-\[\d+px\]|\bmin-h-\[\d+px\]|\bmax-w-\[\d+px\]|\bmax-h-\[\d+px\])[^"'`]*["'`])|(?:style\s*=\s*\{\{[^}]*\b(width|height|minWidth|minHeight|maxWidth|maxHeight)\s*:\s*['"]?\d+px[^}]*\}\})/gs
const PIXEL_OFFSET_CLASS_PATTERN = /className\s*=\s*["'`][^"'`]*(?:\bleft-\[\d+px\]|\bright-\[\d+px\]|\btop-\[\d+px\]|\bbottom-\[\d+px\]|\btranslate-x-\[\d+px\]|\btranslate-y-\[\d+px\])[^"'`]*["'`]/g
const SCREEN_SIZE_PATTERN = /className\s*=\s*["'`][^"'`]*(?:\bw-screen\b|\bh-screen\b)[^"'`]*["'`]/g

function collectFiles(root: string): string[] {
  const files: string[] = []
  const stack = [...SCAN_DIRECTORIES.map((dir) => path.join(root, dir))]

  while (stack.length > 0) {
    const current = stack.pop()!
    let entries: string[] = []
    try {
      entries = readdirSync(current)
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry)
      const stats = statSync(fullPath)
      if (stats.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      if (!INCLUDED_EXTENSIONS.has(path.extname(fullPath))) continue
      files.push(fullPath)
    }
  }

  return files
}

function toLineNumber(source: string, index: number): number {
  return source.slice(0, index).split(/\r\n|\r|\n/).length
}

function readLine(source: string, lineNumber: number): string {
  const lines = source.split(/\r\n|\r|\n/)
  return lines[Math.max(0, lineNumber - 1)]?.trim() ?? ''
}

function hasNearbyAllowMarker(source: string, lineNumber: number): boolean {
  const lines = source.split(/\r\n|\r|\n/)
  const from = Math.max(0, lineNumber - 4)
  const to = Math.min(lines.length - 1, lineNumber + 1)
  for (let i = from; i <= to; i += 1) {
    if ((lines[i] ?? '').includes(ALLOW_ABSOLUTE_MARKER)) {
      return true
    }
  }
  return false
}

function collectMatches(source: string, pattern: RegExp): GuardrailMatch[] {
  const matches: GuardrailMatch[] = []
  pattern.lastIndex = 0
  let match = pattern.exec(source)
  while (match) {
    const line = toLineNumber(source, match.index)
    matches.push({
      index: match.index,
      line,
      snippet: readLine(source, line),
    })
    match = pattern.exec(source)
  }
  return matches
}

function findMatches(source: string, file: string): GuardrailFinding[] {
  const findings: GuardrailFinding[] = []

  const addMatches = (pattern: RegExp, rule: string, filter?: (match: GuardrailMatch) => boolean) => {
    const matches = collectMatches(source, pattern)
    for (const match of matches) {
      if (filter && !filter(match)) continue
      findings.push({ file, line: match.line, rule, snippet: match.snippet })
    }
  }

  addMatches(CLASSNAME_ABSOLUTE_PATTERN, 'absolute/fixed layout positioning', match => !hasNearbyAllowMarker(source, match.line))
  addMatches(INLINE_OFFSET_PATTERN, 'hardcoded pixel offsets in inline style')
  addMatches(PIXEL_OFFSET_CLASS_PATTERN, 'pixel offset utility class detected')
  addMatches(FIXED_SIZE_PATTERN, 'fixed pixel sizing that can break scaling')
  addMatches(SCREEN_SIZE_PATTERN, 'screen-sized utility class can break container scaling')

  return findings
}

function scanWorkspace(root: string): GuardrailFinding[] {
  const findings: GuardrailFinding[] = []
  for (const file of collectFiles(root)) {
    const source = readFileSync(file, 'utf8')
    findings.push(...findMatches(source, path.relative(root, file).replace(/\\/g, '/')))
  }
  return findings
}

function printFindings(findings: GuardrailFinding[]) {
  if (findings.length === 0) {
    console.info('[ui-guardrails] no static layout violations detected')
    return
  }

  console.warn(`[ui-guardrails] ${findings.length} potential layout violations detected`)
  for (const finding of findings.slice(0, 60)) {
    console.warn(`  - ${finding.file}:${finding.line} ${finding.rule}`)
    if (finding.snippet) {
      console.warn(`    ${finding.snippet}`)
    }
  }

  if (findings.length > 60) {
    console.warn(`  ... ${findings.length - 60} more findings not shown`)
  }
}

export function uiGuardrailsPlugin(): Plugin {
  let root = process.cwd()
  const strictMode = normalizeBoolean(process.env.UI_GUARDRAILS_STRICT)

  const runScan = () => {
    const findings = scanWorkspace(root)
    printFindings(findings)
    return findings
  }

  return {
    name: 'alchemy-ui-guardrails',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      const findings = runScan()
      if (strictMode && findings.length > 0) {
        this.error(`[ui-guardrails] strict mode is enabled and found ${findings.length} layout violations`)
      }
    },
    configureServer(server) {
      runScan()
      server.watcher.on('change', (filePath) => {
        if (!INCLUDED_EXTENSIONS.has(path.extname(filePath))) return
        if (!filePath.includes(`${path.sep}src${path.sep}`)) return
        runScan()
      })
    },
  }
}
