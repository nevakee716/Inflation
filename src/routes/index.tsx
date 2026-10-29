import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FlaskConical } from 'lucide-react'

import { CategoryChart, type CategoryMode } from '@/components/CategoryChart'
import { ContributionChart } from '@/components/ContributionChart'
import { HeadlineChart } from '@/components/HeadlineChart'
import { KpiCards, type Kpis } from '@/components/KpiCards'
import { WeightsPanel } from '@/components/WeightsPanel'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CATEGORY_SLOTS, SERIES_COLORS } from '@/lib/format'
import {
  buildModel,
  cumulative,
  customYoy,
  defaultWeights,
  equalWeights,
  formatMonth,
  shiftMonth,
  yoy,
  type Weights,
} from '@/lib/inflation'
import { loadDataset } from '@/lib/ipc'
import { cn } from '@/lib/utils'

const dataset = loadDataset()
const model = buildModel(dataset)
const inseeWeights = defaultWeights(model)

export const Route = createFileRoute('/')({ component: Dashboard })

const RANGES = { '2': 24, '5': 60, '10': 120, all: Infinity } as const
type Range = keyof typeof RANGES

function Dashboard() {
  const [weights, setWeights] = useState<Weights>(inseeWeights)
  const [range, setRange] = useState<Range>('5')
  const [mode, setMode] = useState<CategoryMode>('yoy')
  // Chaque poste sélectionné garde son créneau de couleur tant qu'il reste affiché.
  const [slots, setSlots] = useState<Record<string, number>>(() => initialSlots())

  const lastMonth = model.dates.at(-1) ?? ''
  // Le glissement annuel demande 12 mois d'historique avant le premier point.
  const firstMonth = shiftMonth(model.dates[0] ?? lastMonth, 12)
  const months = useMemo(() => {
    const span = RANGES[range]
    const start = Number.isFinite(span) ? shiftMonth(lastMonth, -span) : firstMonth
    return model.dates.filter((d) => d >= (start > firstMonth ? start : firstMonth))
  }, [range, lastMonth, firstMonth])
  const rangeStart = months[0] ?? lastMonth

  const kpis = useMemo<Kpis>(() => {
    const headlineKey = model.headline?.key
    const official = headlineKey ? yoy(model, headlineKey, lastMonth) : null
    const officialPrev = headlineKey ? yoy(model, headlineKey, shiftMonth(lastMonth, -1)) : null
    const cumul = cumulative(model, weights, rangeStart, lastMonth)
    let peak: Kpis['peak'] = null
    if (headlineKey) {
      for (const m of months) {
        const v = yoy(model, headlineKey, m)
        if (v != null && (peak == null || v > peak.value)) peak = { value: v, label: formatMonth(m) }
      }
    }
    return {
      monthLabel: formatMonth(lastMonth),
      official,
      officialPrev,
      custom: customYoy(model, weights, lastMonth),
      rangeLabel: `depuis ${formatMonth(rangeStart)}`,
      cumulOfficial: cumul.official,
      cumulCustom: cumul.custom,
      peak,
    }
  }, [weights, months, lastMonth, rangeStart])

  const selected = model.divisions
    .filter((d) => slots[d.key] != null)
    .map((d) => ({ key: d.key, label: d.label, color: SERIES_COLORS[(slots[d.key] ?? 1) - 1] ?? 'currentColor' }))

  function toggle(key: string) {
    setSlots((current) => {
      if (current[key] != null) {
        const { [key]: _, ...rest } = current
        return rest
      }
      const used = new Set(Object.values(current))
      const free = CATEGORY_SLOTS.find((s) => !used.has(s))
      return free == null ? current : { ...current, [key]: free }
    })
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inflation en France</h1>
        <p className="text-muted-foreground max-w-3xl text-sm sm:text-base">
          Indice des prix à la consommation de l'INSEE, poste par poste. Ajuste le poids de chaque poste pour voir
          l'inflation de <em>ton</em> panier.
        </p>
        {dataset.demo && (
          <p className="flex w-fit items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm">
            <FlaskConical className="size-4" aria-hidden />
            Données de démonstration synthétiques : les vraies séries INSEE arrivent avec le bot de collecte.
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-sm">Période</span>
        <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as Range)}>
          <ToggleGroupItem value="2">2 ans</ToggleGroupItem>
          <ToggleGroupItem value="5">5 ans</ToggleGroupItem>
          <ToggleGroupItem value="10">10 ans</ToggleGroupItem>
          <ToggleGroupItem value="all">Tout</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <KpiCards k={kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Inflation sur un an</CardTitle>
              <CardDescription>Officielle, et recalculée avec tes pondérations. Pointillés : cible BCE de 2 %.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Legend
                items={[
                  { label: 'Officielle (INSEE)', color: 'currentColor' },
                  { label: 'Avec tes pondérations', color: 'var(--series-1)' },
                ]}
              />
              <HeadlineChart model={model} weights={weights} months={months} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prix par poste de dépense</CardTitle>
              <CardDescription>Jusqu'à {CATEGORY_SLOTS.length} postes à la fois.</CardDescription>
              <CardAction>
                <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as CategoryMode)}>
                  <ToggleGroupItem value="yoy">Sur un an</ToggleGroupItem>
                  <ToggleGroupItem value="index">Base 100</ToggleGroupItem>
                </ToggleGroup>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {model.divisions.map((d) => {
                  const slot = slots[d.key]
                  const full = slot == null && Object.keys(slots).length >= CATEGORY_SLOTS.length
                  return (
                    <button
                      key={d.key}
                      type="button"
                      aria-pressed={slot != null}
                      disabled={full}
                      onClick={() => toggle(d.key)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border px-3 py-1 text-left text-xs transition-colors disabled:opacity-40',
                        slot != null ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full border"
                        style={slot != null ? { background: SERIES_COLORS[slot - 1], borderColor: 'transparent' } : undefined}
                        aria-hidden
                      />
                      {d.label}
                    </button>
                  )
                })}
              </div>
              <CategoryChart model={model} months={months} selected={selected} mode={mode} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ton panier</CardTitle>
              <CardDescription>
                Poids de chaque poste dans tes dépenses.{' '}
                {model.divisions.some((d) => d.weight != null)
                  ? 'Par défaut : pondérations INSEE.'
                  : 'Pondérations INSEE indisponibles : poids égaux par défaut.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeightsPanel
                model={model}
                month={lastMonth}
                weights={weights}
                reference={inseeWeights}
                onChange={setWeights}
                onPreset={(p) => setWeights(p === 'insee' ? inseeWeights : equalWeights(model))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>D'où vient ton inflation</CardTitle>
              <CardDescription>Contribution de chaque poste, {formatMonth(lastMonth)}, en points.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContributionChart model={model} weights={weights} month={lastMonth} />
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="text-muted-foreground flex flex-col gap-1 border-t pt-4 text-xs">
        <p>
          Source : {dataset.source} · indices base {dataset.base} · mis à jour le{' '}
          {new Date(dataset.fetchedAt).toLocaleDateString('fr-FR')}.
        </p>
        <p>
          L'inflation recalculée est la moyenne des hausses de prix sur un an de chaque poste, pondérée par tes poids.
          Avec les pondérations INSEE, elle approche l'indice officiel sans le reproduire exactement (l'INSEE chaîne
          ses indices chaque année avec des pondérations détaillées).
        </p>
      </footer>
    </main>
  )
}

function initialSlots(): Record<string, number> {
  // Par défaut : les trois postes les plus lourds du panier de référence.
  const top = [...model.divisions]
    .sort((a, b) => (inseeWeights[b.key] ?? 0) - (inseeWeights[a.key] ?? 0))
    .slice(0, 3)
  return Object.fromEntries(top.map((d, i) => [d.key, CATEGORY_SLOTS[i] ?? 2]))
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
