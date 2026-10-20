import type { BikeFeeEvidence } from '../../src/domain/train.js'

export const cfrBikeTariffPolicy = {
  evidence: {
    source: 'Întrebări frecvente CFR — tarife biciclete nepliabile',
    sourceUrl: 'https://www.cfrcalatori.ro/intrebari-frecvente/',
    verifiedAt: '2026-10-15',
    notes: [{
      text: 'Există o diferență între pagina dedicată CFR (Regio, Interregio și Intercity) și FAQ-ul CFR, care indică orice rang cu serviciu. Verifică tariful final la operator.',
      source: 'Transportul bicicletelor și schiurilor CFR Călători',
      sourceUrl: 'https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/',
      verifiedAt: '2026-10-15',
    }],
    bands: [
      { minDistanceKm: 1, maxDistanceKm: 60, feeLei: 8 },
      { minDistanceKm: 61, maxDistanceKm: 120, feeLei: 11.5 },
      { minDistanceKm: 121, maxDistanceKm: 250, feeLei: 17.5 },
      { minDistanceKm: 251, maxDistanceKm: 500, feeLei: 23.5 },
      { minDistanceKm: 501, maxDistanceKm: null, feeLei: 29 },
    ],
  } satisfies BikeFeeEvidence,
} as const
