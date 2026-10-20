import type { BikeCapacityEvidence } from '../../src/domain/train.js'

export const cfrBikeCapacityPolicy = {
  evidence: {
    source: 'Transportul bicicletelor și schiurilor CFR Călători',
    sourceUrl: 'https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/',
    verifiedAt: '2026-10-15',
  } satisfies BikeCapacityEvidence,
} as const
