# Données INSEE

`ipc.json` est généré par `scripts/fetch-insee.mjs` et mis à jour automatiquement par le workflow
**Update INSEE data** (`.github/workflows/update-insee-data.yml`) : tous les jours à 06:17 UTC, à la main
via *Run workflow*, ou quand le script change sur `main`. Le fichier n'est commité que si les données changent.

- Source : API SDMX de la BDM INSEE, dataflow `IPC-2025` (indice des prix à la consommation, base 2025 = 100,
  nomenclature COICOP 2018, ensemble des ménages, France entière). Séries mensuelles depuis 1996-01.
- Séries : `00` (ensemble), les divisions `01` à `13` (`level` 1) et leurs groupes (`level` 2, `parent` = division).
- `weight` : pondération de l'année `weightYear`, pour 10 000 (les divisions somment à 10 000).

Lancer en local (Node 20+, aucune dépendance) :

```sh
node scripts/fetch-insee.mjs --out data/insee/ipc.json [--max-level 2]
```
