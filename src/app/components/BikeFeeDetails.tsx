import { ExternalLink } from 'lucide-react'
import type { TrainOption } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'
import { formatVerification } from '../format-verification.js'

interface BikeFeeDetailsProps {
  train: TrainOption
}

export function BikeFeeDetails({ train }: BikeFeeDetailsProps) {
  const evidence = train.bikeFeeEvidence
  const feeLabel = !evidence
    ? ro.feeUnknown
    : train.bikeFeeLei !== null
      ? `${train.bikeFeeLei} lei`
      : evidence.bands?.length
        ? ro.distanceBasedFeeRange(
          Math.min(...evidence.bands.map((band) => band.feeLei)),
          Math.max(...evidence.bands.map((band) => band.feeLei)),
        )
        : ro.distanceBasedFee

  return (
    <>
      <strong>{ro.fee(feeLabel)}</strong>
      {evidence ? (
        <small className="fee-evidence">
          <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">
            {evidence.source}
            <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only">{ro.opensNewTab}</span>
          </a>
          <span>{formatVerification(evidence.verifiedAt)}</span>
          {evidence.notes?.map((note) => (
            <span className="fee-evidence-note" key={`${note.sourceUrl}:${note.verifiedAt}`}>
              <span>{note.text}</span>
              <a href={note.sourceUrl} target="_blank" rel="noreferrer">
                {note.source}
                <ExternalLink size={13} aria-hidden="true" />
                <span className="sr-only">{ro.opensNewTab}</span>
              </a>
              <span>{formatVerification(note.verifiedAt)}</span>
            </span>
          ))}
        </small>
      ) : null}
    </>
  )
}
