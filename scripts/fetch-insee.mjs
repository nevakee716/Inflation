#!/usr/bin/env node
// Fetches the French CPI (IPC) from the INSEE BDM SDMX API and writes data/insee/ipc.json.
//
// Usage: node scripts/fetch-insee.mjs [--out data/insee/ipc.json] [--max-level 2]
//
// Source: https://bdm.insee.fr/series/sdmx (public, no API key).
// - Indices come from the base 2025 dataflow (IPC-2025, COICOP 2018), all households, France entière.
// - Before the base 2025 series start, history is back-filled from the base 2015 dataflow
//   (IPC-2015, COICOP 2016) for codes whose scope is unchanged between the two nomenclatures,
//   rescaled at the first common month ("chained": true on the series).
// - Weights ("pondérations", per 10 000) come from the POND series of the same dataflow.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseSeries } from './sdmx.mjs'

const BASE_URL = 'https://bdm.insee.fr/series/sdmx'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const OUT = arg('out', 'data/insee/ipc.json')
const MAX_LEVEL = Number(arg('max-level', '2'))

// COICOP 2016 -> 2018 divisions 01 to 07 keep the same scope, so their history can be chained.
// 08 to 13 were redrawn in COICOP 2018 (information & communication, insurance, personal care...).
const CHAINABLE = /^(00|0[1-7])$/

// Key order of IPC-2015 / IPC-2025:
// FREQ.INDICATEUR.FORME-VENTE.COICOP.PRIX_CONSO.NATURE.MENAGES_IPC.REF_AREA.UNIT_MEASURE.CORRECTION.BASIND.SERIE_ARRETEE
const key = ({ freq = 'M', coicop = '', nature = 'INDICE', basind = '', arretee = '' }) =>
  [freq, 'IPC', 'SO', coicop, 'SO', nature, 'ENSEMBLE', 'FE', '', 'BRUT', basind, arretee].join('.')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path, { attempts = 6 } = {}) {
  const url = `${BASE_URL}/${path}`
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/xml', 'User-Agent': 'inflation-dashboard-bot (github.com/nevakee716/Inflation)' },
        signal: AbortSignal.timeout(120_000),
      })
      if (res.status === 404) return '' // SDMX "no results found"
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      if (i >= attempts) throw new Error(`GET ${url} failed after ${i} attempts: ${err.message}`)
      const wait = 2000 * 2 ** (i - 1)
      console.warn(`  retry ${i}/${attempts - 1} in ${wait / 1000}s (${err.cause?.code ?? err.message})`)
      await sleep(wait)
    }
  }
}

const level = (code) => (code === '00' ? 0 : code.length - 1)
const parentOf = (code) => (code === '00' ? null : code.length === 2 ? '00' : code.slice(0, -1))

const cleanLabel = (title) =>
  (title.match(/Coicop\s*:\s*[\d.]+\s*-\s*(.+)$/i)?.[1] ?? title).trim()

// SDMX supports OR'ing codes with "+"; chunk to keep URLs short.
async function fetchByCodes(dataflow, codes, opts, query = '') {
  const all = []
  for (let i = 0; i < codes.length; i += 40) {
    const chunk = codes.slice(i, i + 40)
    all.push(...parseSeries(await get(`data/${dataflow}/${key({ ...opts, coicop: chunk.join('+') })}${query}`)))
  }
  return all
}

async function main() {
  console.log(`Fetching INSEE CPI (max COICOP level ${MAX_LEVEL})`)

  // 1. Base 2025 indices, every COICOP code, then keep levels 0..MAX_LEVEL.
  const raw2025 = parseSeries(await get(`data/IPC-2025/${key({ basind: '2025', arretee: 'FALSE' })}`))
  const indices = raw2025
    .filter((s) => s.attrs.COICOP2018 && s.attrs.COICOP2018 !== 'SO' && level(s.attrs.COICOP2018) <= MAX_LEVEL)
    .filter((s) => s.observations.length > 0)
  if (!indices.some((s) => s.attrs.COICOP2018 === '00')) {
    throw new Error(`IPC-2025: overall index (COICOP 00) missing, got ${raw2025.length} series`)
  }
  console.log(`  IPC-2025: ${indices.length} series kept out of ${raw2025.length}`)
  const codes = indices.map((s) => s.attrs.COICOP2018).sort()

  // 2. Weights for the same codes (latest year available).
  const weights = new Map()
  try {
    const pond = await fetchByCodes('IPC-2025', codes, { freq: '', nature: 'POND' }, '?lastNObservations=1')
    for (const s of pond) {
      const obs = s.observations.at(-1)
      if (obs) weights.set(s.attrs.COICOP2018, { value: obs.value, year: obs.date.slice(0, 4) })
    }
    console.log(`  weights: ${weights.size} codes`)
  } catch (err) {
    console.warn(`  weights unavailable: ${err.message}`)
  }

  // 3. Back-fill history from base 2015 for chainable codes.
  const firstDate = indices.reduce((min, s) => (s.observations[0].date < min ? s.observations[0].date : min), '9999')
  const history = new Map()
  const chainCodes = codes.filter((c) => CHAINABLE.test(c.slice(0, 2)))
  if (firstDate > '1999' && chainCodes.length) {
    try {
      const raw2015 = await fetchByCodes('IPC-2015', chainCodes, { basind: '2015' })
      for (const s of raw2015) if (s.observations.length) history.set(s.attrs.COICOP2016, s)
      console.log(`  IPC-2015 history: ${history.size} series`)
    } catch (err) {
      console.warn(`  base 2015 history unavailable: ${err.message}`)
    }
  }

  const series = indices
    .map((s) => {
      const code = s.attrs.COICOP2018
      let observations = s.observations.map(({ date, value }) => ({ date, value }))
      let chained = false
      const old = history.get(code)
      if (old) {
        const pivot = observations.find((o) => old.observations.some((p) => p.date === o.date))
        if (pivot) {
          const ratio = pivot.value / old.observations.find((p) => p.date === pivot.date).value
          const before = old.observations
            .filter((p) => p.date < observations[0].date)
            .map(({ date, value }) => ({ date, value: Math.round(value * ratio * 100) / 100 }))
          if (before.length) {
            observations = [...before, ...observations]
            chained = true
          }
        }
      }
      const w = weights.get(code)
      return {
        key: code,
        idbank: s.attrs.IDBANK,
        label: cleanLabel(s.attrs.TITLE_FR ?? code),
        level: level(code),
        parent: parentOf(code),
        weight: w?.value ?? null,
        weightYear: w?.year ?? null,
        chained,
        ...(chained ? { chainedFrom: old.attrs.IDBANK } : {}),
        lastUpdate: s.attrs.LAST_UPDATE ?? null,
        observations,
      }
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  const doc = {
    source: 'INSEE BDM',
    sourceUrl: `${BASE_URL}/data/IPC-2025`,
    dataflow: 'IPC-2025',
    base: '2025=100',
    nomenclature: 'COICOP 2018',
    population: 'Ensemble des ménages, France',
    weightUnit: 'pour 10000',
    fetchedAt: new Date().toISOString(),
    lastObservation: series.find((s) => s.key === '00').observations.at(-1).date,
    series,
  }

  // Only rewrite the file when the data changed, so the scheduled job does not commit noise.
  const strip = (d) => JSON.stringify({ ...d, fetchedAt: undefined })
  try {
    const previous = JSON.parse(await readFile(OUT, 'utf8'))
    if (strip(previous) === strip(doc)) {
      console.log(`No change (last observation ${doc.lastObservation}).`)
      return
    }
  } catch {}
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(doc, null, 1) + '\n')
  console.log(`Wrote ${OUT}: ${series.length} series, last observation ${doc.lastObservation}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
