import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOURCE_URL,
  extractStationCatalog,
  officialSourceUrl,
  renderStationsModule,
  resolveSourceResourceUrl,
} from '../scripts/station-catalog.mjs'

const sourceUrl =
  'https://data.gov.ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2/resource/0f67143e-bb88-4a06-8e7a-b35b1eb91329/download/trenuri-2025-2026_sntfc.xml'

function timetableXml(overrides: Record<string, string> = {}) {
  const metadata = {
    DataExport: '20251203',
    MtValabilDeLa: '20251214',
    MtValabilPinaLa: '20261212',
    ...overrides,
  }
  return `<root>
    <Mt ${Object.entries(metadata).map(([key, value]) => `${key}="${value}"`).join(' ')} />
    <Trasa CodStatieInitiala="20050" CodStatieFinala="30691" />
    <ElementTrasa CodStaOrigine="20050" DenStaOrigine="Codlea Hm." CodStaDest="30691" DenStaDestinatie="Braşov" TipOprire="C" />
  </root>`
}

describe('station catalog generator', () => {
  it('requires an exact official source URL for local XML and preserves it', () => {
    expect(resolveSourceResourceUrl(true, sourceUrl)).toBe(sourceUrl)
    expect(resolveSourceResourceUrl(false, undefined)).toBe(DEFAULT_SOURCE_URL)
    expect(() => resolveSourceResourceUrl(true, undefined)).toThrow(/STATIONS_XML_URL/)
  })

  it('accepts only the configured official data.gov.ro CFR timetable resource', () => {
    expect(officialSourceUrl(sourceUrl).toString()).toBe(sourceUrl)
    expect(() => officialSourceUrl('https://example.com/timetable.xml')).toThrow()
    expect(() => officialSourceUrl(`${sourceUrl}?download=1`)).toThrow()
    expect(() => officialSourceUrl(
      'https://data.gov.ro/dataset/other/resource/other/download/timetable.xml',
    )).toThrow()
  })

  it('extracts station ids, display names, and validated source dates', () => {
    const catalog = extractStationCatalog(timetableXml())

    expect(catalog.stations).toEqual([
      { id: 'brasov', name: 'Brașov', providerName: 'Braşov' },
      { id: 'codlea', name: 'Codlea', providerName: 'Codlea Hm.' },
    ])
    expect(catalog.validity).toEqual({
      exportedAt: '2025-12-03',
      validFrom: '2025-12-14',
      validUntil: '2026-12-12',
    })
  })

  it('decodes numeric XML character references in station names', () => {
    const xml = timetableXml().replace(
      'DenStaDestinatie="Braşov"',
      'DenStaDestinatie="Bra&#x0219;ov"',
    )

    expect(extractStationCatalog(xml).stations[0]).toEqual({
      id: 'brasov',
      name: 'Brașov',
      providerName: 'Brașov',
    })
  })

  it('accepts XML attributes enclosed in single quotes', () => {
    const xml = timetableXml().replace(
      'DenStaDestinatie="Braşov"',
      "DenStaDestinatie='Braşov'",
    )

    expect(extractStationCatalog(xml).stations[0]).toEqual({
      id: 'brasov',
      name: 'Brașov',
      providerName: 'Braşov',
    })
  })

  it.each([
    ['missing export date', { DataExport: '' }],
    ['malformed export date', { DataExport: '2025123' }],
    ['impossible export date', { DataExport: '20250230' }],
    ['missing validity date', { MtValabilDeLa: '' }],
    ['reversed validity period', { MtValabilDeLa: '20261213' }],
  ])('rejects a timetable with %s', (_caseName, overrides) => {
    expect(() => extractStationCatalog(timetableXml(overrides))).toThrow()
  })

  it('rejects an XML resource without usable commercial stations', () => {
    expect(() => extractStationCatalog(
      '<root><Mt DataExport="20251203" MtValabilDeLa="20251214" MtValabilPinaLa="20261212" /></root>',
    )).toThrow(/station/i)
  })

  it('rejects a truncated XML document even when earlier station records are usable', () => {
    const truncatedXml = timetableXml().replace('</root>', '<unfinished>')

    expect(() => extractStationCatalog(truncatedXml)).toThrow(/XML/i)
  })

  it('embeds the exact official resource URL in generated catalog metadata', () => {
    const catalog = extractStationCatalog(timetableXml())
    const output = renderStationsModule(catalog, officialSourceUrl(sourceUrl))

    expect(output).toContain(`// Source resource: ${sourceUrl}.`)
    expect(output).toContain(`"sourceResourceUrl": "${sourceUrl}"`)
    expect(output).toContain('"validUntil": "2026-12-12"')
  })
})
