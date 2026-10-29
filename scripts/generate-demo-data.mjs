// Génère data/insee/ipc.demo.json : des séries SYNTHÉTIQUES au format du fichier
// INSEE (data/insee/ipc.json), pour développer le dashboard tant que le bot de
// collecte n'a pas encore produit de vraies données. Ce ne sont pas des chiffres INSEE.
import { writeFileSync } from 'node:fs'

// Générateur pseudo-aléatoire déterministe (mulberry32) pour un fichier stable.
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Divisions COICOP, poids indicatifs pour 10 000, tendance annuelle hors choc,
// et intensité du choc inflationniste 2022-2023.
const divisions = [
  ['01', 'Produits alimentaires et boissons non alcoolisées', 1560, 0.012, 1.6],
  ['02', 'Boissons alcoolisées et tabac', 360, 0.035, 0.3],
  ['03', 'Articles d’habillement et chaussures', 380, 0.002, 0.3],
  ['04', 'Logement, eau, gaz, électricité et autres combustibles', 1480, 0.014, 1.4],
  ['05', 'Meubles, articles de ménage et entretien courant', 560, 0.004, 0.7],
  ['06', 'Santé', 520, -0.004, 0.1],
  ['07', 'Transports', 1480, 0.015, 1.5],
  ['08', 'Communications', 260, -0.02, 0.0],
  ['09', 'Loisirs et culture', 780, 0.005, 0.5],
  ['10', 'Enseignement', 80, 0.015, 0.2],
  ['11', 'Restaurants et hôtels', 1020, 0.02, 0.8],
  ['12', 'Biens et services divers', 1520, 0.014, 0.5],
]

const months = []
for (let y = 2015; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === 2026 && m > 9) break
    months.push(`${y}-${String(m).padStart(2, '0')}`)
  }
}

// Profil du choc : monte en 2022, culmine début 2023, se résorbe en 2024.
function shock(i) {
  const t = i - months.indexOf('2021-09')
  if (t < 0) return 0
  return 0.065 * Math.exp(-(((t - 17) / 9) ** 2))
}

const series = divisions.map(([key, label, weight, trend, intensity], d) => {
  const rand = rng(1000 + d)
  let level = 100
  const raw = months.map((date, i) => {
    const monthly = trend / 12 + (intensity * shock(i)) / 12 + (rand() - 0.5) * 0.006
    level *= 1 + monthly
    return { date, value: level }
  })
  // Rebase 2015 = 100.
  const base = raw.slice(0, 12).reduce((s, o) => s + o.value, 0) / 12
  return {
    key,
    idbank: null,
    label,
    level: 1,
    parent: '00',
    weight,
    observations: raw.map((o) => ({ date: o.date, value: Math.round((o.value / base) * 10000) / 100 })),
  }
})

const total = divisions.reduce((s, d) => s + d[2], 0)
const ensemble = {
  key: '00',
  idbank: null,
  label: 'Ensemble',
  level: 0,
  parent: null,
  weight: 10000,
  observations: months.map((date, i) => ({
    date,
    value:
      Math.round(series.reduce((s, ser, d) => s + ser.observations[i].value * divisions[d][2], 0) / total * 100) / 100,
  })),
}

const out = {
  source: 'Données de démonstration (synthétiques, pas l’INSEE)',
  demo: true,
  fetchedAt: '2026-10-29T00:00:00.000Z',
  base: '2015=100',
  series: [ensemble, ...series],
}

writeFileSync(new URL('../data/insee/ipc.demo.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(`ipc.demo.json : ${out.series.length} séries, ${months.length} mois`)
