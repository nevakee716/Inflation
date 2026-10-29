const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' })
const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** "+2,3 %" */
export const formatPct = (value: number | null | undefined) => (value == null ? '–' : `${pct.format(value)} %`)
/** "+0,4 pt" */
export const formatPts = (value: number | null | undefined) => (value == null ? '–' : `${pct.format(value)} pt`)
export const formatNumber = (value: number) => num.format(value)
export const formatEur = (value: number) => eur.format(value)

const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const year = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'UTC' })

/** Graduation de l'axe temporel : l'année seule en janvier, sinon mois abrégé. */
export function formatTick(value: Date) {
  return value.getUTCMonth() === 0 ? year.format(value) : shortMonth.format(value)
}

export const formatShortMonth = (value: Date) => shortMonth.format(value)

/** Couleurs catégorielles ; la n°1 est réservée à « ton inflation ». */
export const SERIES_COLORS = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`)
export const CATEGORY_SLOTS = [2, 3, 4, 5, 6, 7, 8]
