import { useMemo } from 'react'
import { defineChart, lineY, ruleY } from '@tanstack/charts'
import { crosshair } from '@tanstack/charts/crosshair'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/react'
import { scaleUtc } from 'd3-scale'

import { customYoy, toDate, yoy, type Model, type Weights } from '@/lib/inflation'
import { formatPct, formatShortMonth, formatTick } from '@/lib/format'

const OFFICIAL = 'Officielle (INSEE)'
const CUSTOM = 'Avec tes pondérations'

interface Props {
  model: Model
  weights: Weights
  months: string[]
}

export function HeadlineChart({ model, weights, months }: Props) {
  const rows = useMemo(
    () =>
      months.flatMap((month) => {
        const date = toDate(month)
        const official = model.headline ? yoy(model, model.headline.key, month) : null
        const custom = customYoy(model, weights, month)
        return [
          ...(official == null ? [] : [{ date, series: OFFICIAL, value: official }]),
          ...(custom == null ? [] : [{ date, series: CUSTOM, value: custom }]),
        ]
      }),
    [model, weights, months],
  )

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          ruleY([0], { strokeOpacity: 0.6 }),
          ruleY([2], { strokeOpacity: 0.5, strokeDasharray: '4 4' }),
          lineY(rows, { x: 'date', y: 'value', z: 'series' }),
          crosshair({ x: true, y: false }),
        ],
        scales: {
          x: { scale: scaleUtc, axis: { ticks: { format: formatTick } } },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: 'Sur un an (%)', ticks: { format: (v) => `${v} %` } },
          },
        },
        color: {
          scale: scaleOrdinal<string, string>().domain([OFFICIAL, CUSTOM]).range(['currentColor', 'var(--series-1)']),
        },
        theme: { grid: 'var(--chart-grid)' },
        focus: 'group-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
          use: tooltip,
          content: (points) => ({
            title: points[0] ? formatShortMonth(points[0].xValue) : '',
            rows: points.map((p) => ({ label: p.groupLabel, value: formatPct(p.yValue), color: p.color })),
          }),
        },
      }),
    [rows],
  )

  return (
    <div className="chart">
      <Chart
        definition={definition}
        height={320}
        initialWidth={800}
        ariaLabel="Inflation sur un an : officielle et recalculée avec tes pondérations"
      />
    </div>
  )
}
