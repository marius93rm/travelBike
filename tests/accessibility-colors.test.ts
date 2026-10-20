import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(path.resolve(process.cwd(), 'src/styles.css'), 'utf8')
const rootTokens = stylesheet.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''

function colorToken(name: string) {
  const value = rootTokens.match(new RegExp(`--${name}:\\s*(#[\\da-fA-F]{6})\\s*;`))?.[1]
  if (!value) throw new Error(`Missing color token --${name}`)
  return value
}

function luminance(color: string) {
  const channels = color.slice(1).match(/../g)?.map((hex) => parseInt(hex, 16) / 255)
  if (!channels || channels.length !== 3) throw new Error(`Invalid hex color: ${color}`)
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

function contrastRatio(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}

describe('accessibility color contrast', () => {
  it('keeps eyebrow text at WCAG AA contrast on light and dark panels', () => {
    const lightRule = stylesheet.match(/\.eyebrow\s*\{([^}]*)\}/)?.[1]
    const rule = stylesheet.match(
      /\.search-shell \.eyebrow,\s*\.how-it-works \.eyebrow\s*\{([^}]*)\}/,
    )?.[1]
    expect(lightRule).toMatch(/color:\s*var\(--orange\)/)
    for (const background of [colorToken('cream'), colorToken('paper')]) {
      expect(contrastRatio(colorToken('orange'), background)).toBeGreaterThanOrEqual(4.5)
    }

    const foreground = colorToken('orange-on-dark')
    expect(rule).toMatch(/color:\s*var\(--orange-on-dark\)/)

    for (const background of [colorToken('pine-900'), colorToken('pine-950')]) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps cached and mixed freshness labels at WCAG AA contrast', () => {
    const rule = stylesheet.match(
      /\.data-state\.cache-cached,\s*\.data-state\.cache-mixed,\s*\.data-state\.cache-unknown\s*\{([^}]*)\}/,
    )?.[1]
    expect(rule).toMatch(/color:\s*(#[\da-fA-F]{6})/)
    const foreground = rule?.match(/color:\s*(#[\da-fA-F]{6})/)?.[1]
    expect(foreground).toBeDefined()
    expect(rule).toMatch(/background:\s*var\(--yellow-soft\)/)
    expect(contrastRatio(foreground!, colorToken('yellow-soft'))).toBeGreaterThanOrEqual(4.5)
  })
})
