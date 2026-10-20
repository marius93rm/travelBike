export const DEFAULT_SOURCE_URL: string

export interface GeneratedStation {
  id: string
  name: string
  providerName: string
}

export interface StationCatalog {
  stations: GeneratedStation[]
  validity: {
    exportedAt: string
    validFrom: string
    validUntil: string
  }
}

export function officialSourceUrl(value?: string | URL): URL
export function resolveSourceResourceUrl(localInput: boolean, configuredUrl?: string): string
export function extractStationCatalog(xml: string): StationCatalog
export function renderStationsModule(catalog: StationCatalog, sourceResourceUrl: string | URL): string
