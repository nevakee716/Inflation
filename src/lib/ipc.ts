// Contrat du fichier produit par le bot de collecte INSEE (data/insee/ipc.json).

export interface Observation {
  /** Mois au format AAAA-MM */
  date: string
  value: number
}

export interface IpcSeries {
  /** Code COICOP ; "00" = ensemble */
  key: string
  idbank: string | null
  label: string
  /** Profondeur COICOP : 0 = ensemble, 1 = division, 2 = groupe */
  level: number
  parent: string | null
  /** Pondération pour 10 000 de l'année la plus récente, si connue */
  weight: number | null
  /** Indices mensuels, ordre chronologique */
  observations: Observation[]
}

export interface IpcDataset {
  source: string
  fetchedAt: string
  base: string
  demo?: boolean
  series: IpcSeries[]
}

// Le vrai fichier est optionnel tant que le bot ne l'a pas encore commité :
// import.meta.glob renvoie un objet vide si le fichier n'existe pas.
const real = import.meta.glob<IpcDataset>('../../data/insee/ipc.json', { eager: true, import: 'default' })
const demo = import.meta.glob<IpcDataset>('../../data/insee/ipc.demo.json', { eager: true, import: 'default' })

export function loadDataset(): IpcDataset {
  const dataset = Object.values(real)[0] ?? Object.values(demo)[0]
  if (!dataset) throw new Error('Aucun fichier de données IPC trouvé dans data/insee/')
  return dataset
}
