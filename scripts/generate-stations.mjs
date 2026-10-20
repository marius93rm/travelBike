import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  extractStationCatalog,
  renderStationsModule,
  resolveSourceResourceUrl,
} from './station-catalog.mjs'

const OUTPUT_URL = new URL('../src/domain/stations.generated.ts', import.meta.url)

async function loadXml(sourceResourceUrl, localPath) {
  if (localPath) return readFile(localPath, 'utf8')

  const response = await fetch(sourceResourceUrl)
  if (!response.ok) {
    throw new Error(`Station source returned ${response.status}`)
  }
  return response.text()
}

const localPath = process.argv[2]
const sourceResourceUrl = resolveSourceResourceUrl(Boolean(localPath), process.env.STATIONS_XML_URL)
const xml = await loadXml(sourceResourceUrl, localPath)
const catalog = extractStationCatalog(xml)
const output = renderStationsModule(catalog, sourceResourceUrl)

await writeFile(OUTPUT_URL, output)
console.log(`Generated ${catalog.stations.length} stations in ${fileURLToPath(OUTPUT_URL)}`)
