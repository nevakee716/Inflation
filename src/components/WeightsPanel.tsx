import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { yoy, type Model, type Weights } from '@/lib/inflation'
import { formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  model: Model
  month: string
  weights: Weights
  reference: Weights
  onChange: (weights: Weights) => void
  onPreset: (preset: 'insee' | 'equal') => void
}

export function WeightsPanel({ model, month, weights, reference, onChange, onPreset }: Props) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  const refTotal = Object.values(reference).reduce((s, w) => s + w, 0)
  const max = Math.max(3000, ...Object.values(weights))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onPreset('insee')}>
          <RotateCcw /> Pondérations INSEE
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPreset('equal')}>
          Poids égaux
        </Button>
      </div>
      <ul className="flex flex-col gap-4">
        {model.divisions.map((d) => {
          const w = weights[d.key] ?? 0
          const share = total > 0 ? (w / total) * 100 : 0
          const refShare = refTotal > 0 ? ((reference[d.key] ?? 0) / refTotal) * 100 : 0
          const rate = yoy(model, d.key, month)
          const moved = Math.abs(share - refShare) >= 0.05
          return (
            <li key={d.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate" title={d.label}>
                  {d.label}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums text-xs">{formatPct(rate)} /an</span>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  aria-label={`Poids : ${d.label}`}
                  min={0}
                  max={max}
                  step={10}
                  value={[w]}
                  onValueChange={([v]) => onChange({ ...weights, [d.key]: v ?? 0 })}
                />
                <span
                  className={cn('w-14 shrink-0 text-right text-sm tabular-nums', moved && 'font-semibold')}
                  title={`Référence : ${refShare.toFixed(1)} %`}
                >
                  {share.toFixed(1).replace('.', ',')} %
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
