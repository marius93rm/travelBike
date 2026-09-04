import {
  generatedStationCatalogValidity,
  generatedStations,
} from './stations.generated.js'

export const stations = generatedStations

export const stationCatalogMeta = {
  source: 'data.gov.ro / S.C. Informatică Feroviară S.A.',
  sourceUrl:
    'https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2',
  ...generatedStationCatalogValidity,
} as const

export const stationsById = new Map(
  stations.map((station) => [station.id, station]),
)

export function normalizeStationSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .toLocaleLowerCase('ro')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function searchStations(query: string, limit = 8) {
  const normalizedQuery = normalizeStationSearch(query)
  if (!normalizedQuery) return stations.slice(0, limit)

  return stations
    .map((station) => {
      const normalizedName = normalizeStationSearch(station.name)
      const index = normalizedName.indexOf(normalizedQuery)
      const rank =
        normalizedName === normalizedQuery
          ? 0
          : normalizedName === `${normalizedQuery} nord`
            ? 1
            : index === 0
              ? 2
              : 3
      return { station, index, normalizedName, rank }
    })
    .filter(({ index }) => index >= 0)
    .sort((left, right) =>
      left.rank - right.rank ||
      left.index - right.index ||
      left.normalizedName.length - right.normalizedName.length ||
      left.station.name.localeCompare(right.station.name, 'ro'),
    )
    .slice(0, limit)
    .map(({ station }) => station)
}
