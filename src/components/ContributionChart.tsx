import { useMemo } from 'react'
import { barX, defineChart, ruleX } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/react'

import { contributions, type Model, type Weights } from '@/lib/inflation'
import { formatPct, formatPts } from '@/lib/format'

interface Props {
  model: Model
  weights: Weights
  month: string
}

/** Décomposition de l'inflation recalculée : poids × hausse des prix de chaque poste. */
export function ContributionChart({ model, weights, month }: Props) {
  const rows = useMemo(
    () => contributions(model, weights, month).sort((a, b) => b.points - a.points),
    [model, weights, month],
  )

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barX(rows, { x: 'points', y: 'label', fill: 'var(--series-1)' }),
          ruleX([0], { strokeOpacity: 0.6 }),
        ],
        scales: {
          x: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: "Points d'inflation", ticks: { format: (v) => `${v}` } },
          },
          y: { scale: () => scaleBand<string>().padding(0.25), axis: { ticks: { format: shorten } } },
        },
        theme: { grid: 'var(--chart-grid)' },
        tooltip: {
          use: tooltip,
          content: (points) => {
            const d = points[0]?.datum
            return {
              title: d?.label ?? '',
              rows: d
                ? [
                    { label: 'Contribution', value: formatPts(d.points) },
                    { label: 'Hausse des prix sur un an', value: formatPct(d.rate) },
                    { label: 'Poids dans ton panier', value: `${(d.share * 100).toFixed(1).replace('.', ',')} %` },
                  ]
                : [],
            }
          },
        },
      }),
    [rows],
  )

  return (
    <div className="chart">
      <Chart
        definition={definition}
        height={Math.max(260, rows.length * 30 + 60)}
        initialWidth={600}
        ariaLabel="Contribution de chaque poste à l'inflation recalculée"
      />
    </div>
  )
}

function shorten(label: string) {
  const first = label.split(/[,;]| et /)[0] ?? label
  return first.length > 26 ? `${first.slice(0, 25)}…` : first
}
