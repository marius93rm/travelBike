import { Bike, TrainFront } from 'lucide-react'

export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Bike size={20} strokeWidth={2.2} />
      <span className="brand-divider" />
      <TrainFront size={18} strokeWidth={2.2} />
    </div>
  )
}
