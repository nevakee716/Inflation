import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatEur, formatPct, formatPts } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface Kpis {
  monthLabel: string
  official: number | null
  officialPrev: number | null
  custom: number | null
  rangeLabel: string
  cumulOfficial: number | null
  cumulCustom: number
  peak: { value: number; label: string } | null
}

export function KpiCards({ k }: { k: Kpis }) {
  const officialDelta = k.official != null && k.officialPrev != null ? k.official - k.officialPrev : null
  const gap = k.official != null && k.custom != null ? k.custom - k.official : null
  const basket = 100 * (1 + k.cumulCustom / 100)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Inflation officielle sur un an"
        value={formatPct(k.official)}
        hint={k.monthLabel}
        delta={officialDelta}
        deltaLabel="vs mois précédent"
      />
      <Kpi
        label="Avec tes pondérations"
        value={formatPct(k.custom)}
        hint={k.monthLabel}
        delta={gap}
        deltaLabel="vs officielle"
        accent
      />
      <Kpi
        label={`Hausse cumulée des prix, ${k.rangeLabel}`}
        value={formatPct(k.cumulCustom)}
        hint={`Officielle : ${formatPct(k.cumulOfficial)} · 100 € d'alors ≈ ${formatEur(basket)} aujourd'hui pour ton panier`}
      />
      <Kpi
        label="Pic d'inflation sur la période"
        value={k.peak ? formatPct(k.peak.value) : '–'}
        hint={k.peak?.label ?? ''}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  accent,
}: {
  label: string
  value: string
  hint: string
  delta?: number | null
  deltaLabel?: string
  accent?: boolean
}) {
  return (
    <Card className="gap-2 py-5">
      <CardHeader className="px-5">
        <CardDescription className="flex items-center gap-2">
          {accent && <span className="size-2.5 rounded-full bg-[var(--series-1)]" aria-hidden />}
          {label}
        </CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground flex flex-col gap-1 px-5 text-xs">
        {delta != null && Math.abs(delta) >= 0.05 && (
          <span className={cn('flex items-center gap-1 font-medium', delta > 0 ? 'text-bad' : 'text-good')}>
            {delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {formatPts(delta)} {deltaLabel}
          </span>
        )}
        {delta != null && Math.abs(delta) < 0.05 && <span>Stable {deltaLabel}</span>}
        <span>{hint}</span>
      </CardContent>
    </Card>
  )
}
