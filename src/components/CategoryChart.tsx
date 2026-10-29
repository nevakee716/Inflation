import { useMemo } from 'react'
import { defineChart, lineY, ruleY } from '@tanstack/charts'
import { crosshair } from '@tanstack/charts/crosshair'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/react'
import { scaleUtc } from 'd3-scale'

import { toDate, yoy, type Model } from '@/lib/inflation'
import { formatNumber, formatPct, formatShortMonth, formatTick } from '@/lib/format'

export type CategoryMode = 'yoy' | 'index'

interface Props {
  model: Model
  months: string[]
  /** Divisions affichées, avec leur couleur attribuée */
  selected: { key: string; label: string; color: string }[]
  mode: CategoryMode
}

export function CategoryChart({ model, months, selected, mode }: Props) {
  const rows = useMemo(() => {
    const start = months[0]
    return selected.flatMap(({ key, label }) => {
      const values = model.values.get(key)
      const base = start ? values?.get(start) : undefined
      return months.flatMap((month) => {
        const value =
          mode === 'yoy' ? yoy(model, key, month) : base ? ((values?.get(month) ?? NaN) / base) * 100 : null
        return value == null || Number.isNaN(value) ? [] : [{ date: toDate(month), series: label, value }]
      })
    })
  }, [model, months, selected, mode])

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          ruleY([mode === 'yoy' ? 0 : 100], { strokeOpacity: 0.6 }),
          lineY(rows, { x: 'date', y: 'value', z: 'series' }),
          crosshair({ x: true, y: false }),
        ],
        scales: {
          x: { scale: scaleUtc, axis: { ticks: { format: formatTick } } },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: mode === 'yoy' ? 'Sur un an (%)' : `Indice, ${months[0] ?? ''} = 100`,
              ticks: { format: (v) => (mode === 'yoy' ? `${v} %` : formatNumber(v)) },
            },
          },
        },
        color: {
          scale: scaleOrdinal<string, string>()
            .domain(selected.map((s) => s.label))
            .range(selected.map((s) => s.color)),
        },
        theme: { grid: 'var(--chart-grid)' },
        focus: 'group-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
          use: tooltip,
          sort: 'focus',
          content: (points) => ({
            title: points[0] ? formatShortMonth(points[0].xValue) : '',
            rows: [...points]
              .sort((a, b) => b.yValue - a.yValue)
              .map((p) => ({
                label: p.groupLabel,
                value: mode === 'yoy' ? formatPct(p.yValue) : formatNumber(p.yValue),
                color: p.color,
              })),
          }),
        },
      }),
    [rows, selected, mode, months],
  )

  if (selected.length === 0) {
    return (
      <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
        Sélectionne au moins un poste ci-dessus.
      </div>
    )
  }

  return (
    <div className="chart">
      <Chart definition={definition} height={320} initialWidth={800} ariaLabel="Évolution des prix par poste de dépense" />
    </div>
  )
}
