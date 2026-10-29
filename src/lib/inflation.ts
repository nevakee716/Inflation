import type { IpcDataset, IpcSeries } from './ipc'

export type Weights = Record<string, number>

/** Séries indexées par date pour des accès O(1). */
export interface Model {
  dates: string[]
  headline: IpcSeries | undefined
  divisions: IpcSeries[]
  values: Map<string, Map<string, number>>
}

export function buildModel(dataset: IpcDataset): Model {
  const values = new Map<string, Map<string, number>>()
  const dateSet = new Set<string>()
  for (const s of dataset.series) {
    const byDate = new Map<string, number>()
    for (const o of s.observations) {
      byDate.set(o.date, o.value)
      dateSet.add(o.date)
    }
    values.set(s.key, byDate)
  }
  return {
    dates: [...dateSet].sort(),
    headline: dataset.series.find((s) => s.level === 0),
    divisions: dataset.series.filter((s) => s.level === 1).sort((a, b) => a.key.localeCompare(b.key)),
    values,
  }
}

export function shiftMonth(date: string, months: number): string {
  const [y, m] = date.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function toDate(month: string): Date {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1, 1))
}

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
export const formatMonth = (month: string) => monthFormat.format(toDate(month))

/** Variation en % entre `date` et `date - lag` mois, ou null si une valeur manque. */
export function change(model: Model, key: string, date: string, lag: number): number | null {
  const s = model.values.get(key)
  const now = s?.get(date)
  const before = s?.get(shiftMonth(date, -lag))
  if (now == null || before == null || before === 0) return null
  return (now / before - 1) * 100
}

export const yoy = (model: Model, key: string, date: string) => change(model, key, date, 12)

/** Poids par défaut : ceux du fichier INSEE, ou à défaut des poids égaux. */
export function defaultWeights(model: Model): Weights {
  const hasWeights = model.divisions.some((d) => d.weight != null)
  return Object.fromEntries(model.divisions.map((d) => [d.key, hasWeights ? (d.weight ?? 0) : 100]))
}

export function equalWeights(model: Model): Weights {
  return Object.fromEntries(model.divisions.map((d) => [d.key, 100]))
}

/**
 * Moyenne pondérée des variations des divisions. Les divisions sans donnée à
 * cette date sont exclues et les poids restants renormalisés.
 */
function weightedChange(model: Model, weights: Weights, date: string, lag: number): number | null {
  let sum = 0
  let total = 0
  for (const d of model.divisions) {
    const w = weights[d.key] ?? 0
    if (w <= 0) continue
    const c = change(model, d.key, date, lag)
    if (c == null) continue
    sum += w * c
    total += w
  }
  return total > 0 ? sum / total : null
}

/** Inflation sur un an recalculée avec les pondérations de l'utilisateur. */
export const customYoy = (model: Model, weights: Weights, date: string) => weightedChange(model, weights, date, 12)

/** Contribution de chaque division à l'inflation recalculée, en points. */
export function contributions(model: Model, weights: Weights, date: string) {
  const total = model.divisions.reduce((s, d) => {
    const w = weights[d.key] ?? 0
    return w > 0 && yoy(model, d.key, date) != null ? s + w : s
  }, 0)
  return model.divisions.flatMap((d) => {
    const rate = yoy(model, d.key, date)
    const w = weights[d.key] ?? 0
    if (rate == null || total === 0) return []
    return [{ key: d.key, label: d.label, rate, share: w / total, points: (w * rate) / total }]
  })
}

/**
 * Inflation cumulée entre `from` et `to` : officielle (indice d'ensemble) et
 * recalculée (indice chaîné mois par mois avec les pondérations de l'utilisateur).
 */
export function cumulative(model: Model, weights: Weights, from: string, to: string) {
  const official = model.headline ? change(model, model.headline.key, to, monthsBetween(from, to)) : null
  let level = 1
  for (let d = shiftMonth(from, 1); d <= to; d = shiftMonth(d, 1)) {
    const m = weightedChange(model, weights, d, 1)
    if (m != null) level *= 1 + m / 100
  }
  return { official, custom: (level - 1) * 100 }
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number]
  const [ty, tm] = to.split('-').map(Number) as [number, number]
  return (ty - fy) * 12 + (tm - fm)
}
