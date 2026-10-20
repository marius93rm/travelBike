import type { BikeTicketPurchaseEvidence } from '../../src/domain/train.js'

export const cfrBikeTicketPolicy = {
  evidence: {
    source: 'Termeni CFR Călători online — bilet pentru bicicletă',
    sourceUrl: 'https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions',
    verifiedAt: '2026-10-15',
  } satisfies BikeTicketPurchaseEvidence,
} as const
