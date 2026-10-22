import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

export interface DiagramRenderResult {
  success: boolean
  svg?: string
  error?: string
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildFallbackSvg(diagramType: string, code: string): string {
  const lines = code
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('%%') && !l.startsWith('@startuml') && !l.startsWith('@enduml'))

  const nodes: string[] = []
  for (const line of lines) {
    const bracketMatches = [...line.matchAll(/\[([^\]]+)\]|\(([^)]+)\)|"([^"]+)"/g)]
    if (bracketMatches.length > 0) {
      for (const m of bracketMatches) {
        const label = (m[1] || m[2] || m[3] || '').trim()
        if (label && !nodes.includes(label)) nodes.push(label)
      }
    } else if (line.includes('-->') || line.includes('->')) {
      const parts = line.split(/-->|->/).map(p => p.replace(/[^a-zA-Z0-9 _-]/g, '').trim()).filter(Boolean)
      for (const p of parts) {
        if (p && !nodes.includes(p)) nodes.push(p)
      }
    }
  }

  const displayNodes = nodes.length > 0 ? nodes.slice(0, 6) : lines.slice(0, 5)
  const height = Math.max(240, displayNodes.length * 70 + 80)
  const width = 640

  const boxes = displayNodes
    .map((label, idx) => {
      const y = 60 + idx * 65
      const arrow =
        idx < displayNodes.length - 1
          ? `<line x1="320" y1="${y + 40}" x2="320" y2="${y + 65}" stroke="#6366f1" stroke-width="2" marker-end="url(#arrow)" />`
          : ''
      return `
        <rect x="140" y="${y}" width="360" height="40" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5" />
        <text x="320" y="${y + 25}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#1e1b4b">${escapeXml(label.slice(0, 48))}</text>
        ${arrow}
      `
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff" rx="12" />
  <text x="24" y="32" font-family="sans-serif" font-size="12" font-weight="bold" fill="#64748b">${escapeXml(diagramType.toUpperCase())} DIAGRAM</text>
  ${boxes}
</svg>`
}

export class DiagramRenderer {
  private static tempDir: string

  static getTempDir(): string {
    if (!this.tempDir) {
      this.tempDir = mkdtempSync(join(tmpdir(), 'alex-diagrams-'))
    }
    return this.tempDir
  }

  static async renderMermaid(code: string): Promise<DiagramRenderResult> {
    if (!code || !code.trim()) {
      return { success: false, error: 'Diagram code is empty' }
    }
    const cliPath = join(process.cwd(), 'node_modules', '.bin', 'mmdc')
    if (existsSync(cliPath)) {
      const tempDir = this.getTempDir()
      const inputFile = join(tempDir, `mermaid-${Date.now()}.mmd`)
      const outputFile = join(tempDir, `mermaid-${Date.now()}.svg`)
      try {
        writeFileSync(inputFile, code)
        execSync(`"${cliPath}" -i "${inputFile}" -o "${outputFile}" -b transparent`, {
          stdio: 'pipe',
          timeout: 15000,
        })
        const svg = readFileSync(outputFile, 'utf-8')
        unlinkSync(inputFile)
        unlinkSync(outputFile)
        return { success: true, svg }
      } catch {
        // Fall through to pure SVG renderer
      }
    }

    return {
      success: true,
      svg: buildFallbackSvg('mermaid', code),
    }
  }

  static async renderGraphviz(code: string): Promise<DiagramRenderResult> {
    if (!code || !code.trim()) {
      return { success: false, error: 'Diagram code is empty' }
    }
    try {
      const vizMod = await import('@viz-js/viz')
      const instance = await vizMod.instance()
      const svg = instance.renderString(code, { format: 'svg' })
      if (svg && svg.includes('<svg')) {
        return { success: true, svg }
      }
    } catch {
      // Fall back to pure SVG renderer if @viz-js/viz is unavailable
    }

    return {
      success: true,
      svg: buildFallbackSvg('graphviz', code),
    }
  }

  static async renderPlantUML(code: string): Promise<DiagramRenderResult> {
    if (!code || !code.trim()) {
      return { success: false, error: 'Diagram code is empty' }
    }
    return {
      success: true,
      svg: buildFallbackSvg('plantuml', code),
    }
  }

  static async render(diagramType: string, code: string): Promise<DiagramRenderResult> {
    switch (diagramType) {
      case 'mermaid':
        return this.renderMermaid(code)
      case 'graphviz':
        return this.renderGraphviz(code)
      case 'plantuml':
        return this.renderPlantUML(code)
      default:
        return { success: false, error: `Unsupported diagram type: ${diagramType}` }
    }
  }

  static cleanup() {
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true })
      } catch {}
      this.tempDir = ''
    }
  }
}

export async function renderDiagramFromCode(
  type: 'mermaid' | 'graphviz' | 'plantuml',
  code: string
): Promise<{ svg: string; width: number; height: number }> {
  const result = await DiagramRenderer.render(type, code)

  if (!result.success || !result.svg) {
    throw new Error(result.error || 'Failed to render diagram')
  }

  const widthMatch = result.svg.match(/width="(\d+(?:\.\d+)?)"/)
  const heightMatch = result.svg.match(/height="(\d+(?:\.\d+)?)"/)

  return {
    svg: result.svg,
    width: widthMatch ? parseFloat(widthMatch[1]) : 640,
    height: heightMatch ? parseFloat(heightMatch[1]) : 400,
  }
}