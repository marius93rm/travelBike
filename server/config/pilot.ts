import { stationsById } from '../../src/domain/stations.js'

export const pilotAllowlistVersion = '2026-09-16-counties-v1'
export const pilotAllowlistVerifiedAt = '2026-09-16'

export type PilotCounty = 'Brașov' | 'Sibiu' | 'Covasna' | 'Mureș'

export interface PilotStationRecord {
  id: string
  county: PilotCounty
  source: string
  sourceUrl: string
  verifiedAt: string
}

const catalogSourceUrl =
  'https://data.gov.ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2/resource/0f67143e-bb88-4a06-8e7a-b35b1eb91329/download/trenuri-2025-2026_sntfc.xml'
const source = 'CFR 2025-2026 station catalog; manual county review' as const

function pilotStation(id: string, county: PilotCounty): PilotStationRecord {
  return {
    id,
    county,
    source,
    sourceUrl: catalogSourceUrl,
    verifiedAt: pilotAllowlistVerifiedAt,
  }
}

/**
 * Every entry is an active passenger point in the versioned CFR catalog and
 * was manually assigned to the county where the point is physically located.
 * Points visible only on historical or private-operator lists stay out until
 * they are present in the catalog used by this release.
 */
export const pilotStations: readonly PilotStationRecord[] = [
  // Brașov
  pilotStation('brasov', 'Brașov'),
  pilotStation('codlea', 'Brașov'),
  pilotStation('cfr-20012', 'Brașov'), // Bartolomeu
  pilotStation('cfr-20036', 'Brașov'), // Ghimbav
  pilotStation('cfr-20074', 'Brașov'), // Dumbrăvița Bârsei
  pilotStation('cfr-20086', 'Brașov'), // Vlădeni Ardeal
  pilotStation('cfr-20103', 'Brașov'), // Valea Homorod
  pilotStation('cfr-20127', 'Brașov'), // Brădet
  pilotStation('cfr-20141', 'Brașov'), // Perșani
  pilotStation('cfr-20165', 'Brașov'), // Șercaia
  pilotStation('cfr-20206', 'Brașov'), // Mândra Oltului
  pilotStation('cfr-20232', 'Brașov'), // Făgăraș
  pilotStation('cfr-20244', 'Brașov'), // Beclean pe Olt
  pilotStation('cfr-20268', 'Brașov'), // Dridif
  pilotStation('cfr-20270', 'Brașov'), // Voila
  pilotStation('cfr-20309', 'Brașov'), // Viștea
  pilotStation('cfr-20311', 'Brașov'), // Ucea
  pilotStation('cfr-30615', 'Brașov'), // Predeal
  pilotStation('cfr-30641', 'Brașov'), // Timișu de Sus
  pilotStation('cfr-30653', 'Brașov'), // Timișu de Jos
  pilotStation('cfr-30665', 'Brașov'), // Dârste
  pilotStation('cfr-30756', 'Brașov'), // Brașov Triaj
  pilotStation('cfr-30835', 'Brașov'), // Stupini
  pilotStation('cfr-30859', 'Brașov'), // Bod
  pilotStation('cfr-30885', 'Brașov'), // Feldioara
  pilotStation('cfr-30897', 'Brașov'), // Rotbav
  pilotStation('cfr-30902', 'Brașov'), // Vadu Roșu
  pilotStation('cfr-30914', 'Brașov'), // Măieruș
  pilotStation('cfr-30938', 'Brașov'), // Apața
  pilotStation('cfr-30952', 'Brașov'), // Ormeniș
  pilotStation('cfr-31011', 'Brașov'), // Racoș
  pilotStation('cfr-31023', 'Brașov'), // Mateiaș
  pilotStation('cfr-31047', 'Brașov'), // Rupea
  pilotStation('cfr-31073', 'Brașov'), // Cața
  pilotStation('cfr-31097', 'Brașov'), // Paloș Ardeal
  pilotStation('cfr-31102', 'Brașov'), // Beia
  pilotStation('cfr-40024', 'Brașov'), // Hărman
  pilotStation('cfr-40050', 'Brașov'), // Prejmer
  pilotStation('cfr-57223', 'Brașov'), // Pavilion CFR Brașov Triaj

  // Sibiu
  pilotStation('cfr-20359', 'Sibiu'), // Arpaș
  pilotStation('cfr-20361', 'Sibiu'), // Cârța
  pilotStation('cfr-20373', 'Sibiu'), // Scoreiu
  pilotStation('cfr-20385', 'Sibiu'), // Sărata Colun
  pilotStation('cfr-20397', 'Sibiu'), // Porumbacu
  pilotStation('cfr-20414', 'Sibiu'), // Avrig
  pilotStation('cfr-20440', 'Sibiu'), // Mârșa
  pilotStation('cfr-20464', 'Sibiu'), // Racovița
  pilotStation('cfr-20476', 'Sibiu'), // Sebeș Olt
  pilotStation('cfr-20490', 'Sibiu'), // Podu Olt
  pilotStation('cfr-20517', 'Sibiu'), // Tălmaciu
  pilotStation('cfr-20531', 'Sibiu'), // Veștem
  pilotStation('cfr-20543', 'Sibiu'), // Mohu
  pilotStation('cfr-20567', 'Sibiu'), // Sibiu Gr. Șelimbăr
  pilotStation('cfr-20622', 'Sibiu'), // Sibiu Triaj
  pilotStation('cfr-20634', 'Sibiu'), // Atelier Zona
  pilotStation('cfr-20658', 'Sibiu'), // Sibiu
  pilotStation('cfr-20713', 'Sibiu'), // Sibiu h.(203)
  pilotStation('cfr-20749', 'Sibiu'), // Turnișor
  pilotStation('cfr-20775', 'Sibiu'), // Cristian Sibiu
  pilotStation('cfr-20787', 'Sibiu'), // Orlat
  pilotStation('cfr-20799', 'Sibiu'), // Sibiel
  pilotStation('cfr-20804', 'Sibiu'), // Săcelu Sibiului
  pilotStation('cfr-20816', 'Sibiu'), // Săliște
  pilotStation('cfr-20830', 'Sibiu'), // Aciliu
  pilotStation('cfr-20842', 'Sibiu'), // Tilișca
  pilotStation('cfr-20866', 'Sibiu'), // Apoldu de Sus
  pilotStation('cfr-20880', 'Sibiu'), // Apoldu de Jos
  pilotStation('cfr-20892', 'Sibiu'), // Miercurea Sibiu
  pilotStation('cfr-20919', 'Sibiu'), // Băile Miercurea
  pilotStation('cfr-22694', 'Sibiu'), // Turnu Roșu
  pilotStation('cfr-22670', 'Sibiu'), // Valea Mărului
  pilotStation('cfr-25402', 'Sibiu'), // Valea Viilor
  pilotStation('cfr-31279', 'Sibiu'), // Dumbrăveni
  pilotStation('cfr-31293', 'Sibiu'), // Ațel
  pilotStation('cfr-31308', 'Sibiu'), // Bratei
  pilotStation('cfr-31334', 'Sibiu'), // Mediaș
  pilotStation('cfr-31372', 'Sibiu'), // Târnava
  pilotStation('cfr-31401', 'Sibiu'), // Copșa Mică
  pilotStation('cfr-31437', 'Sibiu'), // Micăsasa
  pilotStation('cfr-31255', 'Sibiu'), // Luna
  pilotStation('cfr-33758', 'Sibiu'), // Mândra
  pilotStation('cfr-33710', 'Sibiu'), // Ocna Sibiului
  pilotStation('cfr-33746', 'Sibiu'), // Băile Ocna Sibiului
  pilotStation('cfr-33760', 'Sibiu'), // Loamneș
  pilotStation('cfr-33772', 'Sibiu'), // Hașag
  pilotStation('cfr-33784', 'Sibiu'), // Veseud
  pilotStation('cfr-33796', 'Sibiu'), // Șeica Mare h.
  pilotStation('cfr-33801', 'Sibiu'), // Șeica Mare Hm.
  pilotStation('cfr-33825', 'Sibiu'), // Agârbiciu
  pilotStation('cfr-33837', 'Sibiu'), // Axente Sever
  pilotStation('cfr-57118', 'Sibiu'), // Șeica Mică

  // Covasna
  pilotStation('cfr-40036', 'Covasna'), // Ilieni
  pilotStation('cfr-40074', 'Covasna'), // Chichiș
  pilotStation('cfr-40103', 'Covasna'), // Ozun
  pilotStation('cfr-40139', 'Covasna'), // Sfântu Gheorghe
  pilotStation('cfr-40165', 'Covasna'), // Arcuș
  pilotStation('cfr-40177', 'Covasna'), // Bodoc
  pilotStation('cfr-40191', 'Covasna'), // Malnaș
  pilotStation('cfr-40206', 'Covasna'), // Malnaș Băi
  pilotStation('cfr-40220', 'Covasna'), // Bicsadu Oltului

  // Mureș
  pilotStation('cfr-31126', 'Mureș'), // Archita
  pilotStation('cfr-31140', 'Mureș'), // Mureni
  pilotStation('cfr-31164', 'Mureș'), // Vânători
  pilotStation('cfr-31190', 'Mureș'), // Albești Târnava
  pilotStation('cfr-31217', 'Mureș'), // Sighișoara
  pilotStation('cfr-31243', 'Mureș'), // Daneș
  pilotStation('cfr-57132', 'Mureș'), // Saschiz
  pilotStation('cfr-40696', 'Mureș'), // Ciobotani
  pilotStation('cfr-40701', 'Mureș'), // Stânceni Hm.
  pilotStation('cfr-40713', 'Mureș'), // Stânceni h.
  pilotStation('cfr-40725', 'Mureș'), // Stânceni Neagra
  pilotStation('cfr-40749', 'Mureș'), // Lunca Bradului
  pilotStation('cfr-40763', 'Mureș'), // Andreneasa
  pilotStation('cfr-40787', 'Mureș'), // Răstolița
  pilotStation('cfr-40799', 'Mureș'), // Borzia
  pilotStation('cfr-40804', 'Mureș'), // Deda Bistra
  pilotStation('cfr-40830', 'Mureș'), // Deda
  pilotStation('cfr-40866', 'Mureș'), // Morăreni
  pilotStation('cfr-40878', 'Mureș'), // Râpa de Jos
  pilotStation('cfr-42400', 'Mureș'), // Rușii Munți
  pilotStation('cfr-42412', 'Mureș'), // Aluniș Mureș
  pilotStation('cfr-42424', 'Mureș'), // Halta Aluniș
  pilotStation('cfr-42436', 'Mureș'), // Brâncovenești
  pilotStation('cfr-42448', 'Mureș'), // Ideciu de Jos
  pilotStation('cfr-42474', 'Mureș'), // Reghin
  pilotStation('cfr-42503', 'Mureș'), // Petelea
  pilotStation('cfr-42527', 'Mureș'), // Periș Mureș
  pilotStation('cfr-42539', 'Mureș'), // Gornești Mureș
  pilotStation('cfr-42541', 'Mureș'), // Dumbrăvioara
  pilotStation('cfr-42577', 'Mureș'), // Târgu Mureș Nord
  pilotStation('cfr-42606', 'Mureș'), // Târgu Mureș
  pilotStation('cfr-42620', 'Mureș'), // Azomureș
  pilotStation('cfr-42644', 'Mureș'), // Târgu Mureș Sud
  pilotStation('cfr-42670', 'Mureș'), // G-ral N. Dăscălescu
  pilotStation('cfr-42694', 'Mureș'), // Vidrasău
  pilotStation('cfr-42709', 'Mureș'), // Chirileu
  pilotStation('cfr-42711', 'Mureș'), // Sânpaul
  pilotStation('cfr-42723', 'Mureș'), // Ogra
  pilotStation('cfr-42735', 'Mureș'), // Cipău
  pilotStation('cfr-42747', 'Mureș'), // Iernut
  pilotStation('cfr-42761', 'Mureș'), // Cuci
  pilotStation('cfr-42785', 'Mureș'), // Bogata Mureș
  pilotStation('cfr-42814', 'Mureș'), // Luduș
  pilotStation('cfr-42840', 'Mureș'), // Chețani
] as const

const targetCounties: readonly PilotCounty[] = [
  'Brașov', 'Sibiu', 'Covasna', 'Mureș',
]
const ids = pilotStations.map((station) => station.id)
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
const unknownIds = ids.filter((id) => !stationsById.has(id))
const missingCounties = targetCounties.filter(
  (county) => !pilotStations.some((station) => station.county === county),
)

export const pilotAllowlistValidation = {
  duplicateIds: [...new Set(duplicateIds)],
  unknownIds,
  missingCounties,
  complete: duplicateIds.length === 0
    && unknownIds.length === 0
    && missingCounties.length === 0,
} as const

if (!pilotAllowlistValidation.complete) {
  throw new Error(`Invalid pilot station mapping: ${JSON.stringify(pilotAllowlistValidation)}`)
}

const reviewedStationIds = new Set(ids)
const PILOT_ALLOWLIST_COMPLETE = true

export const pilotRegionLabel = 'Brașov, Sibiu, Covasna și Mureș'

export interface PilotStationConfig {
  stationIds: ReadonlySet<string>
  region: string
  /** An explicit, catalog-valid mapping is required before live readiness. */
  mappingComplete: boolean
  source: 'default_hubs' | 'environment'
  allowlistVersion: string
  verifiedAt: string
}

export function createPilotStationConfig(
  configuredIds = process.env.PILOT_STATION_IDS,
): PilotStationConfig {
  const requested = configuredIds
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const source = requested?.length ? 'environment' : 'default_hubs'
  const selectedIds = requested?.length ? requested : ids
  const validIds = selectedIds.filter((id) => reviewedStationIds.has(id))
  const selectedUniqueIds = new Set(selectedIds)

  return {
    stationIds: new Set(validIds),
    region: pilotRegionLabel,
    mappingComplete: PILOT_ALLOWLIST_COMPLETE
      && selectedUniqueIds.size === reviewedStationIds.size
      && validIds.length === selectedIds.length,
    source,
    allowlistVersion: pilotAllowlistVersion,
    verifiedAt: pilotAllowlistVerifiedAt,
  }
}

export function routeIsInPilot(
  pilot: PilotStationConfig,
  from: string,
  to?: string,
) {
  return pilot.stationIds.has(from) && (to === undefined || pilot.stationIds.has(to))
}
