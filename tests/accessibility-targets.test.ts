import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(path.resolve(process.cwd(), 'src/styles.css'), 'utf8')

function ruleFor(selector: string) {
  return stylesheet.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1]
}

describe('accessibility target sizes', () => {
  it('gives standalone source and evidence links at least a 24px target height', () => {
    const selectors = [
      '.result-source-attribution a',
      '.fee-evidence a',
      '.capacity-evidence a',
      '.reservation-evidence a',
      '.source-details .source-link',
    ]

    for (const selector of selectors) {
      expect(ruleFor(selector), selector).toMatch(/min-height:\s*(?:2[4-9]|[3-9]\d|\d{3,})px/)
    }
  })
})
