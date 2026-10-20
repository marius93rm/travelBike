import type { BikeReservationEvidence } from '../../src/domain/train.js'

export const cfrBikeReservationPolicy = {
  // CFR's public rule is conditional on the train's reservation regime. The
  // current journey response parser does not extract that per-train regime.
  status: 'unknown',
  evidence: {
    source: 'Transportul bicicletelor și schiurilor CFR Călători — punctul 3',
    sourceUrl: 'https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/',
    verifiedAt: '2026-10-15',
  } satisfies BikeReservationEvidence,
} as const
